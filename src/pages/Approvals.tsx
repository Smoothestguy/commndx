import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useMobileApprovals } from '@/hooks/useMobileApprovals';
import { useActOnLocationRequest } from '@/hooks/useLocationRequests';
import { useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { JoinRequests } from '@/components/project-hub/JoinRequests';
import { TaskOrderDecision } from '@/components/project-hub/TaskOrderDecision';
import { ShiftReviews } from '@/components/signin/ShiftReviews';
import { useProjectLocations } from '@/integrations/supabase/hooks/useProjectLocations';
import { RefreshCw, CheckCheck, ArrowRight } from 'lucide-react';

function ProjectShiftInbox({projectId}:{projectId:string}) {
  const {data:locations=[]}=useProjectLocations(projectId);
  return <ShiftReviews projectId={projectId} locations={locations} initialOpen/>;
}
export default function Approvals() {
  const {isAdmin,isManager,loading}=useUserRole();
  if(loading)return <PageLayout title="Approvals"><p>Loading…</p></PageLayout>;
  if(!isAdmin&&!isManager)return <Navigate to="/" replace/>;
  return <Inbox/>;
}
function Inbox() {
  const q=useMobileApprovals(),d=q.data,qc=useQueryClient(),act=useActOnLocationRequest();
  const [filter,setFilter]=useState('All');
  const refresh=()=>qc.invalidateQueries({queryKey:['mobile-approvals']});
  const name=(id:string)=>d?.locations.find(l=>l.id===id)?.name||'Location';
  const href=(id:string,tab='attendance')=>{const l=d?.locations.find(l=>l.id===id);return l?`/projects/${l.project_id}/locations/${id}?tab=${tab}`:'/locations';};
  const show=(s:string)=>filter==='All'||filter===s;
  return <PageLayout title="Approvals" actions={<Button variant="ghost" size="icon" aria-label="Refresh approvals" onClick={()=>void refresh()}><RefreshCw className="h-5 w-5"/></Button>}>
    <div aria-label="Approvals inbox" className="space-y-5 [&_button]:min-h-11">
      <div className="flex items-center gap-2 border-b pb-3"><CheckCheck className="h-5 w-5 text-primary"/><strong>{q.isLoading?'Loading…':`${d?.count??0} pending actions`}</strong></div>
      <div className="flex flex-wrap gap-2">{['All','Joins','Shifts','Field requests','Customer TOs','Signatures'].map(s=><Button key={s} className="min-h-11" variant={filter===s?'secondary':'outline'} onClick={()=>setFilter(s)}>{s}</Button>)}</div>
      {q.error&&<div role="alert" className="text-destructive">Inbox could not load. <Button variant="outline" onClick={()=>void refresh()}>Retry</Button></div>}
      {show('Joins')&&d?.projects.filter(p=>d.joins.some(j=>j.project_id===p.id)).map(p=><section key={p.id} className="border-b pb-4"><h2 className="font-semibold mb-2">Join requests · {p.name}</h2><JoinRequests projectId={p.id} inline onChanged={refresh}/></section>)}
      {show('Shifts')&&d?.projects.map(p=><ProjectShiftInbox key={p.id} projectId={p.id}/>)}
      {show('Field requests')&&d?.requests.map(r=><article key={r.id} className="border rounded-md p-3 space-y-2"><Badge variant="outline">Field request</Badge><h2 className="font-semibold break-words">{r.qty} × {r.label||r.kind}</h2><Link className="text-sm text-primary" to={href(r.location_id)}>{name(r.location_id)}</Link>{r.note&&<p className="text-sm whitespace-pre-wrap">{r.note}</p>}<div className="flex gap-2"><Button className="min-h-11 flex-1" disabled={act.isPending} onClick={()=>act.mutate({id:r.id,status:'accepted'},{onSuccess:refresh})}>Accept</Button><Button className="min-h-11 flex-1" variant="outline" disabled={act.isPending} onClick={()=>act.mutate({id:r.id,status:'denied'},{onSuccess:refresh})}>Deny</Button></div></article>)}
      {show('Customer TOs')&&d?.orders.map(o=><article key={o.id} className="border rounded-md p-3 space-y-2"><Badge variant="outline">Customer TO</Badge><h2 className="font-semibold">{o.to_number} · {o.effective_date}</h2><Link className="text-sm text-primary" to={href(o.location_id,'taskorders')}>{name(o.location_id)}</Link><p className="text-sm capitalize">{o.kind}</p><ul className="text-sm">{o.location_task_order_lines.map((l,i)=><li key={i}>{l.label} · {l.qty_delta>0?'+':''}{l.qty_delta}</li>)}</ul>{o.notes&&<p className="text-sm">{o.notes}</p>}<TaskOrderDecision order={o}/></article>)}
      {show('Signatures')&&d?.signatures.map(s=><article key={s.locationId} className="border rounded-md p-3 space-y-2"><Badge variant="outline">Missing signatures · {s.count}</Badge><h2 className="font-semibold break-words">{name(s.locationId)}</h2><p className="text-sm text-muted-foreground">{s.day}</p><Button asChild className="w-full min-h-11"><Link to={href(s.locationId)}>Request signatures<ArrowRight className="h-4 w-4 ml-2"/></Link></Button></article>)}
      {!q.isLoading&&!q.error&&d?.count===0&&<p className="py-6 text-muted-foreground">All caught up.</p>}
    </div>
  </PageLayout>;
}