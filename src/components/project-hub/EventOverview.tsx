import { useEffect,useRef,useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useProjectTypes } from '@/hooks/useProjectEvent';
import { useProjectVendors } from '@/integrations/supabase/hooks/useProjectVendors';
import { useCustomers } from '@/integrations/supabase/hooks/useCustomers';
import { useUpdateProject,type Project } from '@/integrations/supabase/hooks/useProjects';
import type { ProjectLocation } from '@/integrations/supabase/hooks/useProjectLocations';
import { EventCustomers } from '@/components/projects/EventCustomers';
import { eventCustomers,locationStatusCounts } from '@/lib/projectEvent';
import { locationHref } from '@/lib/navigationState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select,SelectTrigger,SelectValue,SelectContent,SelectItem } from '@/components/ui/select';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useUserRole } from '@/hooks/useUserRole';

function EventMap({locations,projectId}:{locations:ProjectLocation[];projectId:string}) {
  const ref=useRef<HTMLDivElement>(null),[error,setError]=useState('');
  const token=useQuery({queryKey:['event-map-token'],staleTime:3600000,queryFn:async()=>{const {data,error}=await supabase.functions.invoke('get-mapbox-token');if(error||!data?.token?.startsWith('pk.'))throw new Error('Map unavailable');return data.token as string;}});
  const pins=locations.filter(l=>l.lat!=null&&l.lng!=null);
  useEffect(()=>{if(!ref.current||!token.data)return;let map:mapboxgl.Map;try {map=new mapboxgl.Map({container:ref.current,accessToken:token.data,style:'mapbox://styles/mapbox/streets-v12',center:[-81,28],zoom:7});}catch{setError('Map unavailable');return;}
    map.addControl(new mapboxgl.NavigationControl());
    const bounds=new mapboxgl.LngLatBounds();
    for(const l of pins){if(l.lat==null||l.lng==null)continue;const el=document.createElement('a');el.href=locationHref(projectId,l.id);el.setAttribute('aria-label',`Open location ${l.name}`);el.title=l.name;el.className=`event-map-pin event-map-pin-${l.status}`;el.textContent='●';new mapboxgl.Marker({element:el}).setLngLat([l.lng,l.lat]).addTo(map);bounds.extend([l.lng,l.lat]);}
    if(pins.length)map.fitBounds(bounds,{padding:60,maxZoom:12,duration:0});
    map.on('error',()=>setError('Map tiles unavailable'));
    const resize=new ResizeObserver(()=>map.resize());resize.observe(ref.current);return()=>{resize.disconnect();map.remove();};
  },[locations,token.data,projectId]);
  return <section className="space-y-2"><div className="flex justify-between items-center"><h2 className="font-semibold">Event locations</h2><span className="text-sm text-muted-foreground">{pins.length} mapped · {locations.length} total</span></div><div ref={ref} className="event-location-map" aria-label="Event location map"/>{(error||token.error)&&<p role="alert" className="text-destructive">{error||'Map unavailable'}</p>}<div className="flex flex-wrap gap-x-4 gap-y-2">{locations.map(l=><Link className="text-sm text-primary hover:underline" key={l.id} to={locationHref(projectId,l.id)}>{l.name} · {l.status}{l.lat==null||l.lng==null?' · No coordinates':''}</Link>)}</div><div className="flex gap-3 text-xs text-muted-foreground"><span className="text-success">● Active</span><span className="text-warning">● On hold</span><span className="text-primary">● Complete</span><span>● Closed</span></div></section>;
}
export function EventOverview({project,locations}:{project:Project;locations:ProjectLocation[]}) {
  const {isAdmin,isManager}=useUserRole(),canWrite=isAdmin||isManager,types=useProjectTypes(),customers=useCustomers(),vendors=useProjectVendors(project.id),update=useUpdateProject();
  const [draft,setDraft]=useState({type_id:project.type_id||'none',start_date:project.start_date,end_date:project.end_date||'',region:project.region||'',status:project.status,deployment_mode:!!project.deployment_mode});
  useEffect(()=>setDraft({type_id:project.type_id||'none',start_date:project.start_date,end_date:project.end_date||'',region:project.region||'',status:project.status,deployment_mode:!!project.deployment_mode}),[project]);
  const onSite=useQuery({queryKey:['event-on-site',project.id],refetchInterval:60000,queryFn:async()=>{const people=new Set<string>();for(let offset=0;;offset+=1000){const {data,error}=await supabase.from('personnel_location_trail').select('personnel_id').eq('project_id',project.id).is('out_at',null).order('visit_personnel_id').range(offset,offset+999);if(error)throw error;for(const r of data)people.add(r.personnel_id);if(data.length<1000)return people.size;}}});
  return <div className="space-y-6"><form className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 border-b pb-4" onSubmit={async e=>{e.preventDefault();await update.mutateAsync({id:project.id,...draft,type_id:draft.type_id==='none'?null:draft.type_id,end_date:draft.end_date||null,region:draft.region.trim()||null});}}><div><Label>Type</Label><Select disabled={!canWrite} value={draft.type_id} onValueChange={type_id=>setDraft({...draft,type_id})}><SelectTrigger aria-label="Event type"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">Unassigned</SelectItem>{types.data?.filter(t=>t.active||t.id===draft.type_id).map(t=><SelectItem key={t.id} value={t.id}>{t.code} — {t.name}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="event-start">Start</Label><Input id="event-start" disabled={!canWrite} type="date" required value={draft.start_date} onChange={e=>setDraft({...draft,start_date:e.target.value})}/></div><div><Label htmlFor="event-end">End</Label><Input id="event-end" disabled={!canWrite} type="date" min={draft.start_date} value={draft.end_date} onChange={e=>setDraft({...draft,end_date:e.target.value})}/></div><div><Label htmlFor="event-region">Region</Label><Input id="event-region" disabled={!canWrite} value={draft.region} onChange={e=>setDraft({...draft,region:e.target.value})}/></div><div><Label>Status</Label><Select disabled={!canWrite} value={draft.status} onValueChange={(status:Project['status'])=>setDraft({...draft,status})}><SelectTrigger aria-label="Event status"><SelectValue/></SelectTrigger><SelectContent>{['active','on-hold','completed'].map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div><div className="flex flex-col justify-end gap-2"><label className="flex items-center gap-2 text-sm"><Switch disabled={!canWrite} checked={draft.deployment_mode} onCheckedChange={deployment_mode=>setDraft({...draft,deployment_mode})}/>Deployment</label>{canWrite&&<Button type="submit" disabled={update.isPending}>Save event</Button>}</div></form><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><section><h2 className="font-semibold mb-2">Customers</h2>{customers.error?<p role="alert">Customers unavailable</p>:<EventCustomers rows={eventCustomers(locations,project.customer_id)} customers={customers.data}/>}</section><section><h2 className="font-semibold mb-2">Companies / Vendors</h2>{vendors.error?<p role="alert">Vendors unavailable</p>:vendors.data.length?vendors.data.map(v=><Link className="block text-sm text-primary hover:underline" key={v.id} to={`/vendors/${v.id}`}>{v.name}</Link>):<p className="text-sm text-muted-foreground">No companies assigned</p>}</section><section><h2 className="font-semibold mb-2">Locations · {locations.length}</h2><div className="flex flex-wrap gap-2">{Object.entries(locationStatusCounts(locations)).map(([status,count])=><div key={status} className="flex items-center gap-1"><StatusBadge status={status}/><span>{count}</span></div>)}</div></section><section><h2 className="font-semibold mb-2">People on site now</h2><p className="text-3xl font-semibold">{onSite.error?'Unavailable':onSite.data??'…'}</p></section></div><EventMap locations={locations} projectId={project.id}/></div>;
}