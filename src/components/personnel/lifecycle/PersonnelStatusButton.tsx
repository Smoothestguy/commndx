import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LifecycleStatus, useCurrentStatus, useOnSiteMap, useSetStatus, useStatusProjects } from "@/integrations/supabase/hooks/usePersonnelStatus";

export const STATUS_LABEL: Record<LifecycleStatus, string> = {
  available: "Available", unavailable: "Unavailable", standby: "Standby", mobilizing: "Mobilizing", activated: "Activated", demobilized: "Demobilized",
};

export function statusBadgeClass(s: LifecycleStatus) {
  switch (s) {
    case "available": return "border-success/60 text-success bg-transparent";
    case "unavailable": return "border-muted-foreground/30 text-muted-foreground bg-muted";
    case "standby": return "border-warning/50 bg-warning/15 text-warning";
    case "mobilizing": return "border-info/50 bg-info/15 text-info";
    case "activated": return "border-success bg-success text-success-foreground";
    case "demobilized": return "border-border bg-secondary text-secondary-foreground";
  }
}

export function StatusBadge({ status, projectName, className, hideProjectName }: { status: LifecycleStatus; projectName?: string | null; className?: string; hideProjectName?: boolean }) {
  const loud = status === "standby" || status === "mobilizing" || status === "activated";
  const showProj = loud && projectName && !hideProjectName;
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap max-w-[220px] truncate", statusBadgeClass(status), className)}>
      {loud ? STATUS_LABEL[status].toUpperCase() : STATUS_LABEL[status]}
      {showProj && <span className="ml-1 font-normal truncate">· {projectName}</span>}
    </Badge>
  );
}

type DlgStatus = "standby" | "mobilizing" | "activated" | "demobilized";

export function StatusProjectDialog({ open, onOpenChange, personnelIds, status, defaultProjectId, lockProject, fixedProjectName }: {
  open: boolean; onOpenChange: (o: boolean) => void; personnelIds: string[]; status: DlgStatus;
  defaultProjectId?: string | null; lockProject?: boolean; fixedProjectName?: string | null;
}) {
  const { data: projects = [] } = useStatusProjects(open && status !== "demobilized" && !lockProject);
  const set = useSetStatus();
  const [projectId, setProjectId] = useState<string>("");
  const [note, setNote] = useState("");
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) { setLastOpen(open); if (open) { setProjectId(defaultProjectId ?? ""); setNote(""); } }

  const needsProject = status !== "demobilized";
  const title = status === "standby" ? "Put on standby" : status === "mobilizing" ? "Mobilize" : status === "activated" ? "Activate" : "Demobilize";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
        <DialogHeader><DialogTitle>{title}{personnelIds.length > 1 ? ` (${personnelIds.length})` : ""}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {needsProject && lockProject && (
            <div><Label>Project</Label><p className="text-sm font-medium py-1">{fixedProjectName || projects.find((p) => p.id === defaultProjectId)?.name || "This project"}</p></div>
          )}
          {needsProject && !lockProject && (
            <div><Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId} disabled={lockProject}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.stage !== "active" ? ` (${p.stage.replace("_", " ")})` : ""}</SelectItem>)}
                  {lockProject && defaultProjectId && !projects.some((p) => p.id === defaultProjectId) && <SelectItem value={defaultProjectId}>This project</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          )}
          <div><Label>Note (optional)</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={set.isPending || (needsProject && !projectId)}
            onClick={() => set.mutate({ personnelIds, status, project_id: needsProject ? projectId : defaultProjectId ?? null, note }, { onSuccess: () => onOpenChange(false) })}>
            {set.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}{title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useOnSiteBadge(personnelId: string, status: LifecycleStatus, projectName: string | null | undefined, className?: string, hideLocationId?: string | null, hideProject?: boolean) {
  const { data: onSite } = useOnSiteMap();
  const os = onSite?.[personnelId];
  if (!os) return null;
  // Scoped to a location row: never blend another site's presence into this location's status.
  if (hideLocationId && os.location_id !== hideLocationId) return null;
  const showLoc = !hideLocationId;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn("whitespace-nowrap max-w-[220px] truncate border-success bg-success/15 text-success animate-pulse", className)}>
          ON SITE{showLoc && <span className="ml-1 font-normal truncate">· {os.location_name ?? "site"}</span>}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>On site at {os.location_name ?? "site"} · Status: {STATUS_LABEL[status]}{projectName && !hideProject ? ` · ${projectName}` : ""}</TooltipContent>
    </Tooltip>
  );
}

/** Badge + dropdown status machine. Reads from shared cached maps (status + on-site), so it's safe in long lists.
 *  When `projectId` is given, project-scoped actions skip the project picker and use that project. */
export function PersonnelStatusButton({ personnelId, className, projectId, projectName, hideProjectName, locationId }: {
  personnelId: string; className?: string; projectId?: string | null; projectName?: string | null;
  /** Inside a project page: omit the project name from the badge (only when it is this project). */
  hideProjectName?: boolean;
  /** Row's location: ON SITE badge omits the site name when it matches. */
  locationId?: string | null;
}) {
  const { status, row } = useCurrentStatus(personnelId);
  const { isAdmin, isManager } = useUserRole();
  const canEdit = isAdmin || isManager;
  const set = useSetStatus();
  const [dlg, setDlg] = useState<null | DlgStatus>(null);
  const hideProj = !!hideProjectName && (!projectId || !row?.project_id || row.project_id === projectId);
  const onSiteBadge = useOnSiteBadge(personnelId, status, row?.project_name, className, locationId, hideProj);
  const badge = onSiteBadge ?? <StatusBadge status={status} projectName={row?.project_name} className={className} hideProjectName={hideProj} />;
  if (!canEdit) return badge;
  const locked = !!projectId && dlg !== "demobilized";
  return (
    <span onClick={(e) => e.stopPropagation()} className="inline-flex">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="inline-flex items-center gap-0.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Change status">
            {badge}<ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem disabled={status === "available"} onClick={() => set.mutate({ personnelIds: [personnelId], status: "available" })}>Set Available</DropdownMenuItem>
          <DropdownMenuItem disabled={status === "unavailable"} onClick={() => set.mutate({ personnelIds: [personnelId], status: "unavailable" })}>Set Unavailable</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDlg("standby")}>Put on Standby…</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDlg("mobilizing")}>Mobilize…</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDlg("activated")}>Activate…</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDlg("demobilized")}>Demobilize</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <StatusProjectDialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)} personnelIds={[personnelId]}
        status={dlg ?? "standby"} defaultProjectId={locked ? projectId : row?.project_id ?? null}
        lockProject={locked} fixedProjectName={locked ? projectName : null} />
    </span>
  );
}
