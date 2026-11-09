import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { validSignaturePng } from '../_shared/signatureRules.ts';
import { LOOKBACK_DAYS, localDay, requestMessage, resendWaitMs, unsignedDates } from '../_shared/signatureBundle.ts';

// Missing-signature requests for daily timesheets. One link per person + location covers every
// unsigned worked date (multi-day). Staff actions are role-checked; public reads/writes are scoped
// to one unexpired token and only to the dates that token lists.
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const hm = (iso: string | null, zone: string) => iso ? new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)) : null;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('missing'), location_id: z.string().uuid(), personnel_ids: z.array(z.string().uuid()).min(1).max(200) }),
  z.object({ action: z.literal('request'), location_id: z.string().uuid(), sheet_date: date.optional(), personnel_ids: z.array(z.string().uuid()).min(1).max(100) }),
  z.object({ action: z.literal('resend'), location_id: z.string().uuid(), personnel_id: z.string().uuid() }),
  z.object({ action: z.literal('info'), token: z.string().uuid() }),
  z.object({ action: z.literal('sign'), token: z.string().uuid(), date: date.optional(), signature_png_base64: z.string().max(280000) }),
]);

async function trail(db: any, personnelId: string, locationId: string, from: string, to: string) {
  const { data, error } = await db.from('personnel_location_trail').select('visit_personnel_id,in_at,out_at,signature_url').eq('personnel_id', personnelId).eq('location_id', locationId)
    .gte('in_at', from).lte('in_at', to).order('in_at');
  if (error) throw error;
  return (data ?? []) as any[];
}
const recent = (db: any, pid: string, loc: string) => trail(db, pid, loc, new Date(Date.now() - (LOOKBACK_DAYS + 1) * 86400000).toISOString(), new Date(Date.now() + 86400000).toISOString());
async function staysFor(db: any, pid: string, loc: string, d: string, zone: string) {
  const mid = Date.parse(`${d}T12:00:00Z`);
  return (await trail(db, pid, loc, new Date(mid - 2 * 86400000).toISOString(), new Date(mid + 2 * 86400000).toISOString())).filter(s => s.in_at && s.visit_personnel_id && localDay(s.in_at, zone) === d);
}
const datesOf = (r: any): string[] => (r.dates?.length ? r.dates : [r.sheet_date]).slice().sort();
const tenDigits = (phone: unknown) => { const d = String(phone ?? '').replace(/\D/g, ''); const t = d.length === 11 && d.startsWith('1') ? d.slice(1) : d; return /^\d{10}$/.test(t) ? t : null; };

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const parsed = schema.safeParse(await req.json()); if (!parsed.success) return json({ error: 'Invalid request' }, 400);
    const v = parsed.data;
    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    if (v.action === 'missing' || v.action === 'request' || v.action === 'resend') {
      const { data: u } = await db.auth.getUser((req.headers.get('Authorization') ?? '').replace(/^Bearer /, ''));
      if (!u?.user) return json({ error: 'Unauthorized' }, 401);
      const { data: roles } = await db.from('user_roles').select('role').eq('user_id', u.user.id).in('role', ['admin', 'manager']);
      if (!roles?.length) return json({ error: 'Managers only' }, 403);
      const { data: loc, error: le } = await db.from('project_locations').select('name,timezone').eq('id', v.location_id).single(); if (le) throw le;
      const zone = loc.timezone || 'America/Chicago';
      const nowIso = new Date().toISOString();
      const pendingFor = async (pid: string) => {
        const { data, error } = await db.from('timesheet_signature_requests').select('id,token,sheet_date,dates,status,sms_status,requested_at,last_sent_at,send_count,expires_at').eq('personnel_id', pid).eq('location_id', v.location_id).eq('status', 'pending').order('requested_at', { ascending: false });
        if (error) throw error; return (data ?? []) as any[];
      };

      if (v.action === 'missing') {
        const out: any[] = [];
        for (const pid of v.personnel_ids) {
          const missing = unsignedDates(await recent(db, pid, v.location_id), zone);
          const p = (await pendingFor(pid)).find(r => Date.parse(r.expires_at) > Date.now() && datesOf(r).some(d => missing.includes(d))) ?? null;
          out.push({ personnel_id: pid, dates: missing, request: p && { requested_at: p.requested_at, last_sent_at: p.last_sent_at ?? p.requested_at, send_count: p.send_count, sms_status: p.sms_status, dates: datesOf(p), expires_at: p.expires_at } });
        }
        return json({ people: out });
      }

      const sid = Deno.env.get('TWILIO_ACCOUNT_SID'), secret = Deno.env.get('TWILIO_AUTH_TOKEN'), from = Deno.env.get('TWILIO_PHONE_NUMBER');
      const site = (Deno.env.get('SITE_URL') || 'https://fairfieldrg.com').replace(/\/$/, '');
      const sendSms = async (to: string, body: string) => {
        if (!sid || !secret || !from) return { sms: 'failed', err: 'Text service not configured', ext: null };
        try {
          const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${btoa(`${sid}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ To: `+1${to}`, From: from, Body: body }) });
          const out = await r.json().catch(() => ({}));
          if (r.ok && out.sid) return { sms: 'sent', err: null, ext: out.sid };
          if (r.status < 500) return { sms: 'failed', err: `Text rejected (HTTP ${r.status})`, ext: null };
        } catch { /* ambiguous send stays unknown */ }
        return { sms: 'unknown', err: null, ext: null };
      };
      const audit = (p: any, to: string, id: string, dates: string[], kind: 'request' | 'resend', s: { sms: string; err: string | null; ext: string | null }, count: number) =>
        // Audit copy omits the private link.
        db.from('messages').insert({ recipient_type: 'personnel', recipient_id: p.id, recipient_name: `${p.first_name} ${p.last_name}`, recipient_phone: `+1${to}`, message_type: 'sms', direction: 'outbound', content: `Timesheet signature ${kind} for ${loc.name} ${dates.join(', ')} (private link omitted)`, payload: { kind: 'timesheet-signature', action: kind, request_id: id, dates, send_count: count }, status: s.sms === 'sent' ? 'sent' : s.sms, external_id: s.ext, error_message: s.err, sent_by: u.user.id, sent_at: s.sms === 'sent' ? new Date().toISOString() : null });

      const ids = v.action === 'resend' ? [v.personnel_id] : v.personnel_ids;
      const { data: people } = await db.from('personnel').select('id,first_name,last_name,phone').in('id', ids);
      const results: any[] = [];
      for (const pid of ids) {
        const p = people?.find((x: any) => x.id === pid); if (!p) { results.push({ personnel_id: pid, status: 'skipped', reason: 'Not found' }); continue; }
        let dates = unsignedDates(await recent(db, pid, v.location_id), zone);
        if (v.action === 'request' && v.sheet_date && !dates.includes(v.sheet_date)) {
          // Older than the lookback window: still allow the explicitly chosen day.
          const day = await staysFor(db, pid, v.location_id, v.sheet_date, zone);
          if (day.length && !day.some(s => s.signature_url)) dates = [...dates, v.sheet_date].sort();
        }
        if (!dates.length) { results.push({ personnel_id: pid, status: 'skipped', reason: 'Nothing to sign' }); continue; }
        const to = tenDigits(p.phone); if (!to) { results.push({ personnel_id: pid, status: 'no_phone' }); continue; }
        const pend = await pendingFor(pid);
        const live = pend.find(r => Date.parse(r.expires_at) > Date.now() && datesOf(r).some(d => dates.includes(d)));

        if (v.action === 'request' && live) { results.push({ personnel_id: pid, status: 'already_requested', requested_at: live.last_sent_at ?? live.requested_at, send_count: live.send_count }); continue; }
        if (v.action === 'resend') {
          const prior = live ?? pend.find(r => datesOf(r).some(d => dates.includes(d)));
          if (prior) {
            const wait = resendWaitMs(prior.last_sent_at ?? prior.requested_at);
            if (wait > 0) { results.push({ personnel_id: pid, status: 'rate_limited', retry_in_s: Math.ceil(wait / 1000) }); continue; }
            const expired = Date.parse(prior.expires_at) <= Date.now();
            // Same link while valid; a fresh token + 7-day window only when expired. 
            // Keep previously listed dates (signed ones show as done) and add any newly missing ones.
            dates = [...new Set([...datesOf(prior), ...dates])].sort();
            const patch: any = { dates, sheet_date: dates[0], send_count: (prior.send_count ?? 1) + 1, last_sent_at: nowIso, last_sent_by: u.user.id, sms_status: 'sending', sms_error: null };
            if (expired) { patch.token = crypto.randomUUID(); patch.expires_at = new Date(Date.now() + 7 * 86400000).toISOString(); }
            // Supersede other pending rows that cover any of these dates so the one-pending index stays clean.
            const others = pend.filter(r => r.id !== prior.id && datesOf(r).some(d => dates.includes(d))).map(r => r.id);
            if (others.length) await db.from('timesheet_signature_requests').update({ status: 'cancelled' }).in('id', others);
            const { data: row, error: ue } = await db.from('timesheet_signature_requests').update(patch).eq('id', prior.id).eq('status', 'pending').select('id,token,send_count').single();
            if (ue || !row) { results.push({ personnel_id: pid, status: 'failed', reason: 'Request changed; refresh' }); continue; }
            const s = await sendSms(to, requestMessage(loc.name, dates, `${site}/timesheet-sign/${row.token}`));
            await db.from('timesheet_signature_requests').update({ sms_status: s.sms, sms_error: s.err }).eq('id', row.id);
            await audit(p, to, row.id, dates, 'resend', s, row.send_count);
            results.push({ personnel_id: pid, status: s.sms === 'failed' ? 'failed' : 'resent', send_count: row.send_count, requested_at: nowIso, dates, reason: s.err });
            continue;
          }
        }
        // New bundled request: cancel any older pending rows touching these dates, then one row + one text.
        const stale = pend.filter(r => datesOf(r).some(d => dates.includes(d))).map(r => r.id);
        if (stale.length) await db.from('timesheet_signature_requests').update({ status: 'cancelled' }).in('id', stale);
        const { data: row, error: ie } = await db.from('timesheet_signature_requests').insert({ personnel_id: pid, location_id: v.location_id, sheet_date: dates[0], dates, requested_by: u.user.id, last_sent_at: nowIso, last_sent_by: u.user.id }).select('id,token,requested_at').single();
        if (ie) { results.push({ personnel_id: pid, status: ie.code === '23505' ? 'already_requested' : 'failed' }); continue; }
        const s = await sendSms(to, requestMessage(loc.name, dates, `${site}/timesheet-sign/${row.token}`));
        await db.from('timesheet_signature_requests').update({ sms_status: s.sms, sms_error: s.err }).eq('id', row.id);
        await audit(p, to, row.id, dates, 'request', s, 1);
        results.push({ personnel_id: pid, status: s.sms === 'failed' ? 'failed' : 'requested', requested_at: row.requested_at, send_count: 1, dates, reason: s.err });
      }
      return json({ results });
    }

    const { data: r, error: re } = await db.from('timesheet_signature_requests').select('id,personnel_id,location_id,sheet_date,dates,status,expires_at').eq('token', v.token).maybeSingle(); if (re) throw re;
    if (!r || r.status === 'cancelled' || Date.parse(r.expires_at) <= Date.now()) return json({ error: 'Inactive link' }, 403);
    const [{ data: loc }, { data: p }] = await Promise.all([
      db.from('project_locations').select('name,timezone').eq('id', r.location_id).single(),
      db.from('personnel').select('first_name,last_name').eq('id', r.personnel_id).single(),
    ]);
    const zone = loc?.timezone || 'America/Chicago';
    const list = datesOf(r);
    const days = await Promise.all(list.map(async d => { const stays = await staysFor(db, r.personnel_id, r.location_id, d, zone); return { date: d, stays, signed: stays.some(s => s.signature_url) }; }));
    const markIfDone = async (extra?: string) => {
      if (days.every(d => d.signed || d.date === extra)) await db.from('timesheet_signature_requests').update({ status: 'signed', signed_at: new Date().toISOString() }).eq('id', r.id).eq('status', 'pending');
    };
    if (v.action === 'info') {
      await markIfDone();
      return json({ name: `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim(), location: loc?.name, date: list[0], signed: days.every(d => d.signed), days: days.map(d => ({ date: d.date, signed: d.signed, stays: d.stays.map(s => ({ in: hm(s.in_at, zone), out: hm(s.out_at, zone) })) })), stays: days[0]?.stays.map(s => ({ in: hm(s.in_at, zone), out: hm(s.out_at, zone) })) ?? [] });
    }

    const target = v.date ?? days.find(d => !d.signed)?.date;
    const day = days.find(d => d.date === target); if (!day) return json({ error: 'Date not on this link' }, 400);
    if (day.signed) { await markIfDone(); return json({ ok: true, date: day.date }); }
    const first = day.stays[0]; if (!first) return json({ error: 'No entry for that day' }, 409);
    const b64 = v.signature_png_base64.replace(/^data:image\/png;base64,/, '');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return json({ error: 'Signature required' }, 400);
    let bytes: Uint8Array; try { bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); } catch { return json({ error: 'Invalid signature' }, 400); }
    if (!validSignaturePng(bytes)) return json({ error: 'Invalid PNG' }, 400);
    const path = `field-signatures/${r.personnel_id}/${first.visit_personnel_id}.png`;
    const { error: ue } = await db.storage.from('project-documents').upload(path, bytes, { contentType: 'image/png', upsert: false });
    if (ue) { const { data: ex } = await db.storage.from('project-documents').download(path); if (!ex) return json({ error: 'Could not save signature' }, 409); }
    const now = new Date().toISOString();
    const { error: we } = await db.from('visit_personnel').update({ signature_url: path, signed_at: now }).eq('id', first.visit_personnel_id).is('signature_url', null); if (we) throw we;
    if (list.length === 1) await db.from('timesheet_signature_requests').update({ visit_personnel_id: first.visit_personnel_id }).eq('id', r.id);
    await markIfDone(day.date);
    return json({ ok: true, date: day.date });
  } catch (e) { console.error('timesheet-signature failed', e instanceof Error ? e.message : e); return json({ error: 'Signature service unavailable' }, 500); }
});
