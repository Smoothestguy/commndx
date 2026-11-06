import { supabase } from '@/integrations/supabase/client';
import { adjustmentLines, adjustmentNumber } from './taskOrderExtras';
import { localDay } from './signinSheets';
export type RequirementRow={id?:string;role_label:string;headcount_needed:number;bill_rate?:number|null;notes?:string|null};
// No atomic RPC exists: stage rejected evidence, guard current-state writes, then accept; failures retain evidence.
export async function saveManualRequirements(locationId:string, rows:RequirementRow[], expected?:RequirementRow[]) {
  const {data:before,error}=await supabase.from('location_requirements').select('*').eq('location_id',locationId);if(error)throw error;
  if(expected&&JSON.stringify((before||[]).map(r=>[r.id,r.role_label,r.headcount_needed,r.bill_rate]).sort())!==JSON.stringify(expected.map(r=>[r.id,r.role_label,r.headcount_needed,r.bill_rate??null]).sort()))throw new Error('Requirements changed. Reopen the editor before saving.');
  if(rows.some(r=>!r.role_label.trim()||!Number.isSafeInteger(r.headcount_needed)||r.headcount_needed<0))throw new Error('Enter valid roles and whole-number headcounts');
  const changes=adjustmentLines(before||[],rows);
  const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Please sign in again');
  const {data:location,error:locationError}=await supabase.from('project_locations').select('timezone').eq('id',locationId).single();if(locationError)throw locationError;
  const zone=location.timezone||'America/Chicago',now=new Date(),day=localDay(now.toISOString(),zone),time=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
  const staged:string[]=[];
  const stage=async(lines:ReturnType<typeof adjustmentLines>,notes:string)=>{
    for(const kind of ['increase','decrease'] as const){const selected=lines.filter(l=>l.kind===kind);if(!selected.length)continue;
      const id=crypto.randomUUID();const header=await supabase.from('location_task_orders').insert({id,location_id:locationId,to_number:adjustmentNumber(day,time),kind,effective_date:day,effective_time:time,created_via:'internal',created_by:user.id,notes,status:'rejected'});if(header.error)throw header.error;staged.push(id);
      const result=await supabase.from('location_task_order_lines').insert(selected.map(({kind,...line})=>({...line,task_order_id:id})));if(result.error)throw result.error;
    }
  };
  try{
    if(changes.length){
      const auth=await supabase.rpc('location_authorized_asof',{p_location:locationId,p_date:day});if(auth.error)throw auth.error;
      const labels=new Set(changes.map(l=>l.label));
      // Capture legacy unlogged counts explicitly, not a fabricated historical baseline.
      const baseline=adjustmentLines((auth.data||[]).filter(l=>l.line_kind==='position'&&labels.has(l.label)).map(l=>({role_label:l.label,headcount_needed:Number(l.authorized)})),(before||[]).filter(l=>labels.has(l.role_label)));
      await stage(baseline,'Requirements baseline captured before manual adjustment');
      await stage(changes,'Manual adjustment via requirements editor');
    }
    const keep=new Set(rows.flatMap(r=>r.id?[r.id]:[]));
    for(const old of before||[]){
      const next=rows.find(r=>r.id===old.id);
      if(!keep.has(old.id)){const result=await supabase.from('location_requirements').delete().eq('id',old.id).eq('headcount_needed',old.headcount_needed).select('id');if(result.error||!result.data?.length)throw result.error||new Error('Requirements changed during save');}
      else if(next){const result=await supabase.from('location_requirements').update({role_label:next.role_label,headcount_needed:next.headcount_needed,bill_rate:next.bill_rate??null,notes:next.notes===undefined?old.notes:next.notes}).eq('id',old.id).eq('headcount_needed',old.headcount_needed).eq('role_label',old.role_label).select('id');if(result.error||!result.data?.length)throw result.error||new Error('Requirements changed during save');}
    }
    const added=rows.filter(r=>!r.id);if(added.length){const result=await supabase.from('location_requirements').insert(added.map(r=>({...r,location_id:locationId})));if(result.error)throw result.error;}
    if(staged.length){const result=await supabase.from('location_task_orders').update({status:'accepted'}).in('id',staged).select('id');if(result.error||result.data?.length!==staged.length)throw result.error||new Error('Adjustment history could not be accepted');}
  }catch(e){
    // Preserve headers and make partial outcomes explicit; do not silently retry or overwrite concurrent edits.
    if(staged.length)await supabase.from('location_task_orders').update({status:'rejected',notes:'Incomplete manual adjustment. Review requirements and authorization before retrying.'}).in('id',staged).eq('status','rejected');
    throw new Error(`Requirements save incomplete; refresh and review history before retrying. ${e instanceof Error?e.message:''}`);
  }
}