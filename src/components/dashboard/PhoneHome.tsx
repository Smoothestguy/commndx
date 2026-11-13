import { useEffect,useState } from 'react';
import { Link,useSearchParams } from 'react-router-dom';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useMyDay } from '@/hooks/useMyDay';
import { useHomeLocations } from '@/hooks/useHomeOperations';
import { useMobileApprovals } from '@/hooks/useMobileApprovals';
import { useProfile } from '@/integrations/supabase/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog,DialogContent,DialogHeader,DialogTitle } from '@/components/ui/dialog';
import { Activity,ArrowLeftRight,ChevronDown,ChevronRight,CheckCheck,MapPin,Clock,Users,Tent,Settings,FileSignature,MessageSquare,X,User } from 'lucide-react';
import { localTime } from '@/lib/signinSheets';
function clock(at:string,zone:string){return localTime(at,zone).replace(':','');}
export function PhoneHome(){
 const {isAdmin,isManager,loading}=useUserRole();
 if(loading)return <p className="p-6">Loading your day…</p>;
 return isAdmin||isManager?<ManagerHome/>:<WorkerHome/>;
}
function ManagerHome(){
 const scope=useHomeLocations(),inbox=useMobileApprovals();
 return <HomeCards manager sites={(scope.data?.locations||[]).map(l=>({id:l.id,name:l.name,project:scope.data?.projects.find(p=>p.id===l.project_id)?.name||'',projectId:l.project_id}))} count={inbox.data?.count} updatedAt={Math.min(scope.dataUpdatedAt||Infinity,inbox.dataUpdatedAt||Infinity)} error={!!(scope.error||inbox.error)} context={inbox.data?.count?`Last alert: ${inbox.data.count} pending actions`:undefined}/>;
}
function WorkerHome(){
 const q=useMyDay();
 const {user}=useAuth();
 const identity=useQuery({queryKey:['phone-worker-identity',user?.id],enabled:!!user,queryFn:async()=>{const r=await supabase.from('personnel').select('first_name,last_name').eq('user_id',user?.id||'').maybeSingle();if(r.error)throw r.error;return r.data;}});
 return <HomeCards manager={false} fullName={identity.data?[identity.data.first_name,identity.data.last_name].filter(Boolean).join(' '):undefined} sites={(q.data?.sites||[]).map(l=>({id:l.id,name:l.name,project:l.project.name,projectId:l.project_id,openAt:l.openAt,zone:l.timezone||'America/Chicago'}))} updatedAt={q.dataUpdatedAt} error={!!q.error}/>;
}
type Site={id:string;name:string;project:string;projectId:string;openAt?:string|null;zone?:string};
function HomeCards({manager,sites,count,updatedAt,error,context,fullName}:{manager:boolean;sites:Site[];count?:number;updatedAt:number;error:boolean;context?:string;fullName?:string}){
 const {data:profile}=useProfile(),{signOut}=useAuth(),qc=useQueryClient();
 const [params]=useSearchParams(),[selected,setSelected]=useState(''),[switcher,setSwitcher]=useState(false),[more,setMore]=useState(false),[dismiss,setDismiss]=useState(false),[online,setOnline]=useState(navigator.onLine),[,setTick]=useState(0);
 useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);const timer=setInterval(()=>setTick(t=>t+1),30000);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);clearInterval(timer);};},[]);
 useEffect(()=>{if(params.get('profile')==='1')setMore(true);},[params]);
 const site=sites.find(s=>s.id===selected)||sites[0],name=fullName||[profile?.first_name,profile?.last_name].filter(Boolean).join(' ')||'Your account';
 const elapsed=Number.isFinite(updatedAt)&&updatedAt?Math.max(0,Math.floor((Date.now()-updatedAt)/60000)):null;
 const status=error?'Sync unavailable':elapsed===null?'Loading…':elapsed===0?'Synced just now':`Synced ${elapsed}m ago`;
 const last=context||(site?.openAt?`Last punch: ${clock(site.openAt,site.zone||'America/Chicago')} · ${site.name}`:undefined);
 const rows=manager?[{label:'Activity',Icon:Activity,to:'/?mobile=activity'},{label:'Locations',Icon:MapPin,to:'/locations'},{label:'Time',Icon:Clock,to:'/time-tracking'},{label:'Workforce',Icon:Users,to:'/personnel'},{label:'Event Manager',Icon:Tent,to:'/events'},{label:'Settings',Icon:Settings,to:'/settings'}]:[{label:'My Hours',Icon:Clock,to:'/?mobile=hours'},{label:'Signatures',Icon:FileSignature,to:'/?mobile=signatures'},{label:'Messages',Icon:MessageSquare,to:'/messages'}];
 return <div aria-label={manager?'Manager mobile Home':'Field mobile Home'} className="px-5 pt-3 pb-28 space-y-5">
  <article aria-label="Profile card" className="phone-card p-5"><div className="flex items-center gap-4"><div className="h-14 w-14 shrink-0 rounded-full bg-secondary flex items-center justify-center text-lg font-semibold text-info" aria-label="Profile avatar">{name.split(' ').slice(0,2).map(n=>n[0]).join('')}</div><div className="min-w-0 flex-1"><h1 className="text-lg font-bold break-words">{name}</h1><Button variant="ghost" className="px-0 h-auto min-h-11 gap-2 text-muted-foreground text-xs whitespace-normal text-left justify-start" aria-label="Switch project or location" onClick={()=>setSwitcher(true)}><span className="line-clamp-2">{site?.project||'No active event'}</span><ArrowLeftRight className="h-4 w-4 shrink-0"/></Button></div></div><div className="mt-4 pt-3 border-t flex items-center justify-between gap-2"><span className="text-[11px] text-muted-foreground">{status} · {online?'Online':'Offline'}</span><Button variant="ghost" className="px-0 min-h-11 gap-1 text-xs" aria-expanded={more} onClick={()=>setMore(v=>!v)}>More<ChevronDown className="h-3 w-3"/></Button></div>{more&&<div className="border-t pt-2 space-y-1"><Button asChild variant="ghost" className="w-full justify-start min-h-11"><Link to={manager?'/settings':'/portal'}><User className="h-4 w-4 mr-2"/>Account</Link></Button><Button variant="ghost" className="w-full justify-start min-h-11" onClick={()=>void signOut()}>Sign out</Button></div>}</article>
  {last&&!dismiss&&<div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-secondary text-xs text-muted-foreground"><span className="flex-1 min-w-0 truncate">{last}</span><Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Dismiss last action" onClick={()=>setDismiss(true)}><X className="h-4 w-4"/></Button></div>}
  <Button asChild variant="ghost" className="phone-card phone-feature relative w-full min-h-28 h-auto p-5 gap-4 text-left justify-start whitespace-normal"><Link to={manager?'/approvals':'/?mobile=day'}><span className="phone-icon h-12 w-12 shrink-0">{manager?<CheckCheck className="h-6 w-6"/>:<Clock className="h-6 w-6"/>}</span><span className="flex-1 min-w-0"><strong className="block text-base">{manager?'Approvals':'My Day'}</strong><span className="block text-xs font-normal text-muted-foreground mt-1">{manager?(count===undefined?'Loading…':count?`${count} pending`:'Nothing pending'):site?.openAt?`Clocked in ${clock(site.openAt,site.zone||'America/Chicago')} · ${site.name}`:'Not clocked in'}</span></span><ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground"/></Link></Button>
  <section aria-label="Home menu" className="phone-card px-4 divide-y">{rows.map(r=><Button asChild key={r.label} variant="ghost" className="w-full rounded-none h-20 px-0 justify-start gap-4"><Link to={r.to}><span className="phone-icon h-11 w-11 shrink-0"><r.Icon className="h-5 w-5"/></span><span className="flex-1 text-left font-semibold text-sm">{r.label}</span><ChevronRight className="h-4 w-4 text-muted-foreground"/></Link></Button>)}</section>
  {error&&<p role="alert" className="text-sm text-destructive">Your latest data could not load. <Button variant="link" onClick={()=>void qc.invalidateQueries()}>Retry</Button></p>}
  <Dialog open={switcher} onOpenChange={setSwitcher}><DialogContent className="phone-surface max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Project / location</DialogTitle></DialogHeader>{sites.map(s=><Button key={s.id} variant={site?.id===s.id?'secondary':'ghost'} className="w-full h-auto min-h-14 whitespace-normal text-left justify-start" onClick={()=>{setSelected(s.id);setSwitcher(false);}}><span>{s.name}<span className="block text-xs text-muted-foreground">{s.project}</span></span></Button>)}{!sites.length&&<p>No active locations.</p>}</DialogContent></Dialog>
 </div>;
}