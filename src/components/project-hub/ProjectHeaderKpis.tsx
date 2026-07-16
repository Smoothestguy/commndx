import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Users, DollarSign, Target, Briefcase } from "lucide-react";
import { useJobOrdersByProject } from "@/integrations/supabase/hooks/useJobOrders";
import { useMilestonesByProject } from "@/integrations/supabase/hooks/useMilestones";

interface Props {
  projectId: string;
}

function Chip({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card className="glass border-border p-3 flex items-center gap-3 min-w-0">
      <div className="text-primary shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className="text-sm font-semibold truncate">{value}</div>
      </div>
    </Card>
  );
}

export function ProjectHeaderKpis({ projectId }: Props) {
  const { data: jobOrders = [] } = useJobOrdersByProject(projectId);
  const { data: milestones = [] } = useMilestonesByProject(projectId);

  const { data: crewCount = 0 } = useQuery({
    queryKey: ["personnel-assignment-counts", [projectId]],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("personnel_project_assignments")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("status", "active");
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: recruiting } = useQuery({
    queryKey: ["project-recruiting-kpi", projectId],
    queryFn: async () => {
      const { data: taskOrders } = await supabase
        .from("project_task_orders")
        .select("id")
        .eq("project_id", projectId);
      const taskOrderIds = (taskOrders || []).map((t) => t.id);
      if (!taskOrderIds.length) return { needed: 0, filled: 0 };

      const [posRes, appRes] = await Promise.all([
        supabase
          .from("task_order_positions")
          .select("headcount")
          .in("task_order_id", taskOrderIds),
        supabase
          .from("applications")
          .select("id", { count: "exact", head: true })
          .in("task_order_id", taskOrderIds)
          .eq("status", "approved"),
      ]);
      const positions = (posRes.data || []) as Array<{ headcount: number | null }>;
      const needed = positions.reduce((s, p) => s + (p.headcount || 0), 0);
      return { needed, filled: appRes.count || 0 };
    },
  });

  const contractValue = jobOrders.reduce((s, j: any) => s + (j.total || 0), 0);

  const progressPct = (() => {
    if (milestones.length > 0) {
      const avg =
        milestones.reduce((s, m: any) => s + (m.completion_percentage || 0), 0) / milestones.length;
      return Math.round(avg);
    }
    if (jobOrders.length > 0) {
      const completed = jobOrders.filter((j: any) => j.status === "completed").length;
      return Math.round((completed / jobOrders.length) * 100);
    }
    return 0;
  })();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
      <Chip
        icon={<DollarSign className="h-4 w-4" />}
        label="Contract Value"
        value={`$${contractValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
      />
      <Chip
        icon={<Users className="h-4 w-4" />}
        label="Crew Assigned"
        value={crewCount}
      />
      <Chip
        icon={<Briefcase className="h-4 w-4" />}
        label="Recruiting"
        value={recruiting ? `${recruiting.filled} / ${recruiting.needed}` : "—"}
      />
      <Chip
        icon={<Target className="h-4 w-4" />}
        label="Progress"
        value={`${progressPct}%`}
      />
    </div>
  );
}
