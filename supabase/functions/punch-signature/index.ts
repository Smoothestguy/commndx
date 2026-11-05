import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { validSignaturePng } from '../_shared/signatureRules.ts';
const schema=z.object({action:z.enum(['prepare','save']),token:z.string().uuid(),at:z.string().datetime({offset:true}),lat:z.number().min(-90).max(90).nullable().optional(),lng:z.number().min(-180).max(180).nullable().optional(),override_reason:z.string().trim().min(1).max(1000).optional(),signature_png_base64:z.string().max(280000).optional()});
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}});
const day=(iso:string,zone:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
const distance=(lat:number,lng:number,a:number,b:number)=>{const r=(v:number)=>v*Math.PI/180;const d=Math.sin(r(a-lat)/2)**2+Math.cos(r(lat))*Math.cos(r(a))*Math.sin(r(b-lng)/2)**2;return 6371000*2*Math.atan2(Math.sqrt(d),Math.sqrt(Math.max(0,1-d)));};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const parsed=schema.safeParse(await req.json());if(!parsed.success)return json({error:'Invalid request'},400);const v=parsed.data;
  // Small early arrivals are stored at shift start (up to ten minutes ahead).
  // Save still requires an exact matching token-scoped stay below; prepare never trusts future device time.
  if(Date.parse(v.at)>Date.now()+(v.action==='save'?10*60000:60000)||Date.parse(v.at)<Date.now()-7*86400000)return json({error:'Punch time unavailable'},400);
  const db=createClient(Deno.env.get('SUPABASE_URL')??'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'');
  const {data:token,error:tokenError}=await db.from('site_checkin_tokens').select('personnel_id,location_id,expires_at').eq('id',v.token).maybeSingle();if(tokenError)throw tokenError;if(!token||Date.parse(token.expires_at)<=Date.now())return json({error:'Inactive link'},403);
  const {data:loc,error:locError}=await db.from('project_locations').select('timezone,lat,lng,geofence_radius_m').eq('id',token.location_id).single();if(locError)throw locError;const zone=loc.timezone||'America/Chicago',date=day(v.at,zone);
  const {data:signed,error:sigError}=await db.from('visit_personnel').select('signature_url,signed_at').eq('personnel_id',token.personnel_id).not('signature_url','is',null).gte('signed_at',new Date(Date.parse(v.at)-2*86400000).toISOString()).lte('signed_at',new Date(Date.parse(v.at)+2*86400000).toISOString()).order('signed_at',{ascending:false});if(sigError)throw sigError;
  const prior=signed?.find(s=>s.signed_at&&day(s.signed_at,zone)===date);
  if(v.action==='prepare'){
   // Preflight only. site_punch revalidates authoritatively immediately before the write.
   if(loc.lat!=null&&loc.lng!=null&&!v.override_reason){if(v.lat==null||v.lng==null)return json({ok:false,reason:'no_gps',radius_m:loc.geofence_radius_m});const meters=distance(v.lat,v.lng,loc.lat,loc.lng);if(meters>(loc.geofence_radius_m??300))return json({ok:false,reason:'out_of_range',distance_m:meters,radius_m:loc.geofence_radius_m??300});}
   return json({ok:true,has_signature:!!prior});
  }
  const {data:stays,error:stayError}=await db.from('personnel_location_trail').select('visit_personnel_id,in_at,signature_url').eq('personnel_id',token.personnel_id).eq('location_id',token.location_id).gte('in_at',new Date(Date.parse(v.at)-1000).toISOString()).lte('in_at',new Date(Date.parse(v.at)+1000).toISOString());if(stayError)throw stayError;const stay=stays?.[0];if(!stay?.visit_personnel_id)return json({error:'Matching check-in not found'},409);if(stay.signature_url)return json({ok:true});
  let signature_url=prior?.signature_url,signed_at=prior?.signed_at;
  if(!signature_url){const base64=(v.signature_png_base64||'').replace(/^data:image\/png;base64,/,'');if(!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))return json({error:'Signature required'},400);let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));}catch{return json({error:'Invalid signature'},400);}if(!validSignaturePng(bytes))return json({error:'Invalid PNG'},400);signature_url=`field-signatures/${token.personnel_id}/${stay.visit_personnel_id}.png`;signed_at=v.at;
   const {error:uploadError}=await db.storage.from('project-documents').upload(signature_url,bytes,{contentType:'image/png',upsert:false});if(uploadError){const {data:existing,error:downloadError}=await db.storage.from('project-documents').download(signature_url);if(downloadError||!existing)return json({error:'Could not save signature'},409);}
  }
  const {error:updateError}=await db.from('visit_personnel').update({signature_url,signed_at}).eq('id',stay.visit_personnel_id).is('signature_url',null);if(updateError)throw updateError;return json({ok:true});
 }catch(e){console.error('punch-signature failed',e instanceof Error?e.message:'Request failed');return json({error:'Signature service unavailable'},500);}
});