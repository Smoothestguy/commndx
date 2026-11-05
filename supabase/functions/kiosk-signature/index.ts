import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { validSignaturePng } from '../_shared/signatureRules.ts';
const schema=z.object({action:z.enum(['info','punch','save']),token:z.string().uuid(),personnel_id:z.string().uuid().optional(),expected:z.enum(['in','out']).optional(),signature:z.string().max(280000).optional(),stay_id:z.string().uuid().optional(),lat:z.number().min(-90).max(90).nullable().optional(),lng:z.number().min(-180).max(180).nullable().optional(),accuracy:z.number().min(0).max(100000).nullable().optional(),early_reason:z.string().trim().min(1).max(200).optional(),override_reason:z.string().trim().min(1).max(1000).optional()});
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const parsed=schema.safeParse(await req.json());if(!parsed.success)return json({error:'Invalid kiosk request'},400);const v=parsed.data;
  const db=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');
  const {data:token,error:te}=await db.from('kiosk_tokens').select('location_id,expires_at').eq('id',v.token).maybeSingle();if(te)throw te;if(!token||Date.parse(token.expires_at)<=Date.now())return json({error:'Kiosk link expired',valid:false},403);
  const {data:info,error:ie}=await db.rpc('get_kiosk_info',{p_kiosk:v.token});if(ie)throw ie;
  const {data:loc,error:le}=await db.from('project_locations').select('timezone').eq('id',token.location_id).single();if(le)throw le;
  const zone=loc.timezone||'America/Chicago';const localDate=(at:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
  const {data:openStays,error:openError}=await db.from('personnel_location_trail').select('personnel_id,in_at').eq('location_id',token.location_id).is('out_at',null);if(openError)throw openError;
  const sameDay=openStays?.filter(s=>localDate(s.in_at)===localDate(new Date().toISOString()))||[];
  info.roster=(info.roster||[]).map((p:{personnel_id:string})=>({...p,on_site:sameDay.some(s=>s.personnel_id===p.personnel_id)}));
  if(v.action==='info'){
   return json({...info,timezone:zone,roster:info.roster.map((p:{personnel_id:string})=>({...p,since:sameDay.find(s=>s.personnel_id===p.personnel_id)?.in_at||null}))});
  }
  if(!v.personnel_id||!info.roster?.some((p:{personnel_id:string})=>p.personnel_id===v.personnel_id))return json({error:'Person is not on this roster'},403);
  const now=new Date().toISOString();
  const {data:locked,error:lockError}=await db.from('signin_sheet_days').select('id').eq('location_id',token.location_id).eq('sheet_date',new Intl.DateTimeFormat('en-CA',{timeZone:loc.timezone||'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())).eq('status','locked');if(lockError)throw lockError;
  if(locked?.length&&v.action==='punch')return json({ok:false,reason:'sheet_locked'});
  let bytes:Uint8Array|undefined;if(v.signature){try{bytes=Uint8Array.from(atob(v.signature.replace(/^data:image\/png;base64,/,'')),c=>c.charCodeAt(0));}catch{return json({error:'Invalid signature'},400);}if(!validSignaturePng(bytes))return json({error:'Invalid signature'},400);}
  let stayId=v.stay_id;let earlyFlagged=false;
  if(v.action==='punch'){
   const person=info.roster.find((p:{personnel_id:string})=>p.personnel_id===v.personnel_id);
   const expected=person.on_site?'out':'in';if(v.expected!==expected)return json({ok:false,reason:'status_changed'});if(expected==='in'&&!bytes)return json({error:'Signature required'},400);
   const {data:result,error:pe}=await db.rpc('kiosk_punch',{p_kiosk:v.token,p_personnel:v.personnel_id,p_lat:v.lat??undefined,p_lng:v.lng??undefined,p_accuracy:v.accuracy??undefined,p_override_reason:v.override_reason,p_early_reason:v.early_reason});if(pe)throw pe;if(!result?.ok||result.action==='out')return json(result);earlyFlagged=!!result.early_flagged;
   const {data:stays,error:se}=await db.from('personnel_location_trail').select('visit_personnel_id,in_at').eq('location_id',token.location_id).eq('personnel_id',v.personnel_id).gte('in_at',new Date(Date.parse(now)-1000).toISOString()).order('in_at',{ascending:false}).limit(1);if(se)throw se;stayId=stays?.[0]?.visit_personnel_id;
  }
  if(!stayId||!bytes)return json({error:'Signature check-in not found'},409);
  const {data:stay,error:se}=await db.from('personnel_location_trail').select('visit_personnel_id,in_at,signature_url').eq('visit_personnel_id',stayId).eq('location_id',token.location_id).eq('personnel_id',v.personnel_id).maybeSingle();if(se)throw se;if(!stay||Date.now()-Date.parse(stay.in_at)>15*60000||Date.parse(stay.in_at)-Date.now()>10*60000)return json({error:'Matching check-in unavailable'},409);if(stay.signature_url)return json({ok:true,action:'in',stay_id:stayId});
  const path=`kiosk-signatures/${token.location_id}/${stayId}.png`;const {error:ue}=await db.storage.from('project-documents').upload(path,bytes,{contentType:'image/png',upsert:false});
  if(ue){const {data:file,error:fe}=await db.storage.from('project-documents').download(path);if(fe||!file)return json({ok:false,reason:'signature_pending',stay_id:stayId});}
  const {error:saveError}=await db.from('visit_personnel').update({signature_url:path,signed_at:now}).eq('id',stayId).is('signature_url',null);if(saveError)return json({ok:false,reason:'signature_pending',stay_id:stayId});return json({ok:true,action:'in',stay_id:stayId,offsite:!!v.override_reason,early_flagged:earlyFlagged});
 }catch(e){console.error('kiosk-signature',e instanceof Error?e.message:'Request failed');return json({error:'Kiosk request failed — ask your supervisor'},500);}
});
