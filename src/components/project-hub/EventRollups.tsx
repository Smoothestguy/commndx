import {SummaryStrip} from './ProjectDeploymentTab';
import {useCrews} from '@/integrations/supabase/hooks/useCrews';
import {useUserRole} from '@/hooks/useUserRole';
import type {Project} from '@/integrations/supabase/hooks/useProjects';
import type {ProjectLocation} from '@/integrations/supabase/hooks/useProjectLocations';
import {currentWeekStart,addDays} from '@/lib/shifts';
import {formatLocalDate} from '@/lib/dateUtils';
export function EventRollups({project,locations,warningsOnly=false}:{project:Project;locations:ProjectLocation[];warningsOnly?:boolean}) {
  const {data:crews=[]}=useCrews(project.id),{isAdmin,isManager}=useUserRole();
  const from=currentWeekStart(),to=addDays(from,6);
  return <section className="space-y-1">{!warningsOnly&&<h2 className="text-xs text-muted-foreground">Week of {formatLocalDate(from)}</h2>}<SummaryStrip locations={locations} crews={crews} from={from} to={to} mileageRate={project.mileage_rate} canEdit={isAdmin||isManager} warningsOnly={warningsOnly}/></section>;
}