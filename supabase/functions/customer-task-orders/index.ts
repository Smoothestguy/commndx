// Anonymous access is scoped to a live customer token; responses never serialize staff table rows.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requestSchema, extrasSchema } from './rules.ts';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  try{
    if(Number(req.headers.get('content-length')||0)>40000)return json({error:'Request too large'},413);
    const text=await req.text();if(text.length>40000)return json({error:'Request too large'},413);
    const parsed=requestSchema.safeParse(JSON.parse(text));if(!parsed.success)return json({error:'Invalid input'},400);
    const body=parsed.data,url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!key)return json({error:'Service unavailable'},503);
    const db=createClient(url,key);
    const {data:token,error}=await db.from('customer_portal_tokens').select('project_id,active,expires_at').eq('id',body.token).maybeSingle();
    if(error)throw error;
    if(!token?.active||Date.parse(token.expires_at)<Date.now())return json(body.action==='history'?{valid:false}:{ok:false,reason:'invalid'});
    if(body.action==='history'){
      // The existing RPC is the only source of public order identity/lines; enrich only three allow-listed fields.
      const {data:history,error:historyError}=await db.rpc('customer_portal_task_orders',{p_token:body.token});if(historyError)throw historyError;
      if(!history?.valid)return json({valid:false});
      const orders=Array.isArray(history.task_orders)?history.task_orders:[];
      const extras:Record<string,unknown>={};
      for(let offset=0;offset<orders.length;offset+=200){
        const ids=orders.slice(offset,offset+200).map((o:{id:string})=>o.id);
        const {data:rows,error:rowsError}=await db.from('location_task_orders').select('id,effective_time,travel_time,details,project_locations!inner(project_id)').in('id',ids).eq('project_locations.project_id',token.project_id);if(rowsError)throw rowsError;
        for(const row of rows||[]){const safe=extrasSchema.safeParse({effective_time:row.effective_time?.slice(0,5)??null,travel_time:row.travel_time,details:row.details});extras[row.id]=safe.success?safe.data:{};}
      }
      return json({valid:true,task_orders:orders.map((o:any)=>({id:o.id,to_number:o.to_number,kind:o.kind,status:o.status,effective_date:o.effective_date,notes:o.notes,location:o.location,submitted_by:o.submitted_by,created_at:o.created_at,lines:(o.lines||[]).map((l:any)=>({line_kind:l.line_kind,label:l.label,qty:l.qty})),...extras[o.id] as object}))});
    }
    const f=body.form;
    const {data:location,error:locationError}=await db.from('project_locations').select('id').eq('id',f.location).eq('project_id',token.project_id).maybeSingle();if(locationError)throw locationError;if(!location)return json({ok:false,reason:'bad_location'});
    const {data:result,error:submitError}=await db.rpc('customer_submit_task_order',{p_token:body.token,p_location:f.location,p_to_number:f.number,p_kind:f.kind,p_effective:f.effective,p_notes:f.notes,p_name:f.name,p_lines:f.lines});if(submitError)throw submitError;
    if(!result?.ok)return json({ok:false,reason:result?.reason||'invalid'});
    const demob=f.kind==='decrease'||f.kind==='demobilization';
    const {error:updateError}=await db.from('location_task_orders').update({effective_time:f.effective_time||null,travel_time:demob?f.travel_time??null:null,details:demob?f.details??null:null}).eq('id',result.id).eq('location_id',f.location).eq('created_via','customer_portal');
    if(updateError)return json({ok:true,status:'submitted',extras_saved:false}); // Never invite a duplicate submission after the RPC committed.
    return json({ok:true,status:'submitted',extras_saved:true});
  }catch{return json({error:'Task orders unavailable'},500);}
});