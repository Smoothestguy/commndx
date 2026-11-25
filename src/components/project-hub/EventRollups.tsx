import {useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {SummaryStrip} from './ProjectDeploymentTab';
import {useCrews} from '@/integrations/supabase/hooks/useCrews';
import {useUserRole} from '@/hooks/useUserRole';
import type {Project} from '@/integrations/supabase/hooks/useProjects';
import type {ProjectLocation} from '@/integrations/supabase/hooks/useProjectLocations';
import {currentWeekStart,addDays} from '@/lib/shifts';
import {Button} from '@/components/ui/button';
export function EventRollups({project,locations,warningsOnly=false}:{project:Project;locations:ProjectLocation[];warningsOnly?:boolean}) {
  const {data:crews=[]}=useCrews(project.id),{isAdmin,isManager}=useUserRole();
  const [from,setFrom]=useState(currentWeekStart()),to=addDays(from,6),isCurrent=from===currentWeekStart();
  const fmt=(d:string)=>{const [y,m,day]=d.split('-');return `${Number(m)}/${Number(day)}/${y.slice(2)}`;};
  return <section className="space-y-1">{!warningsOnly&&<div className="flex items-center gap-1 text-xs text-muted-foreground"><Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous week" onClick={()=>setFrom(addDays(from,-7))}><ChevronLeft className="h-4 w-4"/></Button><h2>Week of {fmt(from)} – {fmt(to)}</h2><Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Next week" disabled={isCurrent} onClick={()=>setFrom(addDays(from,7))}><ChevronRight className="h-4 w-4"/></Button>{!isCurrent&&<Button type="button" variant="link" size="sm" className="h-8 text-xs" onClick={()=>setFrom(currentWeekStart())}>This week</Button>}</div>}<SummaryStrip locations={locations} crews={crews} from={from} to={to} mileageRate={project.mileage_rate} canEdit={isAdmin||isManager} warningsOnly={warningsOnly}/></section>;
}
