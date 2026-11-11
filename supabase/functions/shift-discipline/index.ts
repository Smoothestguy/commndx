import {locationZone} from '../_shared/locationTime.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { service, authorize, json } from '../_shared/signinJobs.ts';
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('info'),token:z.string().uuid()}),
 z.object({action:z.literal('review'),id:z.string().uuid(),kind:z.enum(['early','extension']),status:z.enum(['approved','denied'])}),
 z.object({action:z.literal('field'),location_id:z.string().uuid(),personnel_id:z.string().uuid(),crew_id:z.string().uuid().nullable().optional(),signature_url:z.string().max(500),signed_at:z.string().datetime({offset:true}),lat:z.number().min(-90).max(90).nullable(),lng:z.number().min(-180).max(180).nullable(),late_reason:z.string().trim().min(1).max(200).optional(),early_reason:z.string().trim().min(1).max(200).optional(),override_reason:z.string().trim().min(1).max(1000).optional()})
]);
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{const parsed=schema.safeParse(await req.json());if(!parsed.success)return json({error:'Invalid shift request'},400);const v=parsed.data,db=service();
  if(v.action==='info'){
   const {data:t,error}=await db.from('site_checkin_tokens').select('personnel_id,location_id,expires_at').eq('id',v.token).maybeSingle();if(error)throw error;if(!t||Date.parse(t.expires_at)<=Date.now())return json({error:'Inactive link'},403);
   const {data:l,error:le}=await db.from('project_locations').select('timezone,project_id,day_shift_start,night_shift_start,day_shift_end,night_shift_end').eq('id',t.location_id).single();if(le)throw le;const {data:project,error:pe}=await db.from('projects').select('*').eq('id',l.project_id).single();if(pe)throw pe;const timezone=locationZone(l,project),day=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   const {data:extension,error:ee}=await db.from('shift_extensions').select('status,until_at').eq('personnel_id',t.personnel_id).eq('location_id',t.location_id).eq('ext_date',day).maybeSingle();if(ee)throw ee;
   const {data:open,error:oe}=await db.from('visit_personnel').select('scheduled_start_at,scheduled_end_at,checked_in_at,location_visits!inner(location_id)').eq('personnel_id',t.personnel_id).eq('location_visits.location_id',t.location_id).is('checked_out_at',null).order('checked_in_at',{ascending:false}).limit(1).maybeSingle();if(oe)throw oe;
   const {data:start,error:se}=await db.rpc('_shift_start_for',{p_location:t.location_id,p_at:new Date().toISOString()});if(se)throw se;
   const begins=open?.scheduled_start_at||start;
   const {data:end,error:endError}=await db.rpc('_shift_end_for',{p_location:t.location_id,p_in:open?.checked_in_at||begins||new Date().toISOString()});if(endError)throw endError;
   return json({timezone,timezone_missing:!l.timezone,shift_start:begins,shift_end:open?.scheduled_end_at||end,extension});
  }
  if(v.action==='review'){
   const auth=await authorize(req,db);if(!auth?.uid)return json({error:'Manager access required'},403);
   if(v.kind==='early'&&v.status==='denied')return json({error:'Early arrival evidence cannot be denied or erased; correct time through reconciliation'},400);
   const table=v.kind==='early'?'visit_personnel':'shift_extensions';
   let q=v.kind==='early'?db.from(table).update({offsite_approved_by:auth.uid,offsite_approved_at:new Date().toISOString()}).not('early_in_reason','is',null).is('offsite_approved_at',null):db.from(table).update({status:v.status,decided_by:auth.uid,decided_at:new Date().toISOString()}).eq('status','pending');
   const {data,error}=await q.eq('id',v.id).select('id').maybeSingle();if(error)throw error;if(!data)return json({error:'Review already changed. Refresh the list.'},409);return json({ok:true});
  }
  // Field operations require real staff authentication; never expose a public arbitrary-person punch.
  const bearer=req.headers.get('Authorization');if(!bearer?.startsWith('Bearer '))return json({error:'Staff access required'},403);const {data:claims,error:ce}=await db.auth.getClaims(bearer.slice(7));const uid=claims?.claims?.sub;if(ce||!uid)return json({error:'Staff access required'},403);
  const {data:roles,error:re}=await db.from('user_roles').select('role').eq('user_id',uid);if(re)throw re;if(!roles?.some(r=>['admin','manager','user'].includes(r.role)))return json({error:'Staff access required'},403);
  const userDb=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_ANON_KEY')||'',{global:{headers:{Authorization:bearer}}});const {data:location,error:locationError}=await userDb.from('project_locations').select('id').eq('id',v.location_id).maybeSingle();const {data:person,error:personError}=await userDb.from('personnel_directory').select('id').eq('id',v.personnel_id).maybeSingle();if(locationError||personError||!location||!person)return json({error:'Location or person unavailable'},403);
  const {data:loc,error:locError}=await db.from('project_locations').select('timezone,project_id').eq('id',v.location_id).single();if(locError)throw locError;const {data:project,error:pe}=await db.from('projects').select('*').eq('id',loc.project_id).single();if(pe)throw pe;const zone=locationZone(loc,project),localDay=(at:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at)),today=localDay(new Date().toISOString());
  const {data:locked,error:lockError}=await db.from('signin_sheet_days').select('id').eq('location_id',v.location_id).eq('sheet_date',today).eq('status','locked').maybeSingle();if(lockError)throw lockError;if(locked)return json({ok:false,reason:'sheet_locked'});
  if(v.crew_id){const {data:crew,error}=await db.from('crews').select('id').eq('id',v.crew_id).eq('project_id',loc.project_id).eq('status','active').maybeSingle();if(error)throw error;if(!crew)return json({error:'Crew unavailable'},403);}
  if(!v.signature_url.startsWith(`field-signatures/${v.personnel_id}/`)){const {data:prior,error}=await db.from('visit_personnel').select('signed_at').eq('personnel_id',v.personnel_id).eq('signature_url',v.signature_url).order('signed_at',{ascending:false}).limit(1).maybeSingle();if(error)throw error;if(!prior?.signed_at||localDay(prior.signed_at)!==today)return json({error:'Invalid signature evidence'},400);}
  const {data:file,error:fe}=await db.storage.from('project-documents').download(v.signature_url);if(fe||!file)return json({error:'Signature evidence unavailable'},400);
  const {data:openRows,error:oe}=await db.from('personnel_location_trail').select('visit_id,visit_personnel_id,in_at').eq('personnel_id',v.personnel_id).eq('location_id',v.location_id).is('out_at',null).order('in_at',{ascending:false}).limit(1);if(oe)throw oe;const open=openRows?.find(s=>localDay(s.in_at)===today);
  // Expected-IN reconciliation also makes partial crew retries and signature-only retries safe.
  let visitId=open?.visit_id,stayId=open?.visit_personnel_id,result:any={ok:true,action:'in'};
  if(!stayId){let {data:t,error:te}=await db.from('site_checkin_tokens').select('id').eq('personnel_id',v.personnel_id).eq('location_id',v.location_id).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle();if(te)throw te;if(!t){const created=await db.from('site_checkin_tokens').insert({personnel_id:v.personnel_id,location_id:v.location_id}).select('id').single();if(created.error)throw created.error;t=created.data;}if(!t)throw new Error('Token unavailable');const {data,error}=await db.rpc('site_punch',{p_token:t.id,p_lat:v.lat??undefined,p_lng:v.lng??undefined,p_late_reason:v.late_reason,p_early_reason:v.early_reason,p_override_reason:v.override_reason});if(error)throw error;result=data;if(!result?.ok)return json(result);const stay=await db.from('personnel_location_trail').select('visit_id,visit_personnel_id').eq('personnel_id',v.personnel_id).eq('location_id',v.location_id).is('out_at',null).order('in_at',{ascending:false}).limit(1).single();if(stay.error)throw stay.error;visitId=stay.data.visit_id;stayId=stay.data.visit_personnel_id;}
  const {error:se}=await db.from('visit_personnel').update({signature_url:v.signature_url,signed_at:v.signed_at,checked_in_by:uid}).eq('id',stayId).is('signature_url',null);if(se)throw se;if(v.crew_id){const {error}=await db.from('location_visits').update({crew_id:v.crew_id}).eq('id',visitId).is('crew_id',null);if(error)throw error;}return json({...result,visit_id:visitId});
 }catch(e){console.error('shift-discipline',e instanceof Error?e.message:'Request failed');return json({error:'Shift request failed'},500);}
});