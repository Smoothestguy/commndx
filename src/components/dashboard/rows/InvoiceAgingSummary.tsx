import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useInvoices } from "@/integrations/supabase/hooks/useInvoices";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface AgingBucket {
  label: string;
  range: string;
  count: number;
  amount: number;
  color: string;
  bgColor: string;
}

export function InvoiceAgingSummary() {
  const { data: invoices, isLoading } = useInvoices();

  const agingBuckets = useMemo<AgingBucket[]>(() => {
    const now = new Date();

    const buckets = {
      current: { count: 0, amount: 0 },
      "1-30": { count: 0, amount: 0 },
      "31-60": { count: 0, amount: 0 },
      "60+": { count: 0, amount: 0 },
    };

    invoices?.forEach((invoice) => {
      // Only count unpaid invoices (exclude paid status)
      if (invoice.status === "paid") {
        return;
      }

      const outstanding = (invoice.total || 0) - (invoice.paid_amount || 0);
      if (outstanding <= 0) return;

      const dueDate = invoice.due_date ? new Date(invoice.due_date) : new Date(invoice.created_at);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) {
        buckets.current.count++;
        buckets.current.amount += outstanding;
      } else if (daysOverdue <= 30) {
        buckets["1-30"].count++;
        buckets["1-30"].amount += outstanding;
      } else if (daysOverdue <= 60) {
        buckets["31-60"].count++;
        buckets["31-60"].amount += outstanding;
      } else {
        buckets["60+"].count++;
        buckets["60+"].amount += outstanding;
      }
    });

    return [
      {
        label: "Current",
        range: "Not Due",
        count: buckets.current.count,
        amount: buckets.current.amount,
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10 border-emerald-500/20",
      },
      {
        label: "1-30 Days",
        range: "1-30",
        count: buckets["1-30"].count,
        amount: buckets["1-30"].amount,
        color: "text-amber-500",
        bgColor: "bg-amber-500/10 border-amber-500/20",
      },
      {
        label: "31-60 Days",
        range: "31-60",
        count: buckets["31-60"].count,
        amount: buckets["31-60"].amount,
        color: "text-orange-500",
        bgColor: "bg-orange-500/10 border-orange-500/20",
      },
      {
        label: "60+ Days",
        range: "60+",
        count: buckets["60+"].count,
        amount: buckets["60+"].amount,
        color: "text-destructive",
        bgColor: "bg-destructive/10 border-destructive/20",
      },
    ];
  }, [invoices]);

  if (isLoading) {
    return (
      <div className="bg-card border border-border/50 rounded-lg p-4">
        <Skeleton className="h-4 w-40 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  const totalOutstanding = agingBuckets.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="bg-card border border-border/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Invoice Aging Summary</h3>
        <span className="text-xs text-muted-foreground">
          Total Outstanding:{" "}
          <span className="font-semibold text-foreground">
            ${totalOutstanding.toLocaleString()}
          </span>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {agingBuckets.map((bucket) => (
          <Link
            key={bucket.label}
            to={`/invoices?aging=${bucket.range}`}
            className={cn(
              "p-3 rounded-lg border transition-all hover:scale-[1.02]",
              bucket.bgColor
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={cn("text-xs font-medium", bucket.color)}>
                {bucket.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {bucket.count} inv
              </span>
            </div>
            <span className={cn("text-lg font-bold", bucket.color)}>
              ${(bucket.amount / 1000).toFixed(bucket.amount >= 1000 ? 0 : 1)}k
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
