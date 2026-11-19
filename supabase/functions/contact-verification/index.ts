import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { service, json } from '../_shared/signinJobs.ts';
import { normalizeContact, codeMessage, hashCode, CODE_TTL_MS, MAX_ATTEMPTS, MAX_SENDS_PER_HOUR } from '../_shared/contactVerification.ts';

const context = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('onboarding'), token: z.string().min(8).max(200) }),
  z.object({ kind: z.literal('registration'), invite_token: z.string().max(200).optional() }),
  z.object({ kind: z.literal('apply'), posting_id: z.string().uuid(), posting_token: z.string().max(200).optional(), agency_token: z.string().uuid().optional() }),
]);
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('send'), context, contact_type: z.enum(['email', 'phone']), contact: z.string().min(3).max(255), lang: z.enum(['en', 'es']).optional() }),
  z.object({ action: z.literal('verify'), verification_id: z.string().uuid(), code: z.string().regex(/^\d{6}$/) }),
]);

async function contextValid(db: ReturnType<typeof service>, c: z.infer<typeof context>) {
  if (c.kind === 'onboarding') { const r = await db.rpc('onboarding_link_channel', { p_token: c.token }); return !r.error && !!r.data; }
  if (c.kind === 'registration') return true; // public registration portal; protected by per-contact limits
  let q = db.from('job_postings').select('id').eq('id', c.posting_id).eq('is_open', true);
  if (c.agency_token) { const v = await db.from('vendors').select('id').eq('signup_token', c.agency_token).eq('status', 'active').maybeSingle(); if (!v.data) return false; }
  else if (c.posting_token) q = q.eq('public_token', c.posting_token); else return false;
  const p = await q.maybeSingle(); return !!p.data;
}

async function deliver(type: 'email' | 'phone', to: string, text: string): Promise<boolean> {
  try {
    if (type === 'email') {
      const key = Deno.env.get('RESEND_API_KEY'); if (!key) return false;
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Fairfield Response Group <admin@fairfieldrg.com>', to: [to], subject: 'Fairfield verification code / Código de verificación', text }) });
      if (!r.ok) console.error('Email code failed', r.status, await r.text());
      return r.ok;
    }
    const sid = Deno.env.get('TWILIO_ACCOUNT_SID'), tok = Deno.env.get('TWILIO_AUTH_TOKEN'), from = Deno.env.get('TWILIO_PHONE_NUMBER');
    if (!sid || !tok || !from) return false;
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${sid}:${tok}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: `+1${to}`, From: from, Body: text }) });
    if (!r.ok) console.error('SMS code failed', r.status, await r.text());
    return r.ok;
  } catch (e) { console.error('Code delivery error', (e as Error).message); return false; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: 'Invalid request' }, 400);
    const v = parsed.data, db = service();

    if (v.action === 'send') {
      const contact = normalizeContact(v.contact_type, v.contact);
      if (!contact) return json({ error: 'Invalid contact' }, 400);
      if (!(await contextValid(db, v.context))) return json({ error: 'Link unavailable' }, 403);
      const since = new Date(Date.now() - 3600_000).toISOString();
      const recent = await db.from('contact_verification_codes').select('id', { count: 'exact', head: true }).eq('contact_type', v.contact_type).eq('contact', contact).gte('created_at', since);
      if (recent.error) throw recent.error;
      if ((recent.count ?? 0) >= MAX_SENDS_PER_HOUR) return json({ sent: false, reason: 'rate_limited' });
      if (v.contact_type === 'phone') {
        const opt = await db.from('applicants').select('id').eq('phone', contact).eq('sms_opted_out', true).limit(1);
        if (opt.data?.length) return json({ sent: false, reason: 'unavailable' });
      }
      const id = crypto.randomUUID();
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
      const ins = await db.from('contact_verification_codes').insert({ id, contact_type: v.contact_type, contact, purpose: v.context.kind, code_hash: await hashCode(id, code), expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(), send_status: 'pending' });
      if (ins.error) throw ins.error;
      const ok = await deliver(v.contact_type, contact, codeMessage(code));
      await db.from('contact_verification_codes').update({ send_status: ok ? 'sent' : 'failed' }).eq('id', id);
      return json(ok ? { sent: true, verification_id: id } : { sent: false, reason: 'unavailable' });
    }

    const row = await db.from('contact_verification_codes').select('*').eq('id', v.verification_id).maybeSingle();
    if (row.error) throw row.error;
    const r = row.data;
    if (!r || r.verified_at || r.consumed_at) return json({ verified: false, reason: 'invalid' });
    if (new Date(r.expires_at).getTime() < Date.now()) return json({ verified: false, reason: 'expired' });
    if (r.attempts >= MAX_ATTEMPTS) return json({ verified: false, reason: 'too_many_attempts' });
    const match = (await hashCode(r.id, v.code)) === r.code_hash;
    const upd = await db.from('contact_verification_codes').update(match ? { attempts: r.attempts + 1, verified_at: new Date().toISOString() } : { attempts: r.attempts + 1 }).eq('id', r.id).eq('attempts', r.attempts);
    if (upd.error) throw upd.error;
    if (!match) return json({ verified: false, reason: r.attempts + 1 >= MAX_ATTEMPTS ? 'too_many_attempts' : 'wrong_code', attempts_left: Math.max(0, MAX_ATTEMPTS - r.attempts - 1) });
    return json({ verified: true, proof_id: r.id });
  } catch (e) {
    console.error('contact-verification failed', (e as Error).message);
    return json({ error: 'Verification unavailable' }, 500);
  }
});
