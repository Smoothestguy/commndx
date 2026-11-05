import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {useReconciliation,closeBlockers} from '@/hooks/useReconciliation';
import {currentWeekStart} from '@/lib/shifts';
import {localDay} from '@/lib/signinSheets';
import {Button} from '@/components/ui/button';
import {cn} from '@/lib/utils';
import type {ProjectLocation} from '@/integrations/supabase/hooks/useProjectLocations';
export function DeploymentAlerts({projectId,locations,onView}:{projectId:string;locations:ProjectLocation[];onView:(v:'trail'|'visits'|'reconcile')=>void}){
 const week=currentWeekStart(),reconcile=useReconciliation(projectId,week);const query=useQuery({queryKey:['deployment-alerts',projectId],refetchInterval:60000,queryFn:async()=>{const ids=locations.map(l=>l.id);if(!ids.length)return {noShows:[],review:0};const [alerts,visits,trail]=await Promise.all([supabase.from('alert_log').select('id,personnel_id,location_id,alert_date,detail').in('location_id',ids).eq('kind','supervisor').gte('alert_date',new Date(Date.now()-2*86400000).toISOString().slice(0,10)),supabase.from('location_visits').select('id',{count:'exact',head:true}).in('location_id',ids).eq('needs_review',true),supabase.from('personnel_location_trail').select('personnel_id,location_id,in_at').eq('project_id',projectId).gte('in_at',new Date(Date.now()-2*86400000).toISOString())]);if(alerts.error||visits.error||trail.error)throw alerts.error||visits.error||trail.error;const noShows=(alerts.data||[]).filter(a=>{const zone=locations.find(l=>l.id===a.location_id)?.timezone||'America/Chicago';return a.alert_date===localDay(new Date().toISOString(),zone)&&!(trail.data||[]).some(t=>t.personnel_id===a.personnel_id&&t.location_id===a.location_id&&localDay(t.in_at||'',zone)===a.alert_date);});return {noShows,review:visits.count||0};}});
 const noShows=query.data?.noShows||[],review=query.data?.review||0,unresolved=reconcile.data?closeBlockers(reconcile.data.rows,reconcile.data.resolutions).length:0;if(!noShows.length&&!review&&!unresolved)return null;
 return <div role="status" className={cn('flex flex-wrap items-center gap-1 border rounded-md px-2 py-1',noShows.length?'border-destructive bg-destructive/10':'border-warning bg-warning/10')}>
 {noShows.length>0&&<Button size="sm" variant="ghost" className="text-destructive" onClick={()=>onView('trail')}>{noShows.length} no-shows</Button>}{review>0&&<Button size="sm" variant="ghost" className="text-warning" onClick={()=>onView('visits')}>{review} auto-closed, review required</Button>}{unresolved>0&&<Button size="sm" variant="ghost" className="text-warning" onClick={()=>onView('reconcile')}>{unresolved} unresolved variances</Button>}{noShows.length>0&&<p className="w-full text-xs text-destructive">{noShows.map(a=>a.detail||locations.find(l=>l.id===a.location_id)?.name||'No sign-in').join(' · ')}</p>}
 </div>;
}
