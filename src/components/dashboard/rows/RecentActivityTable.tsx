import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useInvoices } from "@/integrations/supabase/hooks/useInvoices";
import { useEstimates } from "@/integrations/supabase/hooks/useEstimates";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  type: "estimate" | "invoice";
  number: string;
  client: string;
  amount: number;
  when: Date;
  href: string;
}

export function RecentActivityTable() {
  const { data: invoices, isLoading: invoicesLoading } = useInvoices();
  const { data: estimates, isLoading: estimatesLoading } = useEstimates();

  const activities = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    // Add estimates
    estimates?.forEach((est) => {
      items.push({
        id: est.id,
        type: "estimate",
        number: est.number,
        client: est.customer_name,
        amount: est.total || 0,
        when: new Date(est.created_at),
        href: `/estimates/${est.id}`,
      });
    });

    // Add invoices
    invoices?.forEach((inv) => {
      items.push({
        id: inv.id,
        type: "invoice",
        number: inv.number,
        client: inv.customer_name,
        amount: inv.total || 0,
        when: new Date(inv.created_at),
        href: `/invoices/${inv.id}`,
      });
    });

    // Sort by date and take top 5
    return items
      .sort((a, b) => b.when.getTime() - a.when.getTime())
      .slice(0, 5);
  }, [invoices, estimates]);

  const isLoading = invoicesLoading || estimatesLoading;

  if (isLoading) {
    return (
      <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="divide-y divide-border/50">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
        <Link
          to="/activity-history"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          View All <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[auto_1fr_2fr_1fr_auto] gap-2 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <span className="w-14">Type</span>
        <span>ID</span>
        <span>Client</span>
        <span className="text-right">Amount</span>
        <span className="w-12 text-right">When</span>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-border/50">
        {activities.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No recent activity
          </div>
        ) : (
          activities.map((activity) => (
            <Link
              key={`${activity.type}-${activity.id}`}
              to={activity.href}
              className="grid grid-cols-[auto_1fr_2fr_1fr_auto] gap-2 px-4 py-3 hover:bg-muted/30 transition-colors items-center"
            >
              <Badge
                variant="secondary"
                className={cn(
                  "w-14 justify-center text-[10px]",
                  activity.type === "estimate"
                    ? "bg-blue-500/10 text-blue-500"
                    : "bg-emerald-500/10 text-emerald-500"
                )}
              >
                {activity.type === "estimate" ? "Est" : "Inv"}
              </Badge>
              <span className="text-sm font-medium text-foreground">
                #{activity.number}
              </span>
              <span className="text-sm text-muted-foreground truncate">
                {activity.client}
              </span>
              <span className="text-sm font-medium text-foreground text-right">
                ${activity.amount.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground w-12 text-right">
                {formatDistanceToNow(activity.when, { addSuffix: false })}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
