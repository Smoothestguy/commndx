import { useInvoices } from "@/integrations/supabase/hooks/useInvoices";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

const getStatusVariant = (status: string) => {
  switch (status) {
    case "paid":
      return "default";
    case "sent":
    case "pending":
      return "secondary";
    case "overdue":
      return "destructive";
    case "partially_paid":
      return "outline";
    default:
      return "secondary";
  }
};

export function RecentInvoicesTable() {
  const { data: invoices, isLoading } = useInvoices();
  const recentInvoices = invoices?.slice(0, 6) ?? [];

  return (
    <div className="border border-border rounded-sm bg-card overflow-hidden">
      <div className="px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Recent Invoices</h3>
          <Link to="/invoices" className="text-xs text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </div>
      </div>
      <div className="divide-y divide-border">
        {isLoading ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading...</div>
        ) : recentInvoices.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">No invoices</div>
        ) : (
          recentInvoices.map((invoice) => (
            <Link
              key={invoice.id}
              to={`/invoices/${invoice.id}`}
              className="flex items-center justify-between px-4 py-2 hover:bg-muted/30 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{invoice.number}</p>
                <p className="text-xs text-muted-foreground truncate">{invoice.customer_name}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Badge variant={getStatusVariant(invoice.status)} className="text-xs capitalize">
                  {invoice.status.replace("_", " ")}
                </Badge>
                <span className="text-sm font-medium text-foreground w-20 text-right">
                  {formatCurrency(invoice.total)}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
