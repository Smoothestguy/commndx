import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useInvoices } from "@/integrations/supabase/hooks/useInvoices";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", className: "bg-blue-500/10 text-blue-500" },
  paid: { label: "Paid", className: "bg-emerald-500/10 text-emerald-500" },
  partially_paid: { label: "Partial", className: "bg-amber-500/10 text-amber-500" },
  overdue: { label: "Overdue", className: "bg-destructive/10 text-destructive" },
  void: { label: "Void", className: "bg-muted text-muted-foreground line-through" },
};

export function RecentInvoicesTable() {
  const { data: invoices, isLoading } = useInvoices();

  const recentInvoices = useMemo(() => {
    if (!invoices) return [];
    return invoices
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [invoices]);

  const getDisplayStatus = (invoice: typeof recentInvoices[0]) => {
    // Check if overdue
    if (
      invoice.due_date &&
      new Date(invoice.due_date) < new Date() &&
      invoice.status !== "paid"
    ) {
      const daysOverdue = Math.ceil(
        (new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        ...STATUS_STYLES.overdue,
        label: `${daysOverdue}d Overdue`,
      };
    }

    // Check days until due
    if (
      invoice.due_date &&
      invoice.status !== "paid"
    ) {
      const daysUntilDue = Math.ceil(
        (new Date(invoice.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilDue <= 7 && daysUntilDue > 0) {
        return {
          className: "bg-amber-500/10 text-amber-500",
          label: `Due ${daysUntilDue}d`,
        };
      }
    }

    return STATUS_STYLES[invoice.status] || STATUS_STYLES.draft;
  };

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
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-16" />
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
        <h3 className="text-sm font-semibold text-foreground">Recent Invoices</h3>
        <Link
          to="/invoices"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          View All <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[1fr_2fr_1fr_auto] gap-2 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <span>Invoice</span>
        <span>Client</span>
        <span className="text-right">Amount</span>
        <span className="w-20 text-center">Status</span>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-border/50">
        {recentInvoices.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No invoices yet
          </div>
        ) : (
          recentInvoices.map((invoice) => {
            const status = getDisplayStatus(invoice);
            return (
              <Link
                key={invoice.id}
                to={`/invoices/${invoice.id}`}
                className="grid grid-cols-[1fr_2fr_1fr_auto] gap-2 px-4 py-3 hover:bg-muted/30 transition-colors items-center"
              >
                <span className="text-sm font-medium text-foreground">
                  #{invoice.number}
                </span>
                <span className="text-sm text-muted-foreground truncate">
                  {invoice.customer_name}
                </span>
                <span className="text-sm font-medium text-foreground text-right">
                  ${invoice.total?.toLocaleString()}
                </span>
                <Badge
                  variant="secondary"
                  className={cn("w-20 justify-center text-[10px]", status.className)}
                >
                  {status.label}
                </Badge>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
