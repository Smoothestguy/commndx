import { validSignaturePng } from './signatureRules.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
export async function kioskMedia(db: SupabaseClient, body: { token: string; personnel_id: string; stay_id: string; selfie: string; signature: string }) {
  const { data: token, error: te } = await db.from('kiosk_tokens').select('location_id,expires_at').eq('id', body.token).maybeSingle();
  if (te) throw te;
  if (!token || Date.parse(token.expires_at) <= Date.now()) return { status: 403, body: { error: 'Kiosk expired' } };
  const { data: assignment, error: ae } = await db.from('location_assignments').select('id').eq('location_id', token.location_id).eq('personnel_id', body.personnel_id).eq('status', 'active').limit(1).maybeSingle();
  if (ae) throw ae;
  if (!assignment) return { status: 403, body: { error: 'Person is not on this roster' } };
  const { data: stay, error: se } = await db.from('personnel_location_trail').select('in_at,out_at,actual_in_at,signature_url,visit_personnel_id').eq('visit_personnel_id', body.stay_id).eq('location_id', token.location_id).eq('personnel_id', body.personnel_id).maybeSingle();
  if (se) throw se;
  if (!stay || stay.out_at || Math.abs(Date.now() - Date.parse(stay.actual_in_at||stay.in_at)) > 15 * 60000) return { status: 409, body: { error: 'Matching open check-in unavailable' } };
  let selfie: Uint8Array, signature: Uint8Array;
  try { selfie = Uint8Array.from(atob(body.selfie), c => c.charCodeAt(0)); signature = Uint8Array.from(atob(body.signature), c => c.charCodeAt(0)); }
  catch { return { status: 400, body: { error: 'Invalid image' } }; }
  if (selfie.length > 1500000 || selfie.length < 100 || selfie[0] !== 255 || selfie[1] !== 216 || selfie[2] !== 255 || !validSignaturePng(signature)) return { status: 400, body: { error: 'Selfie must be JPEG under 1.5 MB and signature a PNG under 200 KB' } };
  // field-captures is public: keep biometric-adjacent evidence in an existing private bucket.
  const selfiePath = `field-captures/kiosk/${token.location_id}/${body.stay_id}/selfie.jpg`;
  const signaturePath = `field-captures/kiosk/${token.location_id}/${body.stay_id}/signature.png`;
  for (const [path, bytes, contentType] of [[selfiePath, selfie, 'image/jpeg'], [signaturePath, signature, 'image/png']] as const) {
    const { error } = await db.storage.from('project-documents').upload(path, bytes, { contentType, upsert: false });
    if (error) { const { data: existing, error: readError } = await db.storage.from('project-documents').download(path); if (readError || !existing) return { status: 409, body: { ok: false, reason: 'media_pending', stay_id: body.stay_id } }; const prior=new Uint8Array(await existing.arrayBuffer());if(prior.length!==bytes.length||prior.some((value,i)=>value!==bytes[i]))return {status:409,body:{error:'Accepted evidence cannot be replaced'}}; }
  }
  const { error: ue } = await db.from('visit_personnel').update({ selfie_url: selfiePath }).eq('id', body.stay_id).is('selfie_url', null);
  if (ue) throw ue;
  const { error: sigError } = await db.from('visit_personnel').update({ signature_url: signaturePath, signed_at: new Date().toISOString() }).eq('id', body.stay_id).is('signature_url', null);
  if (sigError) throw sigError;
  return { status: 200, body: { ok: true, stay_id: body.stay_id } };
}