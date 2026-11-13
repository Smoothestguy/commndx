import { lazy, Suspense, useState } from 'react';
import { useNavigate,useLocation } from 'react-router-dom';
import { Home,Search,Plus,CheckCheck,Clock,User,ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useMobileApprovals } from '@/hooks/useMobileApprovals';
import { useMyDay } from '@/hooks/useMyDay';
import { mobileDestinations } from '@/lib/mobileOperations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog,DialogContent,DialogHeader,DialogTitle } from '@/components/ui/dialog';
const PhoneQuickActions=lazy(()=>import('@/components/dashboard/PhoneQuickActions').then(m=>({default:m.PhoneQuickActions})));
import { cn } from '@/lib/utils';
export function BottomNav({onMoreClick}:{onMoreClick?:()=>void}){
 const navigate=useNavigate(),location=useLocation(),mobile=useIsMobile(),{user}=useAuth(),{role,isAdmin,isManager}=useUserRole();
 const manager=isAdmin||isManager,inbox=useMobileApprovals(mobile&&manager),day=useMyDay(mobile&&!manager);
 const [add,setAdd]=useState(false),[search,setSearch]=useState(false),[term,setTerm]=useState('');
 if(!mobile||!user||['/auth','/accept-invitation','/approve','/apply','/onboard','/contractor','/join','/portal','/vendor','/subcontractor','/punch','/timesheet-sign'].some(p=>location.pathname.startsWith(p)))return null;
 const items:Record<string,{label:string;Icon:typeof Home}>={'/':{label:'Home',Icon:Home},search:{label:'Search',Icon:Search},add:{label:'Add',Icon:Plus},'/approvals':{label:'Approvals',Icon:CheckCheck},'/?mobile=hours':{label:'Hours',Icon:Clock},profile:{label:'Profile',Icon:User}};
 const destinations=manager?[{label:'Locations',path:'/locations'},{label:'Workforce',path:'/personnel'},{label:'Time',path:'/time-tracking'},{label:'Event Manager',path:'/events'}]:(day.data?.sites||[]).map(s=>({label:s.name,path:'/?mobile=day'}));
 return <><nav aria-label="Phone navigation" className="phone-surface phone-dock fixed bottom-4 left-3 right-3 z-50 rounded-full p-1.5 bg-card"><div className="flex h-14 items-center">{mobileDestinations(role).map(path=>{const {label,Icon}=items[path];const active=path==='/'?location.pathname==='/'&&!location.search:location.pathname===path||path==='profile'&&location.search.includes('profile=1')||path==='/?mobile=hours'&&location.search.includes('mobile=hours');return <Button key={path} aria-label={label} variant="ghost" aria-current={active?'page':undefined} className={cn('relative flex-1 h-12 px-0 flex-col gap-1 rounded-full min-w-0',active&&'bg-secondary')} onClick={()=>path==='add'?setAdd(true):path==='search'?setSearch(true):path==='profile'?navigate('/?profile=1'):navigate(path)}><span className={cn('relative',path==='add'&&'bg-primary text-primary-foreground rounded-full h-10 w-10 -mt-1 flex items-center justify-center')}><Icon className="h-5 w-5"/>{path==='/approvals'&&!!inbox.data?.count&&<span className="absolute -top-2 -right-2 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px]">{inbox.data.count}</span>}</span>{path!=='add'&&<span className="text-[10px] text-foreground">{label}</span>}</Button>;})}</div></nav>{add&&<Suspense fallback={null}><PhoneQuickActions onClose={()=>setAdd(false)}/></Suspense>}<Dialog open={search} onOpenChange={setSearch}><DialogContent className="phone-surface"><DialogHeader><DialogTitle>Search</DialogTitle></DialogHeader><Input aria-label="Search destinations" placeholder={manager?'Locations, workforce, time…':'Your sites…'} value={term} onChange={e=>setTerm(e.target.value)}/>{destinations.filter(d=>d.label.toLowerCase().includes(term.toLowerCase())).map(d=><Button key={d.label} variant="ghost" className="h-12 justify-between" onClick={()=>{setSearch(false);navigate(d.path);}}>{d.label}<ChevronRight className="h-4 w-4"/></Button>)}</DialogContent></Dialog></>;
}
