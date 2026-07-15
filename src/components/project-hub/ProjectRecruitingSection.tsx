import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";
import {
  Briefcase,
  Plus,
  Copy,
  ExternalLink,
  Settings,
  Send,
  Loader2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

import {
  useTaskOrders,
  useCreateJobPosting,
  useToggleJobPosting,
  useApplications,
  type TaskOrder,
  type TaskOrderPosition,
  type JobPosting,
  type Application,
} from "@/integrations/supabase/hooks/useStaffingApplications";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { TaskOrderFacts } from "@/components/staffing/TaskOrderFacts";
import { TaskOrderWizard } from "@/components/staffing/TaskOrderWizard";
import { InviteNearbyApplicantsDialog } from "@/components/staffing/InviteNearbyApplicantsDialog";
import { InvitePastWorkersDialog } from "@/components/staffing/InvitePastWorkersDialog";
import { ProjectApplicantsSection } from "@/components/project-hub/ProjectApplicantsSection";

interface Props {
  projectId: string;
}

// --- Small QR component ---
function QrCodeThumb({ value, size = 96 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, { width: size, margin: 1 }).catch(() => {});
    }
  }, [value, size]);
  return <canvas ref={canvasRef} width={size} height={size} className="rounded border bg-white" />;
}

function normPos(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

interface TaskOrderCardProps {
  taskOrder: TaskOrder;
  posting: JobPosting | null;
  positions: TaskOrderPosition[];
  applications: Application[];
  defaultFormTemplateId: string | null;
  onEditTaskOrder: (t: TaskOrder) => void;
}

function TaskOrderCard({
  taskOrder,
  posting,
  positions,
  applications,
  defaultFormTemplateId,
  onEditTaskOrder,
}: TaskOrderCardProps) {
  const createPosting = useCreateJobPosting();
  const togglePosting = useToggleJobPosting();

  const [inviteNearbyOpen, setInviteNearbyOpen] = useState(false);
  const [invitePastOpen, setInvitePastOpen] = useState(false);

  const applyUrl = posting
    ? `${window.location.origin}/apply/${posting.public_token}`
    : "";

  // approved-per-position tallies
  const approved = applications.filter((a) => a.status === "approved");
  const positionCounts = useMemo(() => {
    const map = new Map<string, number>();
    let unassigned = 0;
    const knownLabels = new Set(positions.map((p) => normPos(p.position_label)));
    for (const app of approved) {
      const ans = app.answers as Record<string, unknown> | null;
      const raw = normPos(ans?.position_applying_for);
      if (raw && knownLabels.has(raw)) {
        map.set(raw, (map.get(raw) ?? 0) + 1);
      } else {
        unassigned += 1;
      }
    }
    return { map, unassigned };
  }, [approved, positions]);

  const totalHeadcount = positions.reduce((s, p) => s + (p.headcount || 0), 0);
  const totalApproved = approved.length;
  const allFilled = totalHeadcount > 0 && totalApproved >= totalHeadcount;

  const postingForInvite = posting
    ? {
        ...posting,
        project_task_orders: {
          ...taskOrder,
          projects: (taskOrder as any).projects,
        },
        positions,
      }
    : null;

  const handleCreatePosting = async () => {
    try {
      await createPosting.mutateAsync({
        taskOrderId: taskOrder.id,
        formTemplateId: defaultFormTemplateId || undefined,
      });
      toast.success("Posting created — apply link is now active");
    } catch (e: any) {
      toast.error(e.message || "Failed to create posting");
    }
  };

  const handleToggleOpen = async (isOpen: boolean) => {
    if (!posting) return;
    try {
      await togglePosting.mutateAsync({ id: posting.id, is_open: isOpen });
      toast.success(isOpen ? "Posting reopened" : "Posting closed");
    } catch (e: any) {
      toast.error(e.message || "Failed to update posting");
    }
  };

  const handleCopy = () => {
    if (!applyUrl) return;
    navigator.clipboard.writeText(applyUrl);
    toast.success("Apply link copied");
  };

  return (
    <Card className="border-l-4 border-l-primary/60">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              {taskOrder.title}
              <Badge variant="outline" className="text-xs capitalize">
                {taskOrder.status}
              </Badge>
              {posting && (
                <Badge
                  variant="outline"
                  className={
                    posting.is_open
                      ? "text-xs bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30"
                      : "text-xs bg-muted text-muted-foreground"
                  }
                >
                  {posting.is_open ? "Open" : "Closed"}
                </Badge>
              )}
              {totalHeadcount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {totalApproved} / {totalHeadcount} hired
                </Badge>
              )}
            </CardTitle>
            <TaskOrderFacts className="mt-2" taskOrder={taskOrder} />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onEditTaskOrder(taskOrder)}>
              <Settings className="h-4 w-4 mr-1" />
              Edit details
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Apply link block */}
        {posting ? (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex flex-wrap items-start gap-3">
              <QrCodeThumb value={applyUrl} />
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Apply link</Label>
                  <div className="font-mono text-xs break-all">{applyUrl}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopy}>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(applyUrl, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setInviteNearbyOpen(true)}>
                    <Send className="h-4 w-4 mr-1" />
                    Invite Nearby
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setInvitePastOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-1" />
                    Invite Past Workers
                  </Button>
                  <div className="flex items-center gap-2 ml-auto">
                    <Label htmlFor={`open-${posting.id}`} className="text-xs">
                      Accepting applications
                    </Label>
                    <Switch
                      id={`open-${posting.id}`}
                      checked={posting.is_open}
                      onCheckedChange={handleToggleOpen}
                      disabled={togglePosting.isPending}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground flex items-center justify-between gap-2">
            <span>No posting yet — applicants can’t apply until one exists.</span>
            <Button size="sm" onClick={handleCreatePosting} disabled={createPosting.isPending}>
              {createPosting.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Create posting & apply link
            </Button>
          </div>
        )}

        {/* Positions progress */}
        {positions.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Positions
            </div>
            <div className="space-y-2">
              {positions.map((p) => {
                const key = normPos(p.position_label);
                const filled = positionCounts.map.get(key) ?? 0;
                const pct = p.headcount > 0 ? Math.min(100, (filled / p.headcount) * 100) : 0;
                return (
                  <div key={p.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{p.position_label}</span>
                        {p.advertised_pay_rate != null && p.show_pay_publicly !== false && (
                          <span className="text-xs text-muted-foreground">
                            ${Number(p.advertised_pay_rate).toFixed(2)}/hr
                          </span>
                        )}
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {filled} of {p.headcount} hired
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
              {positionCounts.unassigned > 0 && (
                <div className="text-xs text-muted-foreground italic">
                  + {positionCounts.unassigned} approved with no matching position
                </div>
              )}
            </div>

            {allFilled && posting?.is_open && (
              <div className="mt-2 rounded-md border bg-amber-500/10 border-amber-500/30 px-3 py-2 flex items-center justify-between gap-2 text-sm">
                <span>All positions filled — close applications?</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleOpen(false)}
                  disabled={togglePosting.isPending}
                >
                  Close posting
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {postingForInvite && (
        <>
          <InviteNearbyApplicantsDialog
            open={inviteNearbyOpen}
            onOpenChange={setInviteNearbyOpen}
            posting={postingForInvite}
          />
          <InvitePastWorkersDialog
            open={invitePastOpen}
            onOpenChange={setInvitePastOpen}
            posting={postingForInvite}
          />
        </>
      )}
    </Card>
  );
}

export function ProjectRecruitingSection({ projectId }: Props) {
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<TaskOrder | null>(null);

  const { data: taskOrders = [], isLoading: loadingTOs } = useTaskOrders(projectId);
  const { data: settings } = useCompanySettings();
  const { data: applications = [] } = useApplications({ projectId });

  const taskOrderIds = useMemo(() => taskOrders.map((t) => t.id), [taskOrders]);

  const { data: postings = [] } = useQuery({
    queryKey: ["project-recruiting-postings", projectId, taskOrderIds],
    enabled: taskOrderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_postings")
        .select("*")
        .in("task_order_id", taskOrderIds);
      if (error) throw error;
      return data as JobPosting[];
    },
  });

  const { data: allPositions = [] } = useQuery({
    queryKey: ["project-recruiting-positions", projectId, taskOrderIds],
    enabled: taskOrderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_order_positions")
        .select("*")
        .in("task_order_id", taskOrderIds);
      if (error) throw error;
      return data as TaskOrderPosition[];
    },
  });

  // Invalidate downstream when new posting/positions may have appeared
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["project-recruiting-postings", projectId] });
  }, [taskOrders.length, queryClient, projectId]);

  const defaultTemplateId = (settings as any)?.default_form_template_id ?? null;

  const handleEdit = (t: TaskOrder) => {
    setEditing(t);
    setWizardOpen(true);
  };
  const handleAdd = () => {
    setEditing(null);
    setWizardOpen(true);
  };

  return (
    <section id="recruiting" className="scroll-mt-24">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="h-5 w-5 text-primary" />
              Recruiting
              {taskOrders.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {taskOrders.length} task order{taskOrders.length === 1 ? "" : "s"}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Postings, positions, invites and applicant pipeline for this project.
            </CardDescription>
          </div>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Add Crew / Scope
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {loadingTOs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : taskOrders.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No task orders yet. Click <span className="font-medium">Add Crew / Scope</span> to
              create your first hiring scope.
            </div>
          ) : (
            <div className="space-y-4">
              {taskOrders.map((t) => {
                const posting = postings.find((p) => p.task_order_id === t.id) ?? null;
                const positions = allPositions.filter((p) => p.task_order_id === t.id);
                const apps = posting
                  ? applications.filter((a) => a.job_posting_id === posting.id)
                  : [];
                return (
                  <TaskOrderCard
                    key={t.id}
                    taskOrder={t}
                    posting={posting}
                    positions={positions}
                    applications={apps}
                    defaultFormTemplateId={defaultTemplateId}
                    onEditTaskOrder={handleEdit}
                  />
                );
              })}
            </div>
          )}

          <Separator />

          {/* Pipeline — reuse existing project applicants section (list + detail dialog) */}
          <ProjectApplicantsSection projectId={projectId} hideAddButton />
        </CardContent>
      </Card>

      <TaskOrderWizard
        open={wizardOpen}
        onOpenChange={(o) => {
          setWizardOpen(o);
          if (!o) setEditing(null);
        }}
        mode={editing ? "edit" : "create"}
        taskOrder={editing}
        defaultProjectId={projectId}
      />
    </section>
  );
}
