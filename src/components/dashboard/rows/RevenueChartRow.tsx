import { useMemo } from "react";
import { useInvoices } from "@/integrations/supabase/hooks/useInvoices";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

export function RevenueChartRow() {
  const { data: invoices, isLoading } = useInvoices();

  const chartData = useMemo(() => {
    if (!invoices) return { months: [], total: 0, change: 0 };

    const now = new Date();
    const months: { month: string; shortMonth: string; revenue: number }[] = [];

    // Get last 6 months
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthRevenue = invoices
        .filter((inv) => {
          if (inv.status !== "paid") return false;
          const paidDate = new Date(inv.paid_date || inv.created_at);
          return paidDate >= monthStart && paidDate <= monthEnd;
        })
        .reduce((sum, inv) => sum + (inv.total || 0), 0);

      months.push({
        month: format(monthDate, "MMMM"),
        shortMonth: format(monthDate, "MMM"),
        revenue: monthRevenue,
      });
    }

    const total = months.reduce((sum, m) => sum + m.revenue, 0);
    
    // Calculate change vs prior 6 months
    const priorMonths: number[] = [];
    for (let i = 11; i >= 6; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthRevenue = invoices
        .filter((inv) => {
          if (inv.status !== "paid") return false;
          const paidDate = new Date(inv.paid_date || inv.created_at);
          return paidDate >= monthStart && paidDate <= monthEnd;
        })
        .reduce((sum, inv) => sum + (inv.total || 0), 0);

      priorMonths.push(monthRevenue);
    }
    const priorTotal = priorMonths.reduce((sum, r) => sum + r, 0);
    const change = priorTotal > 0 ? ((total - priorTotal) / priorTotal) * 100 : 0;

    return { months, total, change };
  }, [invoices]);

  const maxRevenue = Math.max(...chartData.months.map((m) => m.revenue), 1);

  if (isLoading) {
    return (
      <div className="bg-card border border-border/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-end justify-between gap-4 h-40">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <Skeleton className="w-full" style={{ height: `${30 + Math.random() * 70}%` }} />
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border/50 rounded-lg p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-foreground">Monthly Revenue</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            6-Month Total:{" "}
            <span className="font-semibold text-foreground">
              ${(chartData.total / 1000).toFixed(0)}k
            </span>
          </span>
          <span
            className={cn(
              "flex items-center gap-0.5 font-medium",
              chartData.change >= 0 ? "text-emerald-500" : "text-destructive"
            )}
          >
            {chartData.change >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(chartData.change).toFixed(1)}% vs prior
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex items-end justify-between gap-2 sm:gap-4 h-40">
        {chartData.months.map((month) => {
          const heightPercent = (month.revenue / maxRevenue) * 100;
          return (
            <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
              {/* Bar */}
              <div className="w-full flex flex-col items-center justify-end h-28">
                <div
                  className={cn(
                    "w-full max-w-12 rounded-t transition-all duration-300",
                    "bg-primary/80 hover:bg-primary"
                  )}
                  style={{ height: `${Math.max(heightPercent, 2)}%` }}
                />
              </div>
              {/* Value */}
              <span className="text-xs font-medium text-foreground">
                ${(month.revenue / 1000).toFixed(0)}k
              </span>
              {/* Month */}
              <span className="text-[10px] text-muted-foreground uppercase">
                {month.shortMonth}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
