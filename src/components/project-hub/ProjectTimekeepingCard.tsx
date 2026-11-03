import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/integrations/supabase/hooks/useProjects";
import { useProjectLocations } from "@/integrations/supabase/hooks/useProjectLocations";
import { useCrews } from "@/integrations/supabase/hooks/useCrews";
import { useUserRole } from "@/hooks/useUserRole";
import { addDays, chicagoParts } from "@/lib/shifts";
import { VisitsCard } from "./ProjectDeploymentTab";

/** Visits/Trail/Timesheet card for non-deployment projects, shown only when trail rows exist. */
export function ProjectTimekeepingCard({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId);
  const deployment = !!(project as any)?.deployment_mode;
  const { data: hasTrail } = useQuery({
    queryKey: ["has-trail", projectId],
    enabled: !!projectId && !!project && !deployment,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("personnel_location_trail").select("visit_personnel_id").eq("project_id", projectId).limit(1);
      if (error) throw error;
      return (data ?? []).length > 0;
    },
  });
  const { data: locations = [] } = useProjectLocations(hasTrail ? projectId : undefined);
  const { data: crews = [] } = useCrews(hasTrail ? projectId : undefined);
  const { isAdmin, isManager } = useUserRole();
  if (deployment || !hasTrail) return null;
  const to = chicagoParts(new Date()).date;
  return <VisitsCard projectId={projectId} locations={locations} crews={crews} from={addDays(to, -6)} to={to}
    canEdit={isAdmin || isManager} defaultView="timesheet" />;
}
