import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { validSignaturePng } from '../_shared/signatureRules.ts';
import { localDay, unsignedDates } from '../_shared/signatureBundle.ts';

// Location catch-up links: staff create/list/revoke; the public page is scoped on every call to one
// live link, to that location's roster (active, or anyone with unsigned worked days there), and to the
// chosen person's own unsigned days + phone confirmation. No times editing, no dollars.
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const hm = (iso: string | null, zone: string) => iso ? new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)).replace(':', '') : null;
const id = z.string().uuid(), date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), location_id: id }),
  z.object({ action: z.literal('list'), location_id: id }),
  z.object({ action: z.literal('revoke'), link_id: id }),
  z.object({ action: z.literal('search'), token: id, q: z.string().trim().min(2).max(60) }),
  z.object({ action: z.literal('items'), token: id, personnel_id: id }),
  z.object({ action: z.literal('sign'), token: id, personnel_id: id, date, signature_png_base64: z.string().max(280000) }),
  z.object({ action: z.literal('phone'), token: id, personnel_id: id, confirm: z.literal(true).optional(), phone: z.string().max(20).optional() }),
]);
const ten = (p: unknown) => { const d = String(p ?? '').replace(/\D/g, ''); const t = d.length === 11 && d.startsWith('1') ? d.slice(1) : d; return /^\d{10}$/.test(t) ? t : null; };
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const parsed = schema.safeParse(await req.json()); if (!parsed.success) return json({ error: 'Invalid request' }, 400);
    const v = parsed.data;
    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    if (v.action === 'create' || v.action === 'list' || v.action === 'revoke') {
      const { data: u } = await db.auth.getUser((req.headers.get('Authorization') ?? '').replace(/^Bearer /, ''));
      if (!u?.user) return json({ error: 'Unauthorized' }, 401);
      const { data: roles } = await db.from('user_roles').select('role').eq('user_id', u.user.id).in('role', ['admin', 'manager']);
      if (!roles?.length) return json({ error: 'Managers only' }, 403);
      if (v.action === 'create') {
        const { data, error } = await db.from('catchup_links').insert({ location_id: v.location_id, created_by: u.user.id }).select('id,expires_at,created_at').single(); if (error) throw error;
        await db.from('audit_logs').insert({ user_id: u.user.id, user_email: u.user.email ?? 'staff', action_type: 'catchup_link_create', resource_type: 'catchup_link', resource_id: data.id, metadata: { location_id: v.location_id }, success: true });
        return json({ link: data });
      }
      if (v.action === 'list') {
        const { data, error } = await db.from('catchup_links').select('id,expires_at,created_at').eq('location_id', v.location_id).is('revoked_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }); if (error) throw error;
        return json({ links: data });
      }
      const { error } = await db.from('catchup_links').update({ revoked_at: new Date().toISOString(), revoked_by: u.user.id }).eq('id', v.link_id).is('revoked_at', null); if (error) throw error;
      await db.from('audit_logs').insert({ user_id: u.user.id, user_email: u.user.email ?? 'staff', action_type: 'catchup_link_revoke', resource_type: 'catchup_link', resource_id: v.link_id, success: true });
      return json({ ok: true });
    }

    // ---- Public, token-scoped ----
    const { data: link } = await db.from('catchup_links').select('id,location_id,expires_at,revoked_at').eq('id', v.token).maybeSingle();
    if (!link || link.revoked_at || Date.parse(link.expires_at) <= Date.now()) return json({ error: 'Inactive link' }, 403);
    const { data: loc, error: le } = await db.from('project_locations').select('name,timezone,project_id').eq('id', link.location_id).single(); if (le) throw le;
    const zone = loc.timezone || 'America/Chicago';
    const since = new Date(Date.now() - 120 * 864e5).toISOString();
    const stays = async (pid: string) => { const { data, error } = await db.from('personnel_location_trail').select('visit_personnel_id,in_at,out_at,signature_url').eq('personnel_id', pid).eq('location_id', link.location_id).gte('in_at', since).order('in_at'); if (error) throw error; return (data ?? []) as any[]; };
    // Eligibility: active on this location's roster, or has unsigned worked days here.
    const eligible = async (pid: string) => {
      const { data } = await db.from('location_assignments').select('status').eq('location_id', link.location_id).eq('personnel_id', pid);
      if (data?.some((r: any) => r.status === 'active')) return true;
      return (await stays(pid)).some(s => s.visit_personnel_id); // worked here recently (search still lists only open items)
    };
    const audit = (pid: string, action: string, extra: Record<string, unknown>) => db.from('audit_logs').insert({ user_email: 'catchup-link', action_type: action, resource_type: 'personnel', resource_id: pid, metadata: { signed_via: 'catchup_link', link_id: link.id, location_id: link.location_id, ...extra }, success: true });

    if (v.action === 'search') {
      const { data: rows, error } = await db.from('location_assignments').select('personnel_id,status,personnel:personnel_id(first_name,last_name)').eq('location_id', link.location_id); if (error) throw error;
      const words = norm(v.q).split(/\s+/).filter(Boolean);
      const seen = new Set<string>(), out: any[] = [];
      for (const r of (rows ?? []) as any[]) {
        if (seen.has(r.personnel_id) || !r.personnel) continue;
        const name = `${r.personnel.first_name ?? ''} ${r.personnel.last_name ?? ''}`.trim();
        if (!words.every(w => norm(name).includes(w))) continue;
        seen.add(r.personnel_id);
        if (r.status !== 'active' && !(rows as any[]).some(x => x.personnel_id === r.personnel_id && x.status === 'active') && !unsignedDates(await stays(r.personnel_id), zone).length) continue;
        out.push({ id: r.personnel_id, name }); if (out.length >= 8) break;
      }
      return json({ location: loc.name, people: out });
    }

    if (!(await eligible(v.personnel_id))) return json({ error: 'Not on this location' }, 403);
    const { data: p, error: pe } = await db.from('personnel').select('first_name,last_name,phone,onboarding_status,phone_confirmed_at').eq('id', v.personnel_id).single(); if (pe) throw pe;

    if (v.action === 'items') {
      const all = await stays(v.personnel_id); const dates = unsignedDates(all, zone);
      const digits = ten(p.phone);
      return json({ name: `${p.first_name} ${p.last_name}`.trim(), location: loc.name, onboarding_pending: !!p.onboarding_status && p.onboarding_status !== 'completed',
        phone_last4: digits ? digits.slice(-4) : null, phone_confirmed: !!p.phone_confirmed_at,
        days: dates.map(d => ({ date: d, stays: all.filter(s => s.in_at && localDay(s.in_at, zone) === d).map(s => ({ in: hm(s.in_at, zone), out: hm(s.out_at, zone) })) })) });
    }

    if (v.action === 'sign') {
      const day = (await stays(v.personnel_id)).filter(s => s.in_at && s.visit_personnel_id && localDay(s.in_at, zone) === v.date);
      if (!day.length) return json({ error: 'No entry for that day' }, 409);
      if (day.some(s => s.signature_url)) return json({ ok: true, date: v.date }); // first signed stay stays
      const { data: locked } = await db.from('signin_sheet_days').select('id').eq('location_id', link.location_id).eq('sheet_date', v.date).eq('status', 'locked');
      if (locked?.length) return json({ error: 'This day is locked. Ask a manager.' }, 409);
      const b64 = v.signature_png_base64.replace(/^data:image\/png;base64,/, '');
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return json({ error: 'Signature required' }, 400);
      let bytes: Uint8Array; try { bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); } catch { return json({ error: 'Invalid signature' }, 400); }
      if (!validSignaturePng(bytes)) return json({ error: 'Invalid PNG' }, 400);
      const first = day[0];
      const path = `field-signatures/${v.personnel_id}/${first.visit_personnel_id}.png`;
      const { error: ue } = await db.storage.from('project-documents').upload(path, bytes, { contentType: 'image/png', upsert: false });
      if (ue) { const { data: ex } = await db.storage.from('project-documents').download(path); if (!ex) return json({ error: 'Could not save signature' }, 409); }
      const { error: we } = await db.from('visit_personnel').update({ signature_url: path, signed_at: new Date().toISOString() }).eq('id', first.visit_personnel_id).is('signature_url', null); if (we) throw we;
      // Fulfil any pending texted request for this person/location once all its dates are signed.
      const left = unsignedDates(await stays(v.personnel_id), zone);
      const { data: reqs } = await db.from('timesheet_signature_requests').select('id,dates,sheet_date').eq('personnel_id', v.personnel_id).eq('location_id', link.location_id).eq('status', 'pending');
      const done = (reqs ?? []).filter((r: any) => !((r.dates?.length ? r.dates : [r.sheet_date]) as string[]).some(d => left.includes(d))).map((r: any) => r.id);
      if (done.length) await db.from('timesheet_signature_requests').update({ status: 'signed', signed_at: new Date().toISOString() }).in('id', done);
      await audit(v.personnel_id, 'catchup_sign', { date: v.date, visit_personnel_id: first.visit_personnel_id });
      return json({ ok: true, date: v.date });
    }

    // phone
    const now = new Date().toISOString();
    if (v.confirm) {
      if (!ten(p.phone)) return json({ error: 'No phone on file' }, 400);
      const { error } = await db.from('personnel').update({ phone_confirmed_at: now }).eq('id', v.personnel_id); if (error) throw error;
      await audit(v.personnel_id, 'catchup_phone_confirm', { phone_last4: ten(p.phone)!.slice(-4) });
      return json({ ok: true });
    }
    const next = ten(v.phone); if (!next) return json({ error: 'Enter a 10-digit phone number' }, 400);
    const { data: clash } = await db.from('personnel').select('id').neq('id', v.personnel_id).ilike('phone', `%${next}`).limit(1);
    if (clash?.length) return json({ error: 'That number belongs to another worker. Ask a manager.' }, 409);
    const prev = ten(p.phone);
    const { error } = await db.from('personnel').update({ phone: next, phone_confirmed_at: now }).eq('id', v.personnel_id); if (error) throw error;
    await audit(v.personnel_id, 'catchup_phone_change', { previous_last4: prev?.slice(-4) ?? null, new_last4: next.slice(-4) });
    return json({ ok: true, phone_last4: next.slice(-4) });
  } catch (e) { console.error('catchup-link failed', e instanceof Error ? e.message : e); return json({ error: 'Service unavailable' }, 500); }
});
