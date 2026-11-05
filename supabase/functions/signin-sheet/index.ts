import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { validSignaturePng } from '../_shared/signatureRules.ts';
const schema = z.discriminatedUnion('action', [
 z.object({ action:z.literal('reopen'), sheet_day_id:z.string().uuid(), reason:z.string().trim().min(1).max(1000) }),
 z.object({ action:z.literal('approve'), location_id:z.string().uuid(), document_id:z.string().uuid(), sheet_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/), name:z.string().trim().min(1).max(150), signature:z.string().max(280000), pdf:z.string().max(18000000), hash:z.string().regex(/^[a-f0-9]{64}$/), at:z.string().datetime(), lat:z.number().min(-90).max(90).nullable(), lng:z.number().min(-180).max(180).nullable() })
]);
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}});
const decode=(s:string)=>Uint8Array.from(atob(s.replace(/^data:image\/png;base64,/,'')),c=>c.charCodeAt(0));
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders}); if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try {
  const parsed=schema.safeParse(await req.json()); if(!parsed.success)return json({error:'Invalid sheet request'},400); const v=parsed.data;
  const db=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''); const auth=req.headers.get('Authorization'); if(!auth?.startsWith('Bearer '))return json({error:'Sign in required'},401);
  const {data:claims,error:authError}=await db.auth.getClaims(auth.slice(7)); const uid=claims?.claims?.sub; if(authError||!uid)return json({error:'Sign in required'},401);
  const {data:roles,error:roleError}=await db.from('user_roles').select('role').eq('user_id',uid); if(roleError)throw roleError; if(!roles?.some(r=>['admin','manager'].includes(r.role)))return json({error:'Manager access required'},403);
  if(v.action==='reopen') {
   const {data:sheet,error}=await db.from('signin_sheet_days').select('*').eq('id',v.sheet_day_id).single(); if(error)throw error; if(sheet.status!=='locked')return json({ok:true});
   const {data:versions,error:ve}=await db.from('signin_sheet_versions').select('version').eq('sheet_day_id',sheet.id).order('version',{ascending:false}).limit(1); if(ve)throw ve;
   const version=(versions?.[0]?.version||0)+1;
   const {data:reserved,error:re}=await db.from('signin_sheet_versions').insert({sheet_day_id:sheet.id,version,changed_by:uid,change_reason:v.reason}).select('id').single(); if(re)return json({error:'Sheet changed; refresh and retry'},409);
   const {data:opened,error:oe}=await db.from('signin_sheet_days').update({status:'open'}).eq('id',sheet.id).eq('status','locked').eq('pdf_hash',sheet.pdf_hash).select('id').maybeSingle();
   if(oe||!opened){await db.from('signin_sheet_versions').delete().eq('id',reserved.id);return json({error:'Sheet changed; refresh and retry'},409);} return json({ok:true,version});
  }
  if(Math.abs(Date.now()-Date.parse(v.at))>15*60000)return json({error:'Approval time expired; sign again'},400);
  const [{data:location,error:le},{data:doc,error:de}]=await Promise.all([db.from('project_locations').select('id,project_id,lat,lng,geofence_radius_m').eq('id',v.location_id).single(),db.from('project_documents').select('id,project_id,is_signin_template,location_id').eq('id',v.document_id).single()]); if(le||de)throw le||de;
  if(!doc.is_signin_template||doc.project_id!==location.project_id)return json({error:'Template is not part of this project'},403);
  const {data:links,error:linkError}=await db.from('document_locations').select('location_id').eq('document_id',doc.id); if(linkError)throw linkError;
  if(!links?.some(l=>l.location_id===location.id)&&doc.location_id!==location.id)return json({error:'Link the template to this location first'},400);
  const pdf=decode(v.pdf),signature=decode(v.signature); if(!validSignaturePng(signature)||new TextDecoder().decode(pdf.slice(0,5))!=='%PDF-')return json({error:'Invalid PDF or signature'},400);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pdf)),b=>b.toString(16).padStart(2,'0')).join(''); if(hash!==v.hash)return json({error:'PDF integrity check failed'},400);
  const {error:ie}=await db.from('signin_sheet_days').upsert({location_id:v.location_id,sheet_date:v.sheet_date,document_id:v.document_id},{onConflict:'location_id,sheet_date',ignoreDuplicates:true});if(ie)throw ie;
  const {data:sheet,error:se}=await db.from('signin_sheet_days').select('*').eq('location_id',v.location_id).eq('sheet_date',v.sheet_date).single();if(se)throw se;if(sheet.status==='locked')return json({error:'Sheet is already locked; re-open with a reason first'},409);
  const {data:versions,error:ve}=await db.from('signin_sheet_versions').select('*').eq('sheet_day_id',sheet.id).order('version',{ascending:false}).limit(1);if(ve)throw ve;
  let version=versions?.[0]; const pending=version&&!version.pdf_url;
  const number=pending?version.version:(version?.version||0)+1;
  const suffix=crypto.randomUUID(); const path=number===1?`signin-sheets/${v.location_id}/${v.sheet_date}.pdf`:`signin-sheets/${v.location_id}/${v.sheet_date}/v${number}-${suffix}.pdf`;const sigPath=`signin-sheets/${v.location_id}/${v.sheet_date}/approval-${suffix}.png`;
  const {error:pu}=await db.storage.from('project-documents').upload(path,pdf,{contentType:'application/pdf',upsert:false});if(pu)return json({error:'Final PDF could not be saved; refresh and retry'},409);
  const {error:su}=await db.storage.from('project-documents').upload(sigPath,signature,{contentType:'image/png',upsert:false});if(su){await db.storage.from('project-documents').remove([path]);throw su;}
  const versionWrite=pending?await db.from('signin_sheet_versions').update({pdf_url:path,pdf_hash:hash}).eq('id',version.id).is('pdf_url',null).select('id').maybeSingle():await db.from('signin_sheet_versions').insert({sheet_day_id:sheet.id,version:number,pdf_url:path,pdf_hash:hash,changed_by:uid,change_reason:'Customer approval'}).select('id').single();
  if(versionWrite.error||!versionWrite.data){await db.storage.from('project-documents').remove([path,sigPath]);return json({error:'Sheet changed; refresh and retry'},409);}
  const rad=(n:number)=>n*Math.PI/180;let verdict:null|boolean=null;
  if(location.lat!=null&&location.lng!=null&&v.lat!=null&&v.lng!=null){const a=Math.sin(rad(v.lat-location.lat)/2)**2+Math.cos(rad(v.lat))*Math.cos(rad(location.lat))*Math.sin(rad(v.lng-location.lng)/2)**2;verdict=6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)))<=(location.geofence_radius_m||300);}
  const {data:saved,error:saveError}=await db.from('signin_sheet_days').update({status:'locked',document_id:v.document_id,countersign_name:v.name,countersign_url:sigPath,countersigned_at:v.at,countersign_lat:v.lat,countersign_lng:v.lng,countersign_in_geofence:verdict,locked_by:uid,pdf_url:path,pdf_hash:hash}).eq('id',sheet.id).eq('status','open').select('id').maybeSingle();
  if(saveError||!saved){if(pending)await db.from('signin_sheet_versions').update({pdf_url:null,pdf_hash:null}).eq('id',versionWrite.data.id);else await db.from('signin_sheet_versions').delete().eq('id',versionWrite.data.id);await db.storage.from('project-documents').remove([path,sigPath]);return json({error:'Sheet changed; refresh and retry'},409);}return json({ok:true,version:number,hash,in_geofence:verdict});
 }catch(e){console.error('signin-sheet',e instanceof Error?e.message:'Request failed');return json({error:'Unable to save sheet approval'},500);}
});
