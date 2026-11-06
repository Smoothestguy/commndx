// Token-only attendance enrichment. Never return staff identifiers or financial rows.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
const schema=z.object({token:z.string().uuid(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()}).strict();
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}});
async function pages(query:(offset:number)=>PromiseLike<any>){const rows:any[]=[];for(let o=0;;o+=500){const {data,error}=await query(o);if(error)throw error;rows.push(...data||[]);if((data||[]).length<500)return rows;}}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const text=await req.text();if(text.length>1000)return json({error:'Invalid request'},400);const parsed=schema.safeParse(JSON.parse(text));if(!parsed.success)return json({error:'Invalid request'},400);
  const v=parsed.data,db=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');
  const {data:token,error:te}=await db.from('customer_portal_tokens').select('project_id,active,expires_at').eq('id',v.token).maybeSingle();if(te)throw te;if(!token?.active||Date.parse(token.expires_at)<Date.now())return json({valid:false});
  const {data:overview,error:oe}=await db.rpc('customer_portal_overview',{p_token:v.token,...(v.date?{p_date:v.date}:{})});if(oe)throw oe;if(!overview?.valid)return json({valid:false});
  const locations=[];
  for(const item of overview.locations||[]){
   const {data:loc,error:le}=await db.from('project_locations').select('id,timezone').eq('id',item.location_id).eq('project_id',token.project_id).maybeSingle();if(le)throw le;if(!loc)continue;
   const zone=loc.timezone||'America/Chicago',day=overview.date;
   const assignments=await pages(o=>db.from('location_assignments').select('personnel_id,role_label,personnel_directory!inner(first_name,last_name)').eq('location_id',loc.id).eq('status','active').order('id').range(o,o+499));
   // Bound trail to the requested local day (UTC +/- fourteen-hour timezone range).
   const start=new Date(Date.parse(`${day}T00:00:00Z`)-14*3600000).toISOString(),end=new Date(Date.parse(`${day}T00:00:00Z`)+38*3600000).toISOString();
   const trail=await pages(o=>db.from('personnel_location_trail').select('visit_personnel_id,personnel_id,in_at,out_at').eq('project_id',token.project_id).eq('location_id',loc.id).gte('in_at',start).lt('in_at',end).order('visit_personnel_id').range(o,o+499));
   const rows=trail.filter(r=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.in_at))===day);
   const flags=new Map<string,{late_minutes:number|null;late_reason:string|null}>();for(let i=0;i<rows.length;i+=200){const {data,error}=await db.from('visit_personnel').select('id,late_minutes,late_reason').in('id',rows.slice(i,i+200).map(r=>r.visit_personnel_id));if(error)throw error;for(const f of data||[])flags.set(f.id,f);}
   const people=assignments.map(a=>{const stays=rows.filter(r=>r.personnel_id===a.personnel_id).sort((a,b)=>Date.parse(a.in_at)-Date.parse(b.in_at)),late=stays.map(r=>flags.get(r.visit_personnel_id)).filter(Boolean).sort((a,b)=>(b?.late_minutes||0)-(a?.late_minutes||0))[0];const person=a.personnel_directory;return {name:[person.first_name,person.last_name].filter(Boolean).join(' '),role:a.role_label,in_at:stays[0]?.in_at||null,out_at:stays.some(r=>!r.out_at)?null:stays.map(r=>r.out_at).sort().at(-1)||null,status:!stays.length?'no_show':stays.some(r=>!r.out_at)?'on_site':'done',late_minutes:late?.late_minutes||0,late_reason:late?.late_reason||null};}).sort((a,b)=>a.name.localeCompare(b.name));
   locations.push({location_id:loc.id,name:item.name,project_number:item.project_number,authorized:item.authorized,timezone:zone,people});
  }
  return json({valid:true,customer_name:overview.customer_name,project_name:overview.project_name,date:overview.date,locations});
 }catch{return json({error:'Attendance unavailable'},500);}
});