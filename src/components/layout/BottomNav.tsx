import { useNavigate, useLocation } from 'react-router-dom';
import { Home, MapPin, CheckCheck, Clock, Grid2X2, MessageCircle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useMobileApprovals } from '@/hooks/useMobileApprovals';
import { mobileDestinations } from '@/lib/mobileOperations';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
const items:Record<string,{label:string;icon:typeof Home}>={
 '/':{label:'Home',icon:Home},'/locations':{label:'Locations',icon:MapPin},'/approvals':{label:'Approvals',icon:CheckCheck},'/time-tracking':{label:'Time',icon:Clock},'/messages':{label:'Messages',icon:MessageCircle},more:{label:'More',icon:Grid2X2}
};
export function BottomNav({onMoreClick}:{onMoreClick?:()=>void}) {
 const navigate=useNavigate(),location=useLocation(),mobile=useIsMobile(),{user}=useAuth(),{role}=useUserRole();
 const inbox=useMobileApprovals(mobile&&!!user);
 if(!mobile||!user||['/auth','/accept-invitation','/approve','/apply','/onboard','/contractor','/join','/portal','/vendor','/subcontractor','/punch','/timesheet-sign'].some(p=>location.pathname.startsWith(p)))return null;
 return <nav aria-label="Phone navigation" className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-bottom"><div className="flex h-16 items-center px-1">{mobileDestinations(role).map(path=>{const item=items[path],Icon=item.icon;const active=path==='/'?location.pathname==='/':location.pathname.startsWith(path);return <Button key={path} variant="ghost" aria-current={active?'page':undefined} className={cn('relative flex-1 min-w-0 h-14 px-0 flex-col gap-1 rounded-none',active&&'text-primary')} onClick={()=>path==='more'?onMoreClick?.():navigate(path)}><span className="relative"><Icon className="h-5 w-5"/>{path==='/approvals'&&(inbox.data?.count||inbox.error)&&<span aria-label={inbox.error?'Approvals unavailable':`${inbox.data?.count} pending actions`} className="absolute -top-2 -right-3 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px]">{inbox.error?'!':inbox.data?.count}</span>}</span><span className="text-[10px]">{item.label}</span></Button>;})}</div></nav>;
}
