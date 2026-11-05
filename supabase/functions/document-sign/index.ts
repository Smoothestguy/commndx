// Public PDF review/signing uses an opaque expiring token; tables and documents remain private.
// Only authenticated staff (admin/manager/user) may issue or remind signature requests.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { canSendSignatures, signatureExpired, validSignaturePng } from './rules.ts';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('info'), token: z.string().uuid() }),
  z.object({ action: z.literal('sign'), token: z.string().uuid(), signature_png_base64: z.string().min(1).max(280000), sign_name: z.string().trim().min(1).max(150), lat: z.number().min(-90).max(90).nullable().optional(), lng: z.number().min(-180).max(180).nullable().optional() }),
  z.object({ action: z.literal('send'), document_id: z.string().uuid(), personnel_ids: z.array(z.string().uuid()).min(1).max(100) }),
]);
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const raw = req.method === 'GET' ? Object.fromEntries(new URL(req.url).searchParams) : await req.json();
    const parsed = input.safeParse(raw);
    if (!parsed.success) return json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
    const body = parsed.data;
    const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return json({ error: 'Signing service unavailable' }, 503);
    const db = createClient(url, key);
    if (body.action === 'send') {
      const auth = req.headers.get('Authorization');
      if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
      const { data, error } = await db.auth.getClaims(auth.slice(7));
      if (error || !data?.claims?.sub) return json({ error: 'Unauthorized' }, 401);
      const uid = data.claims.sub;
      const { data: roles, error: roleError } = await db.from('user_roles').select('role').eq('user_id', uid);
      if (roleError) throw roleError;
      if (!canSendSignatures((roles || []).map(r => r.role))) return json({ error: 'Forbidden' }, 403);
      const { data: doc, error: docError } = await db.from('project_documents').select('id,file_name,requires_signature,file_type').eq('id', body.document_id).maybeSingle();
      if (docError) throw docError;
      if (!doc) return json({ error: 'Document not found' }, 404);
      if (!doc.requires_signature || !doc.file_type?.includes('pdf')) return json({ error: 'Document must be a signature-required PDF' }, 400);
      const sid = Deno.env.get('TWILIO_ACCOUNT_SID'), secret = Deno.env.get('TWILIO_AUTH_TOKEN'), from = Deno.env.get('TWILIO_PHONE_NUMBER');
      if (!sid || !secret || !from) return json({ error: 'Twilio not configured' }, 503);
      const site = (Deno.env.get('SITE_URL') || 'https://fairfieldrg.com').replace(/\/$/, '');
      const ids = [...new Set(body.personnel_ids)];
      const { data: people, error: peopleError } = await db.from('personnel').select('id,phone,applicant_id').in('id', ids);
      if (peopleError) throw peopleError;
      const results = [];
      for (const pid of ids) {
        const person = people?.find(p => p.id === pid);
        if (!person) { results.push({ personnel_id: pid, status: 'failed', reason: 'Person not found' }); continue; }
        const { error: insertError } = await db.from('document_signatures').upsert({ document_id: doc.id, personnel_id: pid, created_by: uid }, { onConflict: 'document_id,personnel_id', ignoreDuplicates: true });
        if (insertError) { results.push({ personnel_id: pid, status: 'failed', reason: insertError.message }); continue; }
        const { data: signature, error: sigError } = await db.from('document_signatures').select('id,status').eq('document_id', doc.id).eq('personnel_id', pid).single();
        if (sigError) { results.push({ personnel_id: pid, status: 'failed', reason: sigError.message }); continue; }
        if (signature.status !== 'pending') { results.push({ personnel_id: pid, status: signature.status }); continue; }
        const digits = String(person.phone || '').replace(/\D/g, '');
        const phone = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : /^\+[1-9]\d{7,14}$/.test(String(person.phone)) ? person.phone : null;
        if (!phone) { results.push({ personnel_id: pid, status: 'failed', reason: 'No valid phone' }); continue; }
        const { data: renewed, error: renewError } = await db.from('document_signatures').update({ expires_at: new Date(Date.now() + 30 * 86400000).toISOString() }).eq('id', signature.id).eq('status', 'pending').select('id').maybeSingle();
        if (renewError || !renewed) { results.push({ personnel_id: pid, status: 'failed', reason: renewError?.message || 'Status changed' }); continue; }
        const message = `FRG: ${doc.file_name} needs your signature. Review and sign here: ${site}/sign/${signature.id}`;
        let status = 'sent', reason: string | null = null, twilioSid: string | null = null;
        try {
          const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${btoa(`${sid}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ To: phone, From: from, Body: message }) });
          if (!response.ok) { reason = `[${response.status}]: ${await response.text()}`; status = 'failed'; console.error('Document SMS failed', reason); }
          else { const sent = await response.json(); twilioSid = sent.sid; const { error: stampError } = await db.from('document_signatures').update({ sent_at: new Date().toISOString() }).eq('id', signature.id); if (stampError) console.error('SMS timestamp failed', stampError.message); }
        } catch (e) { status = 'failed'; reason = String(e); }
        if (person.applicant_id) {
          const { error: logError } = await db.from('applicant_messages').insert({ applicant_id: person.applicant_id, channel: 'sms', body: message, status, error: reason, twilio_sid: twilioSid, created_by: uid });
          if (logError) console.error('Document SMS log failed', logError.message);
        }
        results.push({ personnel_id: pid, status, reason });
      }
      return json({ results });
    }
    const { data: signature, error: sigError } = await db.from('document_signatures').select('*').eq('id', body.token).maybeSingle();
    if (sigError) throw sigError;
    if (!signature || !['pending', 'signed'].includes(signature.status)) return json({ error: 'Signature link not available' }, 404);
    if (signatureExpired(signature.expires_at)) return json({ error: 'Signature link expired' }, 410);
    if (body.action === 'info') {
      const [{ data: doc, error: docError }, { data: person, error: personError }, { count: fieldCount, error: fieldError }] = await Promise.all([
        db.from('project_documents').select('file_name,file_path,notes').eq('id', signature.document_id).single(),
        db.from('personnel').select('first_name').eq('id', signature.personnel_id).single(),
        // Reveal only field presence after token validation, never anonymous table access.
        db.from('document_sign_fields').select('id', { count: 'exact', head: true }).eq('document_id', signature.document_id),
      ]);
      if (docError || personError || fieldError) throw docError || personError || fieldError;
      const { data: pdf, error: pdfError } = await db.storage.from('project-documents').createSignedUrl(doc.file_path, 3600);
      if (pdfError) throw pdfError;
      return json({ first_name: person.first_name, title: doc.file_name, notes: doc.notes, already_signed: signature.status === 'signed', signed_at: signature.signed_at, pdf_url: pdf.signedUrl, has_fields: (fieldCount || 0) > 0 });
    }
    if (signature.status === 'signed') return json({ ok: true, signed_at: signature.signed_at });
    const base64 = body.signature_png_base64.replace(/^data:image\/png;base64,/, '');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return json({ error: 'Invalid PNG' }, 400);
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0)); } catch { return json({ error: 'Invalid PNG' }, 400); }
    if (!validSignaturePng(bytes)) return json({ error: 'Signature must be a PNG under 200KB' }, 400);
    const path = `doc-signatures/${signature.document_id}/${signature.personnel_id}.png`;
    // Never overwrite an accepted signature, including concurrent/retried submissions.
    // field-captures is publicly readable in this project. Use the existing private
    // project-documents bucket for signature evidence without changing schema/policies.
    const { error: uploadError } = await db.storage.from('project-documents').upload(path, bytes, { contentType: 'image/png', upsert: false });
    if (uploadError) {
      const { data: current } = await db.from('document_signatures').select('status,signed_at').eq('id', signature.id).single();
      if (current?.status === 'signed') return json({ ok: true, signed_at: current.signed_at });
      return json({ error: 'Signature could not be saved. Please try again or contact the office.' }, 409);
    }
    const { data: saved, error: saveError } = await db.from('document_signatures').update({ status: 'signed', signed_at: new Date().toISOString(), signature_url: path, sign_name: body.sign_name, sign_lat: body.lat ?? null, sign_lng: body.lng ?? null }).eq('id', signature.id).eq('status', 'pending').gt('expires_at', new Date().toISOString()).select('signed_at').maybeSingle();
    if (saveError || !saved) {
      const { data: current } = await db.from('document_signatures').select('status,signed_at').eq('id', signature.id).single();
      if (current?.status === 'signed') return json({ ok: true, signed_at: current.signed_at });
      await db.storage.from('project-documents').remove([path]);
      if (saveError) throw saveError;
      return json({ error: 'Link expired or status changed' }, 409);
    }
    return json({ ok: true, signed_at: saved.signed_at });
  } catch (e) { console.error('document-sign', e); return json({ error: 'Unable to process document request' }, 500); }
});
