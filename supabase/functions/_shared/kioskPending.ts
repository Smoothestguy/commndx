import { validSignaturePng } from './signatureRules.ts';

const encoder = new TextEncoder();
const day = (at: string, zone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
const key = () => crypto.subtle.importKey('raw', encoder.encode(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
export async function pendingProof(token: string, location: string, person: string) {
  const payload = btoa(JSON.stringify({ token, location, person, until: Date.now() + 5 * 60000, nonce: crypto.randomUUID() }));
  return `${payload}.${hex(await crypto.subtle.sign('HMAC', await key(), encoder.encode(payload)))}`;
}
async function verify(proof: string, token: string, location: string) {
  const [payload, sig] = proof.split('.');
  if (!payload || !/^[a-f0-9]{64}$/.test(sig || '')) throw new Error('Identify and punch again to view your items');
  const bytes = new Uint8Array(sig.match(/../g)?.map(x => parseInt(x, 16)) ?? []);
  if (!await crypto.subtle.verify('HMAC', await key(), bytes, encoder.encode(payload))) throw new Error('Invalid kiosk session');
  const p = JSON.parse(atob(payload));
  if (p.token !== token || p.location !== location || p.until <= Date.now() || typeof p.person !== 'string') throw new Error('Kiosk session expired');
  return p.person as string;
}
export function pendingItems(stays: any[], requests: any[], zone: string, now: string) {
  const byDay = new Map<string, any[]>();
  for (const s of stays) { const date = day(s.in_at, zone); byDay.set(date, [...byDay.get(date) ?? [], s]); }
  const items: { id: string; type: 'signature' | 'checkout' | 'late'; date: string; in_at: string; out_at: string | null; requested?: boolean }[] = [];
  for (const [date, rows] of byDay) {
    const request = requests.some(r => r.sheet_date === date && r.status === 'pending');
    if (!rows.some(s => s.signature_url) || request) items.push({ id: rows[0].visit_personnel_id, type: 'signature', date, in_at: rows[0].in_at, out_at: rows.at(-1)?.out_at ?? null, requested: request });
    for (const s of rows) {
      if (!s.out_at && date < day(now, zone)) items.push({ id: s.visit_personnel_id, type: 'checkout', date, in_at: s.in_at, out_at: null });
      if (Number(s.late_minutes) > 0 && !s.late_reason?.trim()) items.push({ id: s.visit_personnel_id, type: 'late', date, in_at: s.in_at, out_at: s.out_at });
    }
  }
  return items;
}
async function writable(db: any, projectId: string, locationId: string, s: any, zone: string, outAt?: string) {
  const dates = new Set<string>();
  for (const tz of [zone, 'America/Chicago']) {
    const end = day(outAt || s.out_at || s.in_at, tz);
    for (let date = day(s.in_at, tz), i = 0; date <= end && i < 370; i++) { dates.add(date); date = new Date(Date.parse(date + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10); }
  }
  const weeks = [...dates].map(d => { const at = new Date(d + 'T12:00:00Z'); at.setUTCDate(at.getUTCDate() - (at.getUTCDay() + 6) % 7); return at.toISOString().slice(0, 10); });
  const [sheets, closed, entries] = await Promise.all([
    db.from('signin_sheet_days').select('id').eq('location_id', locationId).in('sheet_date', [...dates]).eq('status', 'locked'),
    db.from('week_closeouts').select('id').eq('project_id', projectId).in('week_start', [...new Set(weeks)]),
    db.from('time_entries').select('is_locked,invoice_id').eq('visit_personnel_id', s.visit_personnel_id),
  ]);
  for (const r of [sheets, closed, entries]) if (r.error) throw r.error;
  if (sheets.data?.length || closed.data?.length || entries.data?.some((e: any) => e.is_locked || e.invoice_id)) throw new Error('This day or week is locked. Ask a manager to reopen it.');
}
export async function kioskPending(db: any, v: any, locationId: string, projectId: string, zone: string) {
  const person = await verify(v.proof, v.token, locationId);
  const rows:any[]=[];
  for(let offset=0;;offset+=500){const result=await db.from('personnel_location_trail').select('visit_personnel_id,in_at,out_at,signature_url').eq('location_id',locationId).eq('personnel_id',person).order('in_at').order('visit_personnel_id').range(offset,offset+499);if(result.error)throw result.error;rows.push(...result.data??[]);if((result.data??[]).length<500)break;}
  const ids=rows.map(r=>r.visit_personnel_id),meta:any[]=[];
  for(let offset=0;offset<ids.length;offset+=200){const result=await db.from('visit_personnel').select('id,late_minutes,late_reason').in('id',ids.slice(offset,offset+200));if(result.error)throw result.error;meta.push(...result.data??[]);}
  const stays=rows.map(s=>({...s,...meta.find(m=>m.id===s.visit_personnel_id)}));
  const requests = await db.from('timesheet_signature_requests').select('sheet_date,status').eq('personnel_id', person).eq('location_id', locationId).eq('status', 'pending'); if (requests.error) throw requests.error;
  const items = pendingItems(stays, requests.data ?? [], zone, new Date().toISOString());
  if (v.action === 'pending') return { ok: true, items };
  const item = items.find(i => i.id === v.stay_id && i.type === v.kind);
  const s = stays.find((s: any) => s.visit_personnel_id === v.stay_id);
  if (!item || !s) return { ok: true, items }; // Already completed; never punch again.
  await writable(db, projectId, locationId, s, zone, v.kind === 'checkout' ? v.out_at : undefined);
  const now = new Date().toISOString();
  if (v.kind === 'signature') {
    const dayRows = stays.filter((r: any) => day(r.in_at, zone) === item.date);
    let signed = dayRows.find((r: any) => r.signature_url);
    if (!signed) {
      const b64 = (v.signature || '').replace(/^data:image\/png;base64,/, '');
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); if (!validSignaturePng(bytes)) throw new Error('Signature required');
      const first = dayRows[0], path = `kiosk-day-signatures/${locationId}/${first.visit_personnel_id}/${crypto.randomUUID()}.png`;
      const upload = await db.storage.from('project-documents').upload(path, bytes, { contentType: 'image/png', upsert: false }); if (upload.error) throw upload.error;
      const saved = await db.from('visit_personnel').update({ signature_url: path, signed_at: now }).eq('id', first.visit_personnel_id).is('signature_url', null).select('id'); if (saved.error) throw saved.error;
      if (!saved.data?.length) { await db.storage.from('project-documents').remove([path]); } // Only this unused newly created file.
      signed = first;
    }
    const fulfilled = await db.from('timesheet_signature_requests').update({ status: 'signed', signed_at: now, visit_personnel_id: signed.visit_personnel_id }).eq('personnel_id', person).eq('location_id', locationId).eq('sheet_date', item.date).eq('status', 'pending'); if (fulfilled.error) throw fulfilled.error;
  } else if (v.kind === 'late') {
    if (!v.reason?.trim()) throw new Error('Late reason required');
    let query = db.from('visit_personnel').update({ late_reason: v.reason.trim() }).eq('id', s.visit_personnel_id).eq('personnel_id', person);
    query = s.late_reason === null ? query.is('late_reason', null) : query.eq('late_reason', s.late_reason);
    const result = await query.select('id');
    if (result.error) throw result.error;
  } else {
    if (!v.confirm || !v.reason?.trim() || !Number.isFinite(Date.parse(v.out_at)) || Date.parse(v.out_at) <= Date.parse(s.in_at) || Date.parse(v.out_at) > Date.now()) throw new Error('Confirm a valid past check-out time and reason');
    const result = await db.from('visit_personnel').update({ checked_out_at: v.out_at }).eq('id', s.visit_personnel_id).eq('personnel_id', person).is('checked_out_at', null).select('id'); if (result.error) throw result.error;
    // This is a correction submitted by the worker, never a forged supervisor approval.
    const visit = await db.from('visit_personnel').select('visit_id').eq('id', s.visit_personnel_id).single(); if (visit.error) throw visit.error;
    const review = await db.from('location_visits').update({ needs_review: true }).eq('id', visit.data.visit_id); if (review.error) throw review.error;
  }
  const audit = await db.from('audit_logs').insert({ user_email: 'kiosk-worker', action_type: `kiosk_pending_${v.kind}`, resource_type: 'visit_personnel', resource_id: s.visit_personnel_id, changes_after: { out_at: v.out_at ?? null, reason: v.reason ?? null }, metadata: { location_id: locationId, project_id: projectId, personnel_id: person, supervisor_review_required: v.kind === 'checkout' }, success: true }); if (audit.error) throw audit.error;
  return { ok: true };
}