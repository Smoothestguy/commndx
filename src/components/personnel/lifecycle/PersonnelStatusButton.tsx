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
import { LifecycleStatus, useCurrentStatus, useSetStatus, useStatusProjects } from "@/integrations/supabase/hooks/usePersonnelStatus";

export const STATUS_LABEL: Record<LifecycleStatus, string> = {
  available: "Available", unavailable: "Unavailable", standby: "Standby", activated: "Activated", demobilized: "Demobilized",
};

export function statusBadgeClass(s: LifecycleStatus) {
  switch (s) {
    case "available": return "border-success/60 text-success bg-transparent";
    case "unavailable": return "border-muted-foreground/30 text-muted-foreground bg-muted";
    case "standby": return "border-warning/50 bg-warning/15 text-warning";
    case "activated": return "border-success bg-success text-success-foreground";
    case "demobilized": return "border-border bg-secondary text-secondary-foreground";
  }
}

export function StatusBadge({ status, projectName, className }: { status: LifecycleStatus; projectName?: string | null; className?: string }) {
  const showProj = (status === "standby" || status === "activated") && projectName;
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap max-w-[220px] truncate", statusBadgeClass(status), className)}>
      {status === "standby" || status === "activated" ? STATUS_LABEL[status].toUpperCase() : STATUS_LABEL[status]}
      {showProj && <span className="ml-1 font-normal truncate">· {projectName}</span>}
    </Badge>
  );
}

export function StatusProjectDialog({ open, onOpenChange, personnelIds, status, defaultProjectId, lockProject }: {
  open: boolean; onOpenChange: (o: boolean) => void; personnelIds: string[]; status: "standby" | "activated" | "demobilized";
  defaultProjectId?: string | null; lockProject?: boolean;
}) {
  const { data: projects = [] } = useStatusProjects(open && status !== "demobilized");
  const set = useSetStatus();
  const [projectId, setProjectId] = useState<string>("");
  const [note, setNote] = useState("");
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) { setLastOpen(open); if (open) { setProjectId(defaultProjectId ?? ""); setNote(""); } }

  const needsProject = status !== "demobilized";
  const title = status === "standby" ? "Put on standby" : status === "activated" ? "Activate" : "Demobilize";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
        <DialogHeader><DialogTitle>{title}{personnelIds.length > 1 ? ` (${personnelIds.length})` : ""}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {needsProject && (
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

/** Badge + dropdown status machine. Reads from the shared cached status map, so it's safe in long lists. */
export function PersonnelStatusButton({ personnelId, className }: { personnelId: string; className?: string }) {
  const { status, row } = useCurrentStatus(personnelId);
  const { isAdmin, isManager } = useUserRole();
  const canEdit = isAdmin || isManager;
  const set = useSetStatus();
  const [dlg, setDlg] = useState<null | "standby" | "activated" | "demobilized">(null);
  const badge = <StatusBadge status={status} projectName={row?.project_name} className={className} />;
  if (!canEdit) return badge;
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
          <DropdownMenuItem onClick={() => setDlg("activated")}>Activate…</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDlg("demobilized")}>Demobilize</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <StatusProjectDialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)} personnelIds={[personnelId]}
        status={dlg ?? "standby"} defaultProjectId={row?.project_id ?? null} />
    </span>
  );
}
