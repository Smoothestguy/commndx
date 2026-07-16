import { useState } from "react";
import { CheckCircle2, XCircle, PauseCircle, PlayCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Project } from "@/integrations/supabase/hooks/useProjects";
import { useProjectLifecycle, type LifecycleAction } from "@/hooks/useProjectLifecycle";

interface ProjectStatusMenuProps {
  project: Project;
  triggerLabel?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost";
  onlyItems?: boolean; // render as menu items only (for embedding in other menus)
  onItemsRender?: (items: React.ReactNode) => React.ReactNode;
}

export function ProjectStatusMenu({
  project,
  triggerLabel = "Status",
  size = "default",
  variant = "outline",
}: ProjectStatusMenuProps) {
  const { markCompleted, cancelProject, putOnHold, reactivate, availableActions, isPending } =
    useProjectLifecycle();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const actions = availableActions(project);

  if (actions.length === 0) return null;

  const run = (a: LifecycleAction) => {
    if (a === "complete") markCompleted(project);
    else if (a === "cancel") setConfirmCancel(true);
    else if (a === "hold") putOnHold(project);
    else if (a === "reactivate") reactivate(project);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size} disabled={isPending}>
            {triggerLabel}
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.includes("complete") && (
            <DropdownMenuItem onClick={() => run("complete")}>
              <CheckCircle2 className="h-4 w-4 mr-2 text-success" />
              Mark Completed
            </DropdownMenuItem>
          )}
          {actions.includes("hold") && (
            <DropdownMenuItem onClick={() => run("hold")}>
              <PauseCircle className="h-4 w-4 mr-2 text-warning" />
              Put On Hold
            </DropdownMenuItem>
          )}
          {actions.includes("reactivate") && (
            <DropdownMenuItem onClick={() => run("reactivate")}>
              <PlayCircle className="h-4 w-4 mr-2 text-primary" />
              Reactivate
            </DropdownMenuItem>
          )}
          {actions.includes("cancel") && (
            <DropdownMenuItem onClick={() => run("cancel")} className="text-destructive focus:text-destructive">
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Project
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {project.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks the project canceled. You can reactivate it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Project</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelProject(project)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
