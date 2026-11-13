import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { service, json } from '../_shared/signinJobs.ts';
const schema = z.object({ purpose: z.enum(['apply','edit','quick','photo','onboard','vendor']), token: z.string().min(16).max(200), bucket: z.enum(['application-files','form-uploads','personnel-photos','personnel-documents','vendor-documents']), folder: z.enum(['profile-photos','uploads','form-uploads','certifications','pending','documents']), type: z.enum(['image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']), bytes: z.string().min(8).max(21000000) }).strict();
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok',{headers:corsHeaders});
  if (req.method !== 'POST') return json({error:'Method not allowed'},405);
  try {
    const raw=await req.text(); if(raw.length>22000000)return json({error:'File too large'},400);
    const parsed=schema.safeParse(JSON.parse(raw)); if(!parsed.success)return json({error:'Invalid upload'},400);
    const v=parsed.data, db=service(); let valid=false;
    if(v.purpose==='apply'){const r=await db.from('job_postings').select('id').eq('public_token',v.token).eq('is_open',true).maybeSingle();valid=!!r.data;}
    if(v.purpose==='edit'){const r=await db.from('applications').select('id').eq('edit_token',v.token).gt('edit_token_expires_at',new Date().toISOString()).maybeSingle();valid=!!r.data;}
    if(v.purpose==='quick'){const r=await db.rpc('get_quick_apply_invite',{_token:v.token});valid=!!r.data?.valid&&!r.data?.used;}
    if(v.purpose==='photo'){const r=await db.rpc('get_photo_request_info',{_token:v.token});valid=!!r.data?.length;}
    if(v.purpose==='onboard'){const r=await db.rpc('validate_onboarding_token',{p_token:v.token});valid=r.data?.status==='valid';}
    if(v.purpose==='vendor'){const r=await db.rpc('get_vendor_onboarding_info',{p_token:v.token});valid=r.data?.status==='valid';}
    if(!valid)return json({error:'Upload link unavailable'},403);
    if(['apply','edit','quick','photo'].includes(v.purpose)&&!['application-files','form-uploads'].includes(v.bucket))return json({error:'Invalid bucket'},403);
    if(v.purpose==='photo'&&(!v.type.startsWith('image/')||v.folder!=='profile-photos'))return json({error:'Photo required'},400);
    const bytes=Uint8Array.from(atob(v.bytes),c=>c.charCodeAt(0));if(bytes.length>15*1024*1024)return json({error:'File too large'},400);
    const ext:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf','application/msword':'doc','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx'};
    const path=`${v.folder}/${crypto.randomUUID()}.${ext[v.type]}`;
    const {error}=await db.storage.from(v.bucket).upload(path,bytes,{contentType:v.type,upsert:false});if(error)throw error;
    const signed=await db.storage.from(v.bucket).createSignedUrl(path,600);if(signed.error)throw signed.error;
    // Durable references do not grant access; the bucket is private.
    return json({path,reference:db.storage.from(v.bucket).getPublicUrl(path).data.publicUrl,preview:signed.data.signedUrl});
  } catch {return json({error:'Upload unavailable'},400);}
});