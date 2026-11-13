import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { service,json } from '../_shared/signinJobs.ts';
const schema=z.object({token:z.string().min(16).max(200),applicant:z.object({first_name:z.string().min(1).max(100),last_name:z.string().min(1).max(100),email:z.string().email().max(255),phone:z.string().max(40),home_zip:z.string().max(20).optional(),photo_url:z.string().max(2000).optional()}).optional(),answers:z.record(z.unknown()).optional()}).strict();
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{const raw=await req.text();if(raw.length>300000)return json({error:'Request too large'},400);const p=schema.safeParse(JSON.parse(raw));if(!p.success)return json({error:'Invalid edit request'},400);const db=service(),v=p.data;
 if(v.applicant){if(!v.answers)return json({error:'Answers required'},400);const r=await db.rpc('edit_application_by_token',{p_token:v.token,p_applicant:v.applicant,p_answers:v.answers});if(r.error)return json({error:'Edit link unavailable or invalid details'},400);return json(r.data);}
 const r=await db.from('applications').select('id,applicant_id,answers,status,missing_fields,admin_message,edit_token_expires_at,applicants(id,first_name,last_name,email,phone,home_zip,photo_url),job_postings(form_template_id,project_task_orders(title,projects:project_id(name)))').eq('edit_token',v.token).gt('edit_token_expires_at',new Date().toISOString()).maybeSingle();if(!r.data)return json({error:'Edit link unavailable'},404);
 const app=r.data as any;const ref=app.applicants?.photo_url;if(ref){const m=ref.match(/\/storage\/v1\/object\/(?:public|sign)\/(application-files|form-uploads|personnel-photos)\/([^?]+)/);if(m){const signed=await db.storage.from(m[1]).createSignedUrl(decodeURIComponent(m[2]),600);app.applicants.photo_url=signed.data?.signedUrl||null;}}
 return json({application:app});
 }catch{return json({error:'Edit unavailable'},400);}
});
