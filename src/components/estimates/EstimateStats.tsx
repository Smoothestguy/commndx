import { FileText, DollarSign, Edit, CheckCircle } from "lucide-react";
import { Estimate } from "@/integrations/supabase/hooks/useEstimates";
import { formatCurrency } from "@/lib/utils";

interface EstimateStatsProps {
  estimates: Estimate[];
}

export function EstimateStats({ estimates }: EstimateStatsProps) {
  const totalValue = estimates.reduce((sum, e) => sum + e.total, 0);
  const draftCount = estimates.filter((e) => e.status === "draft").length;
  const approvedCount = estimates.filter((e) => e.status === "approved").length;

  const stats = [
    {
      label: "Total Estimates",
      value: estimates.length,
      icon: FileText,
      color: "text-primary",
    },
    {
      label: "Total Value",
      value: formatCurrency(totalValue),
      icon: DollarSign,
      color: "text-success",
    },
    {
      label: "Draft",
      value: draftCount,
      icon: Edit,
      color: "text-muted-foreground",
    },
    {
      label: "Approved",
      value: approvedCount,
      icon: CheckCircle,
      color: "text-success",
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
