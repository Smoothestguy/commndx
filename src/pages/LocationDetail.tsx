import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Pencil, MapPin, Phone, Loader2, Clock } from 'lucide-react';
import { LogTimeDialog } from '@/components/personnel/lifecycle/LogTimeDialog';
import { BulkLogTimesDialog } from '@/components/personnel/lifecycle/BulkLogTimesDialog';
import { useProject } from '@/integrations/supabase/hooks/useProjects';
import { useProjectLocations } from '@/integrations/supabase/hooks/useProjectLocations';
import { useLocationStaffingSummary } from '@/integrations/supabase/hooks/useLocationStaffing';
import { useUserRole } from '@/hooks/useUserRole';
import { useNavigationValue } from '@/hooks/useNavigationValue';
import { useLocationAuthorization } from '@/hooks/useLocationAuthorization';
import { AuthorizationBadge } from '@/components/project-hub/AuthorizationBadge';
import { LocationStaffing } from '@/components/project-hub/LocationStaffing';
import { ProjectLocationsTab } from '@/components/project-hub/ProjectLocationsTab';
import { LocationLodging } from '@/components/project-hub/LocationLodging';
import { LocationAssets } from '@/components/project-hub/LocationAssets';
import { LocationTaskOrders } from '@/components/project-hub/LocationTaskOrders';
import { ProjectJoinLinks } from '@/components/project-hub/ProjectJoinLinks';
import { LocationKioskActions } from '@/components/signin/LocationKioskActions';
import { DailyTimesheetPanel } from '@/components/signin/DailyTimesheetPanel';
import { SigninStatusBoard } from '@/components/signin/SigninStatusBoard';
import { VisitsCard } from '@/components/project-hub/ProjectDeploymentTab';
import { ProjectDocuments } from '@/components/projects/ProjectDocuments';
import { currentWeekStart, addDays, resolveShifts } from '@/lib/shifts';
import { formatLocalDate } from '@/lib/dateUtils';
import { localDay } from '@/lib/signinSheets';
const tabs = ['staffing','attendance','sheets','taskorders','lodging','assets','documents'] as const;
const labels = { staffing:'Staffing',attendance:'Attendance',sheets:'Visits & Sheets',taskorders:'Task orders',lodging:'Lodging',assets:'Assets',documents:'Documents' };
export default function LocationDetail() {
  const { projectId, locationId } = useParams();
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(projectId);
  const { data: locations = [], isLoading, error } = useProjectLocations(projectId);
  const location = locations.find(l => l.id === locationId);
  const { isAdmin, isManager } = useUserRole(), canWrite = isAdmin || isManager;
  const { data: staffing } = useLocationStaffingSummary(locationId ? [locationId] : []);
  const scoped = useMemo(() => location ? [location] : [], [location]);
  const auth = useLocationAuthorization(scoped);
  const [tab,setTab] = useNavigationValue('tab','staffing',tabs);
  const [week,setWeek] = useNavigationValue<string>('week',currentWeekStart());
  const [params,setParams] = useSearchParams();
  const [edit,setEdit] = useState(false);
  const [logOpen,setLogOpen] = useState(false);
  const [sheet,setSheet] = useState<{location:string;day:string}>();
  useEffect(() => { window.scrollTo(0,0); }, [locationId]);
  useEffect(() => {
    if (!location) return;
    if (params.get('action') === 'edit' && canWrite) setEdit(true);
    if (params.get('day') || params.get('action') === 'daily') setSheet({location:location.id,day:params.get('day') || localDay(new Date().toISOString(),location.timezone || 'America/Chicago')});
  }, [location, params, canWrite]);
  if (isLoading || projectLoading) return <PageLayout title="Location"><Loader2 className="animate-spin"/></PageLayout>;
  if (!project || !location || error || projectError || !projectId) return <PageLayout title="Location unavailable"><Button asChild variant="link"><Link to="/projects">Projects</Link></Button></PageLayout>;
  const address = [location.address,location.city,location.state,location.zip].filter(Boolean).join(', ');
  const summary = staffing?.[location.id];
  const shifts=resolveShifts(location,project);
  return <PageLayout title={location.name} actions={canWrite&&<><Button variant="outline" size="sm" onClick={()=>setEdit(true)}><Pencil className="h-4 w-4 mr-1"/>Edit</Button><Button variant="outline" size="sm" onClick={()=>setLogOpen(true)}><Clock className="h-4 w-4 mr-1"/>Log time</Button></>}>
    <SEO title={`${location.name} | Command X`} description={`Location operations for ${project.name}`}/>
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-4"><Link className="hover:underline" to="/projects">Projects</Link><span>/</span><Link className="hover:underline" to={`/projects/${projectId}?tab=locations`}>{project.name}</Link><span>/</span><Link className="text-foreground hover:underline" to={`/projects/${projectId}/locations/${location.id}`}>{location.name}</Link></nav>
    <section className="border-b pb-4 space-y-3">
      <div className="flex flex-wrap gap-2 items-center">{location.project_number && <Badge variant="outline">#{location.project_number}</Badge>}{location.lat != null && location.lng != null ? <Badge variant="outline">Geofenced · {location.geofence_radius_m}m</Badge> : <Badge variant="outline" className="text-muted-foreground">No geofence set</Badge>}<Badge variant={location.status==='active'?'default':'secondary'}>{location.status}</Badge><span className="text-sm font-medium">Staffed {summary?.assigned ?? 0}/{summary?.needed ?? 0}</span><AuthorizationBadge value={auth.data?.[location.id]}/></div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">{address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex gap-1 items-center hover:underline"><MapPin className="h-4 w-4 shrink-0"/>{address}</a>}{location.poc_name && <span>{location.poc_name}</span>}{location.poc_phone && <a href={`tel:${location.poc_phone}`} className="text-primary inline-flex gap-1 items-center hover:underline"><Phone className="h-4 w-4"/>{location.poc_phone}</a>}{location.poc_email && <a className="text-primary hover:underline" href={`mailto:${location.poc_email}`}>{location.poc_email}</a>}<span className="text-muted-foreground">Mobe {location.mobe_date?formatLocalDate(location.mobe_date):'—'} → Demobe {location.demobe_date?formatLocalDate(location.demobe_date):'—'}</span></div>
      {location.scope && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{location.scope}</p>}
      <p className="text-sm text-muted-foreground">Shifts: {shifts.day}–{shifts.dayEnd} / {shifts.night}–{shifts.nightEnd}</p>
      <div className="flex flex-wrap items-center gap-2">{canWrite && <><LocationKioskActions location={location} initialOpen={params.get('action')==='kiosk'}/><ProjectJoinLinks projectId={projectId} locationId={location.id}/></>}<DailyTimesheetPanel projectId={projectId} projectName={project.name} locationId={location.id} initialSheet={sheet}/></div>
    </section>
    {canWrite && <LogTimeDialog open={logOpen} onOpenChange={setLogOpen} projectId={projectId} locationId={location.id} />}
    {edit && <ProjectLocationsTab projectId={projectId} deploymentMode={!!project.deployment_mode} editTargetId={location.id} onEditClosed={()=>setEdit(false)}/>}
    <Tabs value={tab} onValueChange={v=>{setParams(prev=>{const next=new URLSearchParams(prev);next.set('tab',v);next.delete('sub');next.delete('action');return next;});}} className="mt-4"><TabsList className="h-auto flex flex-wrap justify-start gap-1">{tabs.map(t=><TabsTrigger value={t} key={t}>{labels[t]}</TabsTrigger>)}</TabsList></Tabs>
    <section className="py-4" aria-label={labels[tab]}>
      {tab==='attendance'&&canWrite&&<div className="mb-3"><BulkLogTimesDialog projectId={projectId} location={location}/></div>}
      {tab==='staffing' && <LocationStaffing locationId={location.id} locationName={location.name} projectId={projectId} timezone={location.timezone} summary={summary} canWrite={canWrite}/>}
      {(tab==='attendance'||tab==='sheets') && <><div className="flex items-center gap-2 mb-3"><label htmlFor="location-week" className="text-sm">Week of</label><Input id="location-week" type="date" className="w-44" value={week} onChange={e=>{if(e.target.value)setWeek(e.target.value);}}/></div>{tab==='sheets' && <SigninStatusBoard projectId={projectId} locations={scoped} onSelect={(id,day)=>{setSheet({location:id,day});setParams(prev=>{const next=new URLSearchParams(prev);next.set('day',day);return next;});}}/>}<VisitsCard key={tab} projectId={projectId} locations={scoped} crews={[]} from={week} to={addDays(week,6)} canEdit={canWrite} defaultView={tab==='attendance'?'timesheet':'visits'} locationScopeId={location.id} unframed/></>}
      {tab==='taskorders' && <LocationTaskOrders projectId={projectId} locationId={location.id} locationName={location.name} timezone={location.timezone} inline/>}
      {tab==='lodging' && <LocationLodging projectId={projectId} locationId={location.id} housingBy={location.housing_provided_by} canWrite={canWrite}/>}
      {tab==='assets' && <LocationAssets projectId={projectId} locationId={location.id} locationName={location.name} canWrite={canWrite} locationNames={Object.fromEntries(locations.map(l=>[l.id,l.name]))}/>}
      {tab==='documents' && <ProjectDocuments projectId={projectId} projectName={project.name} locationScopeId={location.id} unframed/>}
    </section>
  </PageLayout>;
}