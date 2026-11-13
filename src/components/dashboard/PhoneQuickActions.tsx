import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useHomeLocations } from '@/hooks/useHomeOperations';
import { useMyDay } from '@/hooks/useMyDay';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Dialog,DialogContent,DialogHeader,DialogTitle } from '@/components/ui/dialog';
import { LogTimeDialog } from '@/components/personnel/lifecycle/LogTimeDialog';
import { SendSiteTextDialog } from '@/components/project-hub/SendSiteTextDialog';
import { LocationTaskOrders } from '@/components/project-hub/LocationTaskOrders';
import { supabase } from '@/integrations/supabase/client';
import { demobilizedFilter } from '@/integrations/supabase/hooks/useLocationStaffing';
import { Clock, Send, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
export function PhoneQuickActions({onClose}:{onClose:()=>void}){
 const {isAdmin,isManager,loading}=useUserRole();
 if(loading)return <Dialog open onOpenChange={v=>{if(!v)onClose();}}><DialogContent className="phone-surface"><DialogHeader><DialogTitle>Add</DialogTitle></DialogHeader><p>Loading actions…</p></DialogContent></Dialog>;
 return isAdmin||isManager?<ManagerActions onClose={onClose}/>:<WorkerActions onClose={onClose}/>;
}
function WorkerActions({onClose}:{onClose:()=>void}){
 const q=useMyDay();
 return <Dialog open onOpenChange={v=>{if(!v)onClose();}}><DialogContent className="phone-surface"><DialogHeader><DialogTitle>Punch in / out</DialogTitle></DialogHeader>{q.data?.sites.map(s=><Button key={s.id} asChild disabled={!s.punchLink} className="h-12"><Link to={s.punchLink?`/punch/${s.punchLink}`:'/?mobile=day'}>{s.openAt?'Clock Out':'Clock In'} · {s.name}</Link></Button>)}{!q.data?.sites.length&&<p>No active site. Contact your supervisor.</p>}</DialogContent></Dialog>;
}
function ManagerActions({onClose}:{onClose:()=>void}){
 const q=useHomeLocations();const [action,setAction]=useState<'log'|'text'|'to'|null>(null),[target,setTarget]=useState<string|null>(null),[ids,setIds]=useState<string[]>([]),[busy,setBusy]=useState(false);
 const site=q.data?.locations.find(l=>l.id===target);
 const choose=async(id:string)=>{if(action==='text'){setBusy(true);const r=await supabase.from('location_assignments').select('personnel_id,location_id').eq('location_id',id).eq('status','active').is('unassigned_at',null);if(r.error){toast.error('Roster could not load');setBusy(false);return;}const demob=await demobilizedFilter(r.data);setIds(r.data.filter(p=>!demob(p)).map(p=>p.personnel_id));setBusy(false);}setTarget(id);};
 if(site&&action==='log')return <LogTimeDialog open projectId={site.project_id} locationId={site.id} onOpenChange={v=>{if(!v)onClose();}}/>;
 if(site&&action==='text')return <SendSiteTextDialog open projectId={site.project_id} locationId={site.id} personnelIds={ids} onOpenChange={v=>{if(!v)onClose();}}/>;
 return <Dialog open onOpenChange={v=>{if(!v&&!busy)onClose();}}><DialogContent className="phone-surface max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>{site?'New task order':action?'Choose a location':'Add'}</DialogTitle></DialogHeader>{site?<LocationTaskOrders inline newSignal={1} projectId={site.project_id} locationId={site.id} locationName={site.name} timezone={site.timezone}/>:action?<div className="divide-y">{q.data?.locations.map(l=><Button key={l.id} variant="ghost" disabled={busy} className="w-full min-h-12 h-auto whitespace-normal text-left justify-start" onClick={()=>void choose(l.id)}>{l.name}</Button>)}</div>:<div className="space-y-2">{([{id:'log',label:'Log time',Icon:Clock},{id:'text',label:'Send punch link',Icon:Send},{id:'to',label:'New TO',Icon:ListChecks}] as const).map(a=><Button key={a.id} variant="outline" className="w-full h-12 justify-start gap-3" onClick={()=>setAction(a.id)}><a.Icon className="h-5 w-5"/>{a.label}</Button>)}</div>}</DialogContent></Dialog>;
}