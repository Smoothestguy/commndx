import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
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
import {
  MoreHorizontal,
  ExternalLink,
  Link as LinkIcon,
  Edit,
  Copy,
  Archive,
  ArchiveRestore,
  Trash2,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import type { Project } from "@/integrations/supabase/hooks/useProjects";
import { useUserRole } from "@/hooks/useUserRole";
import {
  useArchiveProject,
  useUnarchiveProject,
  useDeleteProject,
  useDuplicateProject,
} from "@/integrations/supabase/hooks/useProjects";
import { useProjectLifecycle } from "@/hooks/useProjectLifecycle";

interface Props {
  project: Project;
  onEdit?: (project: Project) => void;
}

function useRowActions({ project, onEdit }: Props) {
  const navigate = useNavigate();
  const { isAdmin, isManager } = useUserRole();
  const canManage = isAdmin || isManager;
  const archive = useArchiveProject();
  const unarchive = useUnarchiveProject();
  const del = useDeleteProject();
  const lifecycle = useProjectLifecycle();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const actions = lifecycle.availableActions(project);
  const isArchived = !!project.archived_at;

  const open = () => navigate(`/projects/${project.id}`);
  const openNewTab = () => window.open(`/projects/${project.id}`, "_blank", "noopener,noreferrer");
  const copyLink = async () => {
    const url = `${window.location.origin}/projects/${project.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return {
    canManage,
    actions,
    isArchived,
    onEdit,
    open,
    openNewTab,
    copyLink,
    archive: () => archive.mutate({ id: project.id, name: project.name }),
    unarchive: () => unarchive.mutate({ id: project.id, name: project.name }),
    doDelete: () => setConfirmDelete(true),
    lifecycle,
    confirmCancel,
    setConfirmCancel,
    confirmDelete,
    setConfirmDelete,
    del,
  };
}

function renderMenuItems(
  a: ReturnType<typeof useRowActions>,
  project: Project,
  ItemComp: any,
  SepComp: any,
) {
  return (
    <>
      <ItemComp onSelect={a.open}>
        <ExternalLink className="h-4 w-4 mr-2" /> Open
      </ItemComp>
      <ItemComp onSelect={a.openNewTab}>
        <ExternalLink className="h-4 w-4 mr-2" /> Open in New Tab
      </ItemComp>
      <ItemComp onSelect={a.copyLink}>
        <LinkIcon className="h-4 w-4 mr-2" /> Copy Link
      </ItemComp>

      {a.canManage && a.onEdit && (
        <>
          <SepComp />
          <ItemComp onSelect={() => a.onEdit!(project)}>
            <Edit className="h-4 w-4 mr-2" /> Edit
          </ItemComp>
        </>
      )}

      {a.canManage && a.actions.length > 0 && (
        <>
          <SepComp />
          {a.actions.includes("complete") && (
            <ItemComp onSelect={() => a.lifecycle.markCompleted(project)}>
              <CheckCircle2 className="h-4 w-4 mr-2 text-success" /> Mark Completed
            </ItemComp>
          )}
          {a.actions.includes("hold") && (
            <ItemComp onSelect={() => a.lifecycle.putOnHold(project)}>
              <PauseCircle className="h-4 w-4 mr-2 text-warning" /> Put On Hold
            </ItemComp>
          )}
          {a.actions.includes("reactivate") && (
            <ItemComp onSelect={() => a.lifecycle.reactivate(project)}>
              <PlayCircle className="h-4 w-4 mr-2 text-primary" /> Reactivate
            </ItemComp>
          )}
          {a.actions.includes("cancel") && (
            <ItemComp onSelect={() => a.setConfirmCancel(true)} className="text-destructive focus:text-destructive">
              <XCircle className="h-4 w-4 mr-2" /> Cancel Project
            </ItemComp>
          )}
        </>
      )}

      {a.canManage && (
        <>
          <SepComp />
          {a.isArchived ? (
            <ItemComp onSelect={a.unarchive}>
              <ArchiveRestore className="h-4 w-4 mr-2" /> Unarchive
            </ItemComp>
          ) : (
            <ItemComp onSelect={a.archive}>
              <Archive className="h-4 w-4 mr-2" /> Archive
            </ItemComp>
          )}
          <ItemComp onSelect={a.doDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </ItemComp>
        </>
      )}
    </>
  );
}

function ProjectDialogs({ a, project }: { a: ReturnType<typeof useRowActions>; project: Project }) {
  return (
    <>
      <AlertDialog open={a.confirmCancel} onOpenChange={a.setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {project.name}?</AlertDialogTitle>
            <AlertDialogDescription>This marks the project canceled.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Project</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => a.lifecycle.cancelProject(project)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={a.confirmDelete} onOpenChange={a.setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This moves the project to Trash. It can be restored by an admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => a.del.mutate(project.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Right-click context menu wrapper for a project. */
export function ProjectContextMenu({
  project,
  onEdit,
  children,
}: Props & { children: React.ReactNode }) {
  const a = useRowActions({ project, onEdit });
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {renderMenuItems(a, project, ContextMenuItem, ContextMenuSeparator)}
        </ContextMenuContent>
      </ContextMenu>
      <ProjectDialogs a={a} project={project} />
    </>
  );
}

/** Compact "⋯" dropdown for row actions. */
export function ProjectRowActionsMenu({ project, onEdit }: Props) {
  const a = useRowActions({ project, onEdit });
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => e.stopPropagation()}
            aria-label="Row actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
          {renderMenuItems(a, project, DropdownMenuItem, DropdownMenuSeparator)}
        </DropdownMenuContent>
      </DropdownMenu>
      <ProjectDialogs a={a} project={project} />
    </>
  );
}
