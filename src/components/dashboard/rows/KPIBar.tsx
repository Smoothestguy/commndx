import { useMemo } from "react";
import { useInvoices } from "@/integrations/supabase/hooks/useInvoices";
import { useEstimates } from "@/integrations/supabase/hooks/useEstimates";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

interface KPIMetric {
  label: string;
  value: string;
  subValue?: string;
  change?: number;
  href?: string;
}

export function KPIBar() {
  const { data: invoices, isLoading: invoicesLoading } = useInvoices();
  const { data: estimates, isLoading: estimatesLoading } = useEstimates();
  const { data: projects, isLoading: projectsLoading } = useProjects();

  const metrics = useMemo<KPIMetric[]>(() => {
    // Revenue MTD - sum of paid invoices this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const paidInvoices = invoices?.filter(
      (inv) => inv.status === "paid" && new Date(inv.created_at) >= startOfMonth
    ) || [];
    const revenueMTD = paidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

    // Open Estimates
    const openEstimates = estimates?.filter(
      (est) => est.status === "draft" || est.status === "sent"
    ) || [];
    const openEstimatesTotal = openEstimates.reduce((sum, est) => sum + (est.total || 0), 0);

    // Pending Invoices
    const pendingInvoices = invoices?.filter(
      (inv) => inv.status === "sent" || inv.status === "partially_paid"
    ) || [];
    const overdueInvoices = invoices?.filter((inv) => {
      if (inv.status === "paid") return false;
      return inv.due_date && new Date(inv.due_date) < now;
    }) || [];

    // Active Projects
    const activeProjects = projects?.filter((p) => p.status === "active") || [];
    const projectsDueSoon = activeProjects.filter((p) => {
      if (!p.end_date) return false;
      const endDate = new Date(p.end_date);
      const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilEnd <= 7 && daysUntilEnd >= 0;
    });

    // Outstanding Balance
    const outstandingInvoices = invoices?.filter(
      (inv) => inv.status !== "paid"
    ) || [];
    const outstandingTotal = outstandingInvoices.reduce(
      (sum, inv) => sum + ((inv.total || 0) - (inv.paid_amount || 0)),
      0
    );

    return [
      {
        label: "Revenue MTD",
        value: `$${(revenueMTD / 1000).toFixed(revenueMTD >= 1000 ? 0 : 1)}k`,
        change: 12.4,
        href: "/invoices",
      },
      {
        label: "Open Estimates",
        value: openEstimates.length.toString(),
        subValue: `$${(openEstimatesTotal / 1000).toFixed(0)}k`,
        href: "/estimates",
      },
      {
        label: "Pending Invoices",
        value: pendingInvoices.length.toString(),
        subValue: `${overdueInvoices.length} overdue`,
        href: "/invoices",
      },
      {
        label: "Active Projects",
        value: activeProjects.length.toString(),
        subValue: projectsDueSoon.length > 0 ? `${projectsDueSoon.length} due soon` : undefined,
        href: "/projects",
      },
      {
        label: "Outstanding",
        value: `$${(outstandingTotal / 1000).toFixed(outstandingTotal >= 1000 ? 0 : 1)}k`,
        subValue: `${outstandingInvoices.length} inv`,
        href: "/invoices",
      },
    ];
  }, [invoices, estimates, projects]);

  const isLoading = invoicesLoading || estimatesLoading || projectsLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-border/50 border border-border/50 rounded-lg overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-card p-4 flex flex-col gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-border/50 border border-border/50 rounded-lg overflow-hidden">
      {metrics.map((metric, index) => (
        <Link
          key={metric.label}
          to={metric.href || "#"}
          className={cn(
            "bg-card p-4 hover:bg-muted/50 transition-colors",
            index === metrics.length - 1 && "col-span-2 sm:col-span-1"
          )}
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {metric.label}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-foreground">{metric.value}</span>
            {metric.change !== undefined && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-xs font-medium",
                  metric.change > 0 && "text-emerald-500",
                  metric.change < 0 && "text-destructive",
                  metric.change === 0 && "text-muted-foreground"
                )}
              >
                {metric.change > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : metric.change < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                {Math.abs(metric.change)}%
              </span>
            )}
          </div>
          {metric.subValue && (
            <p className="text-xs text-muted-foreground mt-1">{metric.subValue}</p>
          )}
        </Link>
      ))}
    </div>
  );
}
