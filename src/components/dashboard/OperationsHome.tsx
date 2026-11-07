import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, Clock, Inbox, ListChecks, MapPin, Plus, Send, Users, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useHomeLocations, useHomeDaily } from '@/hooks/useHomeOperations';
import { useLocationCommandCenter } from '@/hooks/useLocationCommandCenter';
import { useLocationAuthorization } from '@/hooks/useLocationAuthorization';
import { useLocationStaffingSummary } from '@/integrations/supabase/hooks/useLocationStaffing';
import { homeLocationState, upcomingDemobe } from '@/lib/homeOperations';
import { localDay } from '@/lib/signinSheets';
import { sortByAttention } from '@/lib/commandCenter';
import { formatLocalDate } from '@/lib/dateUtils';
import { FieldRequestsDialog } from '@/components/project-hub/FieldRequestsDialog';
import { LogTimeDialog } from '@/components/personnel/lifecycle/LogTimeDialog';
import { SendSiteTextDialog } from '@/components/project-hub/SendSiteTextDialog';
import { LocationTaskOrders } from '@/components/project-hub/LocationTaskOrders';
import type { ProjectLocation } from '@/integrations/supabase/hooks/useProjectLocations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Filter = 'attention'|'under'|'over'|'onsite'|'late'|'missing'|'punches'|'joins'|'requests'|'tos'|'demobe'|'assets';
type Action = 'log'|'text'|'to'|'location'|'requests';
const emptyOps = {late:0,joinPending:0,openPunches:0,pendingTOs:0,extPending:0,onSite:0,checkedToday:0};
export function OperationsHome() {
  const scope = useHomeLocations(), locations = scope.data?.locations ?? [], projects = scope.data?.projects ?? [];
  const ids = locations.map(l=>l.id);
  const staffing = useLocationStaffingSummary(ids), auth = useLocationAuthorization(locations);
  const ops = useLocationCommandCenter(projects.map(p=>p.id),locations), daily = useHomeDaily(locations);
  const [filter,setFilter] = useState<Filter>('attention');
  const [action,setAction] = useState<Action|null>(null), [target,setTarget] = useState<ProjectLocation|null>(null);
  const [textIds,setTextIds] = useState<string[]|null>(null);
  const rows = sortByAttention(locations.map(l=> {
    const s=staffing.data?.[l.id], a=auth.data?.[l.id], o=ops.data?.[l.id] ?? emptyOps, d=daily.data?.byLocation[l.id];
    const state=homeLocationState(s?.byRole ?? {},a?.levels,o,{assetUnder:a?.assetUnder??0,assetOver:a?.assetOver??0},d?.requests??0,d?.missing??0);
    const day=localDay(new Date().toISOString(),l.timezone||'America/Chicago');
    const demobe=(o as {next?:{kind:string;date:string}|null}).next;
    const demobeDate=demobe?.kind==='demobilization'?demobe.date:l.demobe_date;
    return {l,name:l.name,...state,o,d,a,actual:s?.assigned??0,authorized:a?.positions??s?.needed??0,demobeDate,demobe:upcomingDemobe(demobeDate,day)};
  }));
  const sum=(f:(r:typeof rows[number])=>number)=>rows.reduce((n,r)=>n+f(r),0);
  const match=(r:typeof rows[number],f:Filter):boolean=> {
    switch(f){case 'attention':return r.severity!=='ok';case 'under':return r.gaps.some(g=>g.under>0);case 'over':return r.gaps.some(g=>g.over>0);case 'onsite':return (r.d?.onSite??0)>0;case 'late':return r.o.late>0;case 'missing':return (r.d?.missing??0)>0;case 'punches':return r.o.openPunches>0;case 'joins':return r.o.joinPending>0;case 'requests':return (r.d?.requests??0)>0;case 'tos':return r.o.pendingTOs>0;case 'demobe':return r.demobe;case 'assets':return (r.a?.assetUnder??0)>0;}
  };
  const count=(f:Filter)=>rows.filter(r=>match(r,f)).length;
  const metrics:{key:Filter;label:string;value:number|string}[]=[
    {key:'attention',label:'Locations need attention',value:count('attention')},
    {key:'onsite',label:'On site / expected',value:`${daily.data?.people??0} / ${daily.data?.expected??0}`},
    {key:'under',label:'Under personnel',value:count('under')},{key:'over',label:'Over authorization',value:count('over')},
    {key:'late',label:'Late today',value:sum(r=>r.o.late)},{key:'missing',label:'Missing signatures',value:sum(r=>r.d?.missing??0)},
    {key:'punches',label:'Open punches',value:sum(r=>r.o.openPunches)},{key:'joins',label:'Pending joins',value:sum(r=>r.o.joinPending)},
    {key:'requests',label:'Field requests',value:sum(r=>r.d?.requests??0)},{key:'tos',label:'Customer TOs pending',value:sum(r=>r.o.pendingTOs)},
    {key:'demobe',label:'Demobes · next 3 days',value:count('demobe')},{key:'assets',label:'Assets under',value:sum(r=>r.a?.assetUnder??0)},
  ];
  const loading=scope.isLoading||staffing.isLoading||auth.isLoading||ops.isLoading||daily.isLoading;
  const error=scope.error||staffing.error||auth.error||ops.error||daily.error;
  const refresh=()=>{void scope.refetch();void staffing.refetch();void auth.refetch();void ops.refetch();void daily.refetch();};
  const choose=async(l:ProjectLocation)=>{
    if(action==='text'){
      const {data,error}=await supabase.from('location_assignments').select('personnel_id').eq('location_id',l.id).eq('status','active').is('unassigned_at',null);
      if(error){toast.error('Could not load this roster');return;}
      const {demobilizedFilter}=await import('@/integrations/supabase/hooks/useLocationStaffing');
      const isDemob=await demobilizedFilter((data??[]).map(p=>({...p,location_id:l.id})));
      setTextIds((data??[]).filter(p=>!isDemob({...p,location_id:l.id})).map(p=>p.personnel_id));
    }
    setTarget(l);
  };
  const close=()=>{setTarget(null);setTextIds(null);setAction(null);};
  const shown=rows.filter(r=>match(r,filter));
  return <div className="space-y-6" aria-label="Operations Home">
    <section aria-label="Operations needs" className="space-y-3">
      <div className="flex items-center justify-between gap-2"><div><h2 className="text-xl font-semibold flex items-center gap-2"><Activity className="h-5 w-5 text-primary"/>Command center</h2><p className="text-xs text-muted-foreground mt-1">{projects.length} active projects · {locations.length} active locations</p></div><Button variant="ghost" size="icon" aria-label="Refresh operations" onClick={refresh}><RefreshCw className="h-4 w-4"/></Button></div>
      {error ? <div role="alert" className="text-sm text-destructive">Some operations could not load. <Button variant="link" onClick={refresh}>Retry</Button></div>:null}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 border-y divide-x-0 gap-px bg-border">
        {metrics.map(m=><Button key={m.key} variant="ghost" aria-pressed={filter===m.key} onClick={()=>setFilter(m.key)} className={`h-auto min-h-20 rounded-none bg-background flex flex-col items-start justify-center gap-1 px-3 whitespace-normal text-left ${filter===m.key?'bg-muted ring-1 ring-inset ring-primary hover:bg-muted':''}`}><span className={`font-semibold text-2xl tabular-nums ${m.key==='over'&&Number(m.value)>0?'text-destructive':m.key==='onsite'?'text-success':''}`}>{loading?'—':m.value}</span><span className="text-xs font-normal text-muted-foreground leading-snug">{m.label}</span></Button>)}
      </div>
    </section>
    <section aria-label="Operations quick actions"><h2 className="text-sm font-semibold mb-2">Quick actions</h2><div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">{([{key:'log',text:'Log time',Icon:Clock},{key:'text',text:'Send punch links',Icon:Send},{key:'to',text:'New task order',Icon:ListChecks},{key:'location',text:'New location',Icon:Plus},{key:'requests',text:'Field requests inbox',Icon:Inbox}] as const).map(a=><Button key={a.key} variant="outline" className="h-12 px-3 whitespace-normal gap-2 text-xs" onClick={()=>{setAction(a.key);setTarget(null);}}><a.Icon className="h-4 w-4 shrink-0"/>{a.text}</Button>)}</div></section>
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)] gap-6">
      <section aria-label="Locations needing attention"><div className="flex items-center justify-between gap-2 border-b pb-2"><h2 className="font-semibold">{filter==='attention'?'Locations needing attention':metrics.find(m=>m.key===filter)?.label}</h2><span className="text-xs text-muted-foreground">{loading?'Loading…':`${shown.length} locations`}</span></div>
        <ul className="divide-y">{shown.map(r=><li key={r.l.id} className="py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link to={`/projects/${r.l.project_id}/locations/${r.l.id}${filter==='missing'?'?tab=attendance':''}`} className="font-semibold text-sm hover:underline break-words">{r.name}</Link><p className="text-xs text-muted-foreground mt-0.5">{projects.find(p=>p.id===r.l.project_id)?.name}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground"/></div><div className="flex flex-wrap gap-1.5 mt-2 text-xs"><Badge variant="outline">Staffed {r.actual}/{r.authorized}</Badge>{r.worst.label&&<Badge variant="outline" className={r.worst.severity==='red'?'text-destructive border-destructive/40':'text-warning border-warning/40'}>{r.worst.label}</Badge>}{(r.a?.assetUnder??0)>0&&<Badge variant="outline" className="text-warning">{r.a?.assetUnder} assets under</Badge>}{(r.d?.missing??0)>0&&<Badge variant="outline">{r.d?.missing} missing signatures</Badge>}{r.o.late>0&&<Badge variant="outline" className="text-destructive">{r.o.late} late</Badge>}{r.demobe&&r.demobeDate&&<Badge variant="outline" className="text-warning">Demobe {formatLocalDate(r.demobeDate,'MM/dd')}</Badge>}{r.o.joinPending>0&&<Badge variant="outline">{r.o.joinPending} joins</Badge>}{r.o.pendingTOs>0&&<Badge variant="outline">{r.o.pendingTOs} TOs</Badge>}{(r.d?.requests??0)>0&&<Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>{setAction('requests');setTarget(r.l);}}>{r.d?.requests} field requests</Button>}</div></li>)}</ul>
        {!loading&&!shown.length&&<p className="py-6 text-sm text-muted-foreground">{filter==='attention'?'All active locations are on track.':'No matching locations.'}</p>}
      </section>
      <section aria-label="Today totals" className="space-y-3"><h2 className="font-semibold border-b pb-2">Today</h2><div className="flex items-center justify-between gap-3 py-2"><span className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-success"/>People on site</span><strong className="text-2xl tabular-nums">{loading?'—':daily.data?.people??0}</strong></div><div className="flex items-center justify-between gap-3 py-2 border-t"><span className="text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-primary"/>Hours closed</span><strong className="text-2xl tabular-nums">{loading?'—':(daily.data?.hours??0).toFixed(2)}</strong></div><Button asChild variant="outline" className="w-full h-11"><Link to="/projects">All projects<ArrowRight className="h-4 w-4 ml-2"/></Link></Button></section>
    </div>
    <Dialog open={!!action&&!target} onOpenChange={v=>{if(!v)close();}}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>{action==='location'?'Choose a project':'Choose a location'}</DialogTitle></DialogHeader><ul className="divide-y">{action==='location'?projects.map(p=><li key={p.id}><Button asChild variant="ghost" className="w-full justify-start min-h-11 h-auto whitespace-normal text-left"><Link to={`/projects/${p.id}?tab=locations&action=new-location`}>{p.name}</Link></Button></li>):locations.map(l=><li key={l.id}><Button variant="ghost" className="w-full justify-start min-h-11 h-auto whitespace-normal text-left" onClick={()=>void choose(l)}><MapPin className="h-4 w-4 shrink-0 mr-2"/>{l.name}</Button></li>)}</ul>{!locations.length&&action!=='location'&&<p className="text-sm text-muted-foreground">No active locations.</p>}</DialogContent></Dialog>
    {target&&action==='log'&&<LogTimeDialog open onOpenChange={v=>{if(!v)close();}} projectId={target.project_id} locationId={target.id}/>}
    {target&&action==='text'&&textIds&&<SendSiteTextDialog open onOpenChange={v=>{if(!v)close();}} projectId={target.project_id} locationId={target.id} personnelIds={textIds}/>}
    {target&&action==='requests'&&<FieldRequestsDialog open onOpenChange={v=>{if(!v)close();}} locationId={target.id} locationName={target.name} canAct/>}
    {target&&action==='to'&&<Dialog open onOpenChange={v=>{if(!v)close();}}><DialogContent className="max-h-[90dvh] overflow-y-auto max-w-3xl"><DialogHeader><DialogTitle>New task order — {target.name}</DialogTitle></DialogHeader><LocationTaskOrders inline newSignal={1} projectId={target.project_id} locationId={target.id} locationName={target.name} timezone={target.timezone}/></DialogContent></Dialog>}
  </div>;
}