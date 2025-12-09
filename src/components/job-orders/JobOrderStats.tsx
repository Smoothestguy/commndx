import { DollarSign, CheckCircle, Clock, Briefcase } from "lucide-react";
import { JobOrder } from "@/integrations/supabase/hooks/useJobOrders";
import { formatCurrency } from "@/lib/utils";

interface JobOrderStatsProps {
  jobOrders: JobOrder[];
}

export function JobOrderStats({ jobOrders }: JobOrderStatsProps) {
  const totalValue = jobOrders.reduce((sum, j) => sum + j.total, 0);
  const totalInvoiced = jobOrders.reduce((sum, j) => sum + j.invoiced_amount, 0);
  const totalRemaining = jobOrders.reduce((sum, j) => sum + j.remaining_amount, 0);
  const activeJobs = jobOrders.filter((j) => j.status === "active" || j.status === "in-progress").length;

  const stats = [
    {
      label: "Total Value",
      value: formatCurrency(totalValue),
      icon: DollarSign,
      color: "text-primary",
    },
    {
      label: "Invoiced",
      value: formatCurrency(totalInvoiced),
      icon: CheckCircle,
      color: "text-success",
    },
    {
      label: "Remaining",
      value: formatCurrency(totalRemaining),
      icon: Clock,
      color: "text-warning",
    },
    {
      label: "Active Jobs",
      value: activeJobs,
      icon: Briefcase,
      color: "text-primary",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="glass rounded-lg p-4 animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <p className="text-2xl font-heading font-bold text-foreground">
              {stat.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
