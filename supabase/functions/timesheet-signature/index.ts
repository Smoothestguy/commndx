import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { validSignaturePng } from '../_shared/signatureRules.ts';

// Missing-signature requests for daily timesheets. Staff requests are role-checked;
// public reads/writes are scoped to one unexpired token (person + location + local day).
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const day = (iso: string, zone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const hm = (iso: string | null, zone: string) => iso ? new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)) : null;
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('request'), location_id: z.string().uuid(), sheet_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), personnel_ids: z.array(z.string().uuid()).min(1).max(100) }),
  z.object({ action: z.literal('info'), token: z.string().uuid() }),
  z.object({ action: z.literal('sign'), token: z.string().uuid(), signature_png_base64: z.string().max(280000) }),
]);

async function staysFor(db: any, personnelId: string, locationId: string, date: string, zone: string) {
  const mid = Date.parse(`${date}T12:00:00Z`);
  const { data, error } = await db.from('personnel_location_trail').select('visit_personnel_id,in_at,out_at,signature_url').eq('personnel_id', personnelId).eq('location_id', locationId)
    .gte('in_at', new Date(mid - 2 * 86400000).toISOString()).lte('in_at', new Date(mid + 2 * 86400000).toISOString()).order('in_at');
  if (error) throw error;
  return (data ?? []).filter((s: any) => s.in_at && s.visit_personnel_id && day(s.in_at, zone) === date);
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const parsed = schema.safeParse(await req.json()); if (!parsed.success) return json({ error: 'Invalid request' }, 400);
    const v = parsed.data;
    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    if (v.action === 'request') {
      const auth = req.headers.get('Authorization') ?? '';
      const { data: u } = await db.auth.getUser(auth.replace(/^Bearer /, ''));
      if (!u?.user) return json({ error: 'Unauthorized' }, 401);
      const { data: roles } = await db.from('user_roles').select('role').eq('user_id', u.user.id).in('role', ['admin', 'manager']);
      if (!roles?.length) return json({ error: 'Managers only' }, 403);
      const { data: loc, error: le } = await db.from('project_locations').select('name,timezone').eq('id', v.location_id).single(); if (le) throw le;
      const zone = loc.timezone || 'America/Chicago';
      const sid = Deno.env.get('TWILIO_ACCOUNT_SID'), secret = Deno.env.get('TWILIO_AUTH_TOKEN'), from = Deno.env.get('TWILIO_PHONE_NUMBER');
      const site = (Deno.env.get('SITE_URL') || 'https://fairfieldrg.com').replace(/\/$/, '');
      const { data: people } = await db.from('personnel').select('id,first_name,last_name,phone').in('id', v.personnel_ids);
      const results: any[] = [];
      for (const pid of v.personnel_ids) {
        const p = people?.find((x: any) => x.id === pid); if (!p) { results.push({ personnel_id: pid, status: 'skipped', reason: 'Not found' }); continue; }
        const stays = await staysFor(db, pid, v.location_id, v.sheet_date, zone);
        if (!stays.length) { results.push({ personnel_id: pid, status: 'skipped', reason: 'No entry that day' }); continue; }
        if (stays.some((s: any) => s.signature_url)) { results.push({ personnel_id: pid, status: 'skipped', reason: 'Already signed' }); continue; }
        const digits = String(p.phone ?? '').replace(/\D/g, ''); const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
        if (!/^\d{10}$/.test(ten)) { results.push({ personnel_id: pid, status: 'no_phone' }); continue; }
        const { data: pending } = await db.from('timesheet_signature_requests').select('requested_at').eq('personnel_id', pid).eq('location_id', v.location_id).eq('sheet_date', v.sheet_date).eq('status', 'pending').gt('expires_at', new Date().toISOString()).maybeSingle();
        if (pending) { results.push({ personnel_id: pid, status: 'already_requested', requested_at: pending.requested_at }); continue; }
        // Expired pending rows are cancelled so the one-pending index allows a fresh link.
        await db.from('timesheet_signature_requests').update({ status: 'cancelled' }).eq('personnel_id', pid).eq('location_id', v.location_id).eq('sheet_date', v.sheet_date).eq('status', 'pending');
        const { data: row, error: ie } = await db.from('timesheet_signature_requests').insert({ personnel_id: pid, location_id: v.location_id, sheet_date: v.sheet_date, requested_by: u.user.id }).select('id,token,requested_at').single();
        if (ie) { results.push({ personnel_id: pid, status: ie.code === '23505' ? 'already_requested' : 'failed' }); continue; }
        const [y, m, d] = v.sheet_date.split('-');
        const body = `Please sign your timesheet for ${loc.name} on ${m}/${d}/${y}: ${site}/timesheet-sign/${row.token}`;
        let sms = 'unknown', err: string | null = null, ext: string | null = null;
        if (!sid || !secret || !from) { sms = 'failed'; err = 'Text service not configured'; }
        else try {
          const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${btoa(`${sid}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ To: `+1${ten}`, From: from, Body: body }) });
          const out = await r.json().catch(() => ({}));
          if (r.ok && out.sid) { sms = 'sent'; ext = out.sid; } else if (r.status < 500) { sms = 'failed'; err = `Text rejected (HTTP ${r.status})`; }
        } catch { /* ambiguous send stays unknown */ }
        await db.from('timesheet_signature_requests').update({ sms_status: sms, sms_error: err }).eq('id', row.id);
        // Audit copy omits the private link.
        await db.from('messages').insert({ recipient_type: 'personnel', recipient_id: pid, recipient_name: `${p.first_name} ${p.last_name}`, recipient_phone: `+1${ten}`, message_type: 'sms', direction: 'outbound', content: `Timesheet signature request for ${loc.name} ${v.sheet_date} (private link omitted)`, payload: { kind: 'timesheet-signature', request_id: row.id }, status: sms === 'sent' ? 'sent' : sms, external_id: ext, error_message: err, sent_by: u.user.id, sent_at: sms === 'sent' ? new Date().toISOString() : null });
        results.push({ personnel_id: pid, status: sms === 'failed' ? 'failed' : 'requested', requested_at: row.requested_at, reason: err });
      }
      return json({ results });
    }

    const { data: r, error: re } = await db.from('timesheet_signature_requests').select('id,personnel_id,location_id,sheet_date,status,expires_at').eq('token', v.token).maybeSingle(); if (re) throw re;
    if (!r || r.status === 'cancelled' || Date.parse(r.expires_at) <= Date.now()) return json({ error: 'Inactive link' }, 403);
    const [{ data: loc }, { data: p }] = await Promise.all([
      db.from('project_locations').select('name,timezone').eq('id', r.location_id).single(),
      db.from('personnel').select('first_name,last_name').eq('id', r.personnel_id).single(),
    ]);
    const zone = loc?.timezone || 'America/Chicago';
    const stays = await staysFor(db, r.personnel_id, r.location_id, r.sheet_date, zone);
    const signed = stays.some((s: any) => s.signature_url);
    if (v.action === 'info') return json({ name: `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim(), location: loc?.name, date: r.sheet_date, signed: signed || r.status === 'signed', stays: stays.map((s: any) => ({ in: hm(s.in_at, zone), out: hm(s.out_at, zone) })) });

    if (signed) { await db.from('timesheet_signature_requests').update({ status: 'signed', signed_at: new Date().toISOString() }).eq('id', r.id).eq('status', 'pending'); return json({ ok: true }); }
    const first = stays[0]; if (!first) return json({ error: 'No entry for that day' }, 409);
    const b64 = v.signature_png_base64.replace(/^data:image\/png;base64,/, '');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return json({ error: 'Signature required' }, 400);
    let bytes: Uint8Array; try { bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); } catch { return json({ error: 'Invalid signature' }, 400); }
    if (!validSignaturePng(bytes)) return json({ error: 'Invalid PNG' }, 400);
    const path = `field-signatures/${r.personnel_id}/${first.visit_personnel_id}.png`;
    const { error: ue } = await db.storage.from('project-documents').upload(path, bytes, { contentType: 'image/png', upsert: false });
    if (ue) { const { data: ex } = await db.storage.from('project-documents').download(path); if (!ex) return json({ error: 'Could not save signature' }, 409); }
    const now = new Date().toISOString();
    const { error: we } = await db.from('visit_personnel').update({ signature_url: path, signed_at: now }).eq('id', first.visit_personnel_id).is('signature_url', null); if (we) throw we;
    await db.from('timesheet_signature_requests').update({ status: 'signed', signed_at: now, visit_personnel_id: first.visit_personnel_id }).eq('id', r.id);
    return json({ ok: true });
  } catch (e) { console.error('timesheet-signature failed', e instanceof Error ? e.message : e); return json({ error: 'Signature service unavailable' }, 500); }
});
