// Staff-readable employer names only; personnel/vendor/customer private fields never leave this endpoint.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
Deno.serve(async req => {
 if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
 try {
  const parsed = z.object({ project_id: z.string().uuid() }).safeParse(await req.json());
  if (!parsed.success) return json({ error: 'Invalid project' },400);
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({error:'Unauthorized'},401);
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !key || !anon) return json({error:'Service unavailable'},503);
  const caller=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:claims,error:authError}=await caller.auth.getClaims(auth.slice(7));
  if(authError || !claims?.claims?.sub) return json({error:'Unauthorized'},401);
  const db=createClient(url,key);
  const {data:roles,error:roleError}=await db.from('user_roles').select('role').eq('user_id',claims.claims.sub);
  if(roleError)throw roleError;
  if(!roles?.some(r=>['admin','manager','user'].includes(r.role)))return json({error:'Forbidden'},403);
  const {data:project,error:projectError}=await caller.from('projects').select('id').eq('id',parsed.data.project_id).maybeSingle();
  if(projectError || !project)return json({error:'Project not accessible'},403);
  const pid=project.id;
  const {data:locs,error:locError}=await caller.from('project_locations').select('id').eq('project_id',pid);
  if(locError)throw locError;
  const ids=new Set<string>();
  const add=async(q:PromiseLike<{data:any[]|null;error:any}>)=>{const {data,error}=await q;if(error)throw error;for(const r of data||[])if(r.personnel_id)ids.add(r.personnel_id);};
  await Promise.all([
   add(caller.from('personnel_project_assignments').select('personnel_id').eq('project_id',pid)),
   add(caller.from('personnel_location_trail').select('personnel_id').eq('project_id',pid).limit(10000)),
   add(caller.from('personnel_status_log').select('personnel_id').eq('project_id',pid)),
   locs?.length?add(caller.from('location_assignments').select('personnel_id').in('location_id',locs.map(l=>l.id))):Promise.resolve(),
  ]);
  const {data:crews,error:crewError}=await caller.from('crews').select('id').eq('project_id',pid);if(crewError)throw crewError;
  if(crews?.length)await add(caller.from('crew_members').select('personnel_id').in('crew_id',crews.map(c=>c.id)));
  const people:{id:string;vendor_id:string|null;employer_customer_id:string|null;non_billable:boolean}[]=[];
  const list=[...ids];
  for(let i=0;i<list.length;i+=200){const {data,error}=await db.from('personnel').select('id,vendor_id,employer_customer_id,non_billable').in('id',list.slice(i,i+200));if(error)throw error;people.push(...(data||[]));}
  const vendorIds=[...new Set(people.flatMap(p=>!p.employer_customer_id&&p.vendor_id?[p.vendor_id]:[]))];
  const vendors:{id:string;name:string}[]=[];
  for(let i=0;i<vendorIds.length;i+=200){const {data,error}=await db.from('vendors').select('id,name').in('id',vendorIds.slice(i,i+200));if(error)throw error;vendors.push(...(data||[]));}
  const customerIds=[...new Set(people.flatMap(p=>p.employer_customer_id?[p.employer_customer_id]:[]))];
  const customers:{id:string;name:string}[]=[];
  for(let i=0;i<customerIds.length;i+=200){const {data,error}=await db.from('customers').select('id,name').in('id',customerIds.slice(i,i+200));if(error)throw error;customers.push(...(data||[]));}
  return json({ people:people.map(p=>({personnel_id:p.id,vendor_id:p.employer_customer_id?null:p.vendor_id,employer_customer_id:p.employer_customer_id,non_billable:p.non_billable})),vendors,customers });
 }catch(e){console.error('project-agencies',e);return json({error:'Unable to load project agencies'},500);}
});
