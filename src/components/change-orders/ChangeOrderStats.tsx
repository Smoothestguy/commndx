import { StatCard } from "@/components/dashboard/StatCard";
import { FileEdit, Clock, CheckCircle, Receipt } from "lucide-react";
import { ChangeOrder } from "@/integrations/supabase/hooks/useChangeOrders";
import { formatCurrency } from "@/lib/utils";

interface ChangeOrderStatsProps {
  changeOrders: ChangeOrder[];
}

export function ChangeOrderStats({ changeOrders }: ChangeOrderStatsProps) {
  const stats = {
    total: changeOrders.length,
    draft: changeOrders.filter((co) => co.status === "draft").length,
    pending: changeOrders.filter((co) => co.status === "pending_approval").length,
    approved: changeOrders.filter((co) => co.status === "approved").length,
    rejected: changeOrders.filter((co) => co.status === "rejected").length,
    invoiced: changeOrders.filter((co) => co.status === "invoiced").length,
    totalValue: changeOrders.reduce((sum, co) => sum + co.total, 0),
    approvedValue: changeOrders
      .filter((co) => co.status === "approved" || co.status === "invoiced")
      .reduce((sum, co) => sum + co.total, 0),
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Change Orders"
        value={stats.total}
        icon={FileEdit}
        change={`${formatCurrency(stats.totalValue)} total value`}
      />
      <StatCard
        title="Pending Approval"
        value={stats.pending}
        icon={Clock}
        change={`${stats.draft} drafts`}
      />
      <StatCard
        title="Approved"
        value={stats.approved}
        icon={CheckCircle}
        change={`${formatCurrency(stats.approvedValue)} approved`}
      />
      <StatCard
        title="Invoiced"
        value={stats.invoiced}
        icon={Receipt}
        change={`${stats.rejected} rejected`}
      />
    </div>
  );
}
