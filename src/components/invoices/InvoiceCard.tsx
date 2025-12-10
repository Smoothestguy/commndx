import { Receipt, User, Calendar, Eye, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency } from "@/lib/utils";

type Status = 
  | "draft" 
  | "sent" 
  | "partially_paid"
  | "paid" 
  | "overdue";

interface InvoiceCardProps {
  invoice: {
    id: string;
    number: string;
    customer_name: string;
    project_name?: string | null;
    status: Status;
    total: number;
    paid_amount?: number;
    remaining_amount?: number;
    due_date: string;
    paid_date?: string | null;
  };
  onView: (id: string) => void;
  index: number;
}

export const InvoiceCard = ({ invoice, onView, index }: InvoiceCardProps) => {
  const getBorderColor = () => {
    switch (invoice.status) {
      case "paid":
        return "border-l-success";
      case "partially_paid":
        return "border-l-info";
      case "sent":
        return "border-l-warning";
      case "overdue":
        return "border-l-destructive";
      default:
        return "border-l-muted";
    }
  };

  return (
    <div
      className={`glass rounded-xl p-4 hover:shadow-lg transition-all duration-300 animate-fade-in border-l-4 ${getBorderColor()}`}
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={() => onView(invoice.id)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <h3 className="font-heading font-semibold text-lg text-foreground">
            {invoice.number}
          </h3>
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span className="font-medium text-foreground">{invoice.customer_name}</span>
        </div>
        {invoice.project_name && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FolderOpen className="h-4 w-4" />
            <span>{invoice.project_name}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            {invoice.status === "partially_paid" ? "Balance Due" : "Amount"}
          </p>
          <p className="text-2xl font-heading font-bold text-primary">
            {invoice.status === "partially_paid" && invoice.remaining_amount !== undefined
              ? formatCurrency(invoice.remaining_amount)
              : formatCurrency(invoice.total)}
          </p>
          {invoice.status === "partially_paid" && (
            <p className="text-xs text-muted-foreground">
              of {formatCurrency(invoice.total)} total
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
            <Calendar className="h-3 w-3" />
            <span>Due:</span>
          </div>
          <p className="text-sm font-medium text-foreground">
            {new Date(invoice.due_date).toLocaleDateString()}
          </p>
          {invoice.paid_date && (
            <p className="text-xs text-success mt-1">
              Paid: {new Date(invoice.paid_date).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="w-full mt-3"
        onClick={(e) => {
          e.stopPropagation();
          onView(invoice.id);
        }}
      >
        <Eye className="h-4 w-4 mr-2" />
        View Details
      </Button>
    </div>
  );
};
