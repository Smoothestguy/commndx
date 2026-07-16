import { useUpdateProject, type Project } from "@/integrations/supabase/hooks/useProjects";
import { format } from "date-fns";

export type LifecycleAction = "complete" | "cancel" | "hold" | "reactivate";

export function useProjectLifecycle() {
  const updateProject = useUpdateProject();

  const markCompleted = (project: Pick<Project, "id" | "end_date">) => {
    const patch: any = { id: project.id, status: "completed", stage: "complete" };
    if (!project.end_date) patch.end_date = format(new Date(), "yyyy-MM-dd");
    return updateProject.mutateAsync(patch);
  };

  const cancelProject = (project: Pick<Project, "id">) =>
    updateProject.mutateAsync({ id: project.id, stage: "canceled" } as any);

  const putOnHold = (project: Pick<Project, "id">) =>
    updateProject.mutateAsync({ id: project.id, status: "on-hold" } as any);

  const reactivate = (project: Pick<Project, "id">) =>
    updateProject.mutateAsync({ id: project.id, status: "active", stage: "active" } as any);

  const availableActions = (project: Project): LifecycleAction[] => {
    const actions: LifecycleAction[] = [];
    const isCompleted = project.status === "completed" || project.stage === "complete";
    const isCanceled = project.stage === "canceled";
    const isOnHold = project.status === "on-hold";
    const isActive = project.status === "active" && !isCompleted && !isCanceled;

    if (!isCompleted && !isCanceled) actions.push("complete");
    if (!isCanceled && !isCompleted) actions.push("cancel");
    if (!isOnHold && !isCompleted && !isCanceled) actions.push("hold");
    if (isCompleted || isCanceled || isOnHold || !isActive) {
      if (!(project.status === "active" && project.stage === "active")) actions.push("reactivate");
    }
    return actions;
  };

  return {
    markCompleted,
    cancelProject,
    putOnHold,
    reactivate,
    availableActions,
    isPending: updateProject.isPending,
  };
}
