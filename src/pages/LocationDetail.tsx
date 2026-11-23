import {perDiemText} from '@/lib/locationPerDiem';
import {useLocationPerDiemCounts} from '@/hooks/useLocationPerDiem';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Link2, ChevronDown, Pencil, MapPin, Phone, Loader2, Clock, Inbox, Lock, LockOpen } from 'lucide-react';
import { LocationCloseoutDialog } from '@/components/project-hub/LocationCloseoutDialog';
import { MoveLocationProjectDialog } from '@/components/project-hub/MoveLocationProjectDialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FieldRequestsDialog } from '@/components/project-hub/FieldRequestsDialog';
import { LogTimeDialog } from '@/components/personnel/lifecycle/LogTimeDialog';
import { BulkLogTimesDialog } from '@/components/personnel/lifecycle/BulkLogTimesDialog';
import { useCustomer } from '@/integrations/supabase/hooks/useCustomers';
import { useProject } from '@/integrations/supabase/hooks/useProjects';
import { useProjectLocations } from '@/integrations/supabase/hooks/useProjectLocations';
import { useLocationStaffingSummary } from '@/integrations/supabase/hooks/useLocationStaffing';
import { useUserRole } from '@/hooks/useUserRole';
import { useNavigationValue } from '@/hooks/useNavigationValue';
import { LocationTaskOrders } from '@/components/project-hub/LocationTaskOrders';
import { LocationStaffing } from '@/components/project-hub/LocationStaffing';
import { ProjectLocationsTab } from '@/components/project-hub/ProjectLocationsTab';
import { LocationLodging } from '@/components/project-hub/LocationLodging';
import { LocationAssets } from '@/components/project-hub/LocationAssets';
import { LocationAuthorizationPanel } from '@/components/project-hub/LocationAuthorizationPanel';
import { LocationDayAttendance } from '@/components/project-hub/LocationDayAttendance';
import { ProjectJoinLinks } from '@/components/project-hub/ProjectJoinLinks';
import { LocationKioskActions } from '@/components/signin/LocationKioskActions';
import { DailyTimesheetPanel } from '@/components/signin/DailyTimesheetPanel';
import { SigninStatusBoard } from '@/components/signin/SigninStatusBoard';
import { ServiceGrid,VisitsCard } from '@/components/project-hub/ProjectDeploymentTab';
import { ProjectDocuments } from '@/components/projects/ProjectDocuments';
import { currentWeekStart, addDays, resolveShifts } from '@/lib/shifts';
import { formatLocalDate } from '@/lib/dateUtils';
import { localDay } from '@/lib/signinSheets';
import { useIsMobile } from '@/hooks/use-mobile';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
const tabs = ['taskorders','crew','lodging','assets','documents'] as const;
const legacyTab: Record<string,string> = { staffing:'crew', attendance:'crew', sheets:'documents', service:'documents' };
function useHasServiceLog(locationId?: string){ return useQuery({ queryKey:['service-log-exists',locationId], enabled:!!locationId, queryFn: async()=>{ const {count,error}=await (supabase as any).from('location_service_log').select('id',{count:'exact',head:true}).eq('location_id',locationId); if(error) return false; return (count??0)>0; } }); }
const attViews = ['day','detail'] as const;
const labels = { taskorders:'Task orders',crew:'Crew',lodging:'Lodging',assets:'Assets',documents:'Documents' };
export default function LocationDetail() {
  const mobile = useIsMobile();
  const [expanded,setExpanded] = useState<string[]>([]);
  const { projectId, locationId } = useParams();
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(projectId);
  const { data: locations = [], isLoading, error } = useProjectLocations(projectId);
  const location = locations.find(l => l.id === locationId);
  const perDiemCounts=useLocationPerDiemCounts(location?.per_diem_days!=null?[location.id]:[]);
  const { data: customer } = useCustomer(location?.customer_id || project?.customer_id || undefined);
  const { isAdmin, isManager } = useUserRole(), canWrite = isAdmin || isManager;
  const { data: staffing } = useLocationStaffingSummary(locationId ? [locationId] : []);
  const scoped = useMemo(() => location ? [location] : [], [location]);
  const [tab,setTab] = useNavigationValue('tab','taskorders',tabs);
  const { data: hasServiceLog } = useHasServiceLog(locationId);
  const [week,setWeek] = useNavigationValue<string>('week',currentWeekStart());
  const [attView,setAttView] = useNavigationValue('view','day',attViews);
  const [params,setParams] = useSearchParams();
  const [edit,setEdit] = useState(false);
  const [logOpen,setLogOpen] = useState(false);
  const [reqOpen,setReqOpen] = useState(false);
  const [closeOpen,setCloseOpen] = useState(false);
  const [moveOpen,setMoveOpen] = useState(false);
  const qc = useQueryClient();
  const [sheet,setSheet] = useState<{location:string;day:string}>();
  useEffect(() => { window.scrollTo(0,0); }, [locationId]);
  useEffect(() => { const raw=params.get('tab'); if(raw&&legacyTab[raw]) setParams(prev=>{const next=new URLSearchParams(prev);next.set('tab',legacyTab[raw]);return next;},{replace:true}); }, [params,setParams]);
  useEffect(()=>{
    if(!mobile)return;
    if(['taskorders','lodging','assets','documents'].includes(tab))setExpanded(prev=>prev.includes(tab)?prev:[...prev,tab]);
    if(params.get('day')||params.get('action')==='daily')setExpanded(prev=>prev.includes('documents')?prev:[...prev,'documents']);
    if(params.get('action')==='kiosk')setExpanded(prev=>prev.includes('settings')?prev:[...prev,'settings']);
  },[mobile,tab,params]);
  useEffect(() => {
    if (!location) return;
    const editAction = params.get('action') === 'edit' && canWrite;
    const dailyAction = !!params.get('day') || params.get('action') === 'daily';
    if (editAction) setEdit(true);
    if (dailyAction) setSheet({location:location.id,day:params.get('day') || localDay(new Date().toISOString(),location.timezone || 'America/Chicago')});
    if (editAction || dailyAction) setParams(prev => { const next = new URLSearchParams(prev); next.delete('day'); if (editAction || next.get('action') === 'daily') next.delete('action'); return next; }, { replace: true });
  }, [location, params, canWrite, setParams]);
  if (isLoading || projectLoading) return <PageLayout title="Location"><Loader2 className="animate-spin"/></PageLayout>;
  if (!project || !location || error || projectError || !projectId) return <PageLayout title="Location unavailable"><Button asChild variant="link"><Link to="/projects">Projects</Link></Button></PageLayout>;
  const address = [location.address,location.city,location.state,location.zip].filter(Boolean).join(', ');
  const summary = staffing?.[location.id];
  const shifts=resolveShifts(location,project);
  const paperwork=(onSelect:(id:string,day:string)=>void)=><div className="space-y-6">
    <section aria-label="Sign-in sheets" className="space-y-3"><h3 className="font-semibold">Sign-in sheets</h3><DailyTimesheetPanel projectId={projectId} projectName={project.name} locationId={location.id} initialSheet={sheet}/><SigninStatusBoard projectId={projectId} locations={scoped} onSelect={onSelect}/></section>
    <section aria-label="Uploaded documents" className="space-y-3"><h3 className="font-semibold">Documents</h3><ProjectDocuments projectId={projectId} projectName={project.name} locationScopeId={location.id} unframed/></section>
    {hasServiceLog&&<details className="border rounded-md p-3"><summary className="cursor-pointer font-semibold min-h-11 flex items-center">Service logs (read-only)</summary><div className="pointer-events-none mt-3"><ServiceGrid locations={scoped}/></div></details>}
  </div>;
  const crew=<LocationStaffing crewMode locationId={location.id} locationName={location.name} projectId={projectId} timezone={location.timezone} summary={summary} canWrite={canWrite}/>;
  const linksMenu=<Popover><PopoverTrigger asChild><Button variant="outline" size="sm"><Link2 className="h-4 w-4 mr-1"/>Links & sheets<ChevronDown className="h-3.5 w-3.5 ml-1"/></Button></PopoverTrigger><PopoverContent forceMount align="end" className="w-auto max-w-[calc(100vw-1rem)] data-[state=closed]:hidden"><div className="flex flex-col items-stretch gap-2 [&_button]:justify-start">{canWrite && location.status!=='closed' && <><LocationKioskActions location={location} initialOpen={params.get('action')==='kiosk'}/><ProjectJoinLinks projectId={projectId} locationId={location.id}/></>}<DailyTimesheetPanel projectId={projectId} projectName={project.name} locationId={location.id} initialSheet={sheet}/>{canWrite&&<Button variant="ghost" size="sm" onClick={()=>setMoveOpen(true)}>Move to another project</Button>}</div></PopoverContent></Popover>;
  return <PageLayout title={location.name} actions={<div className="flex flex-wrap items-center gap-2">{canWrite&&<Button variant="outline" size="sm" onClick={()=>setEdit(true)}><Pencil className="h-4 w-4 mr-1"/>Edit</Button>}{linksMenu}{canWrite&&<><Button variant="outline" size="sm" onClick={()=>setLogOpen(true)}><Clock className="h-4 w-4 mr-1"/>Log time</Button><Button variant="outline" size="sm" onClick={()=>setReqOpen(true)}><Inbox className="h-4 w-4 mr-1"/>Field requests</Button>{!mobile&&(location.status!=='closed' ? <Button variant="outline" size="sm" onClick={()=>setCloseOpen(true)}><Lock className="h-4 w-4 mr-1"/>Close out</Button> : isAdmin && <Button variant="outline" size="sm" onClick={async()=>{if(!window.confirm('Reopen this location? The close-out task order stays in history; assignments are not restored.'))return;const {error}=await supabase.from('project_locations').update({status:'active'}).eq('id',location.id);if(error){toast.error(error.message);return;}toast.success('Location reopened');qc.invalidateQueries({queryKey:['project-locations']});}}><LockOpen className="h-4 w-4 mr-1"/>Reopen</Button>)}</>}</div>}>
    <SEO title={`${location.name} | Command X`} description={`Location operations for ${project.name}`}/>
    {moveOpen && canWrite && <MoveLocationProjectDialog location={location} onClose={() => setMoveOpen(false)} />}
    {location.status==='closed' && <div role="status" className="mb-4 rounded-md border border-muted bg-muted/40 p-3 text-sm"><Lock className="inline h-4 w-4 mr-1"/><b>Closed</b>{location.closeout_date ? ` as of ${location.closeout_date}` : ''} — punching, pre-shift texts and roster alerts are off. History, timesheets and sheets remain available.{location.closeout_notes && <span className="block text-muted-foreground mt-1 whitespace-pre-wrap">{location.closeout_notes}</span>}</div>}
    <section className="border-b pb-3 space-y-1.5" aria-label="Location summary">
      <div className="flex flex-wrap gap-2 items-center text-sm">{location.project_number && <Badge variant="outline">#{location.project_number}</Badge>}<Badge variant={location.status==='active'?'default':'secondary'}>{location.status}</Badge>{customer && <span>Customer: <b>{customer.company||customer.name}</b></span>}<span className="font-medium">Staffed {summary?.assigned ?? 0}/{summary?.needed ?? 0}</span>{location.lat == null && <span className="text-xs text-muted-foreground">No geofence</span>}</div>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">{address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex gap-1 items-center hover:underline"><MapPin className="h-3.5 w-3.5 shrink-0"/>{[location.city,location.state].filter(Boolean).join(', ')||address}</a>}<span>· {location.timezone || 'America/Chicago'}</span><span>· Shifts {shifts.day.replace(':','')}–{shifts.dayEnd.replace(':','')} / {shifts.night.replace(':','')}–{shifts.nightEnd.replace(':','')}</span><span>· Mobe {location.mobe_date?formatLocalDate(location.mobe_date):'—'} → {location.demobe_date?formatLocalDate(location.demobe_date):'—'}</span>{location.poc_phone && <a href={`tel:${location.poc_phone}`} className="text-primary inline-flex gap-1 items-center hover:underline">· <Phone className="h-3.5 w-3.5"/>{location.poc_name||location.poc_phone}</a>}</p>
      {!location.timezone && <p role="alert" className="text-sm text-warning">Location timezone not set — using America/Chicago. Set the location timezone before sending shift texts.</p>}
    </section>
    {location.per_diem_days!=null&&<div className="py-3 text-sm break-words">{perDiemText(location,canWrite,perDiemCounts[location.id])}{canWrite&&location.per_diem_notes&&<p className="text-muted-foreground whitespace-pre-wrap">{location.per_diem_notes}</p>}</div>}
    {!mobile && <div className="mt-4"><LocationAuthorizationPanel projectId={projectId} locationId={location.id} locationName={location.name} timezone={location.timezone}/></div>}
    <FieldRequestsDialog open={reqOpen} onOpenChange={setReqOpen} locationId={location.id} locationName={location.name} canAct={canWrite}/>
    {canWrite && projectId && <LocationCloseoutDialog projectId={projectId} location={location} open={closeOpen} onOpenChange={setCloseOpen}/>}
    {canWrite && <LogTimeDialog open={logOpen} onOpenChange={setLogOpen} projectId={projectId} locationId={location.id} />}
    {edit && <ProjectLocationsTab projectId={projectId} deploymentMode={!!project.deployment_mode} editTargetId={location.id} onEditClosed={()=>setEdit(false)}/>}
    {mobile ? <div className="space-y-6 py-4">
      <section aria-label="Task orders"><h2 className="font-semibold mb-3">Task orders</h2><LocationTaskOrders inline projectId={projectId} locationId={location.id} locationName={location.name} timezone={location.timezone}/></section>
      <section aria-label="Crew"><h2 className="font-semibold mb-3">Crew</h2>{crew}</section>
      <section aria-label="Authorization and demobilization"><h2 className="font-semibold mb-3">Authorization & demobe</h2><LocationAuthorizationPanel projectId={projectId} locationId={location.id} locationName={location.name} timezone={location.timezone}/>{location.demobe_date&&<p className="text-sm mt-2">Demobe {formatLocalDate(location.demobe_date)}</p>}</section>
      <Accordion type="multiple" value={expanded} onValueChange={setExpanded}>
        {(['lodging','assets','documents'] as const).map(t=><AccordionItem key={t} value={t}><AccordionTrigger>{labels[t]}</AccordionTrigger><AccordionContent>{expanded.includes(t)&&<>
          {t==='assets'&&<LocationAssets projectId={projectId} locationId={location.id} locationName={location.name} canWrite={canWrite} locationNames={Object.fromEntries(locations.map(l=>[l.id,l.name]))}/>}
          {t==='lodging'&&<LocationLodging projectId={projectId} locationId={location.id} housingBy={location.housing_provided_by} canWrite={canWrite}/>}
          {t==='documents'&&paperwork((id,day)=>setSheet({location:id,day}))}
        </>}</AccordionContent></AccordionItem>)}
        <AccordionItem value="settings"><AccordionTrigger>Location details & links</AccordionTrigger><AccordionContent>{expanded.includes('settings')&&<div className="space-y-3"><p className="text-sm break-words">{address}</p><p>{location.poc_name} <a href={`tel:${location.poc_phone}`}>{location.poc_phone}</a></p><p className="text-sm">Shifts {shifts.day}–{shifts.dayEnd} / {shifts.night}–{shifts.nightEnd}</p><p className="text-sm">Timezone: {location.timezone||'America/Chicago (fallback)'}</p>{canWrite&&<>{location.status!=='closed'&&<Button variant="outline" onClick={()=>setCloseOpen(true)}>Close out location</Button>}</>}</div>}</AccordionContent></AccordionItem>
      </Accordion>
    </div> : <><Tabs value={tab} onValueChange={v=>{setParams(prev=>{const next=new URLSearchParams(prev);next.set('tab',v);next.delete('sub');next.delete('view');next.delete('action');return next;});}} className="mt-4"><TabsList className="h-auto flex flex-wrap justify-start gap-1">{tabs.map(t=><TabsTrigger value={t} key={t}>{labels[t]}</TabsTrigger>)}</TabsList></Tabs>
    <section className="py-4" aria-label={labels[tab]}>
      {tab==='taskorders' && <LocationTaskOrders inline projectId={projectId} locationId={location.id} locationName={location.name} timezone={location.timezone}/>}
      {tab==='crew' && <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2"><div role="tablist" aria-label="Crew view" className="inline-flex rounded-md border p-0.5">{attViews.map(v=><Button key={v} role="tab" aria-selected={attView===v} size="sm" variant={attView===v?'secondary':'ghost'} onClick={()=>setAttView(v)}>{v==='day'?'Day & roster':'Trail & weekly timesheet'}</Button>)}</div>{canWrite&&<BulkLogTimesDialog projectId={projectId} location={location}/>}</div>
        {attView==='day' ? crew : <><div className="flex items-center gap-2"><label htmlFor="location-week" className="text-sm">Week of</label><Input id="location-week" type="date" className="w-44" value={week} onChange={e=>{if(e.target.value)setWeek(e.target.value);}}/></div><VisitsCard projectId={projectId} locations={scoped} crews={[]} from={week} to={addDays(week,6)} canEdit={canWrite} defaultView="timesheet" locationScopeId={location.id} unframed/></>}
      </div>}
      {tab==='lodging' && <LocationLodging projectId={projectId} locationId={location.id} housingBy={location.housing_provided_by} canWrite={canWrite}/>}
      {tab==='assets' && <LocationAssets projectId={projectId} locationId={location.id} locationName={location.name} canWrite={canWrite} locationNames={Object.fromEntries(locations.map(l=>[l.id,l.name]))}/>}
      {tab==='documents' && paperwork((id,day)=>{setSheet({location:id,day});setParams(prev=>{const next=new URLSearchParams(prev);next.set('day',day);return next;});})}
    </section></>}
  </PageLayout>;
}