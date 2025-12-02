import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ShoppingCart, Calendar, Eye } from "lucide-react";
import { PurchaseOrder } from "@/integrations/supabase/hooks/usePurchaseOrders";

interface PurchaseOrderCardProps {
  purchaseOrder: PurchaseOrder;
  onClick: () => void;
  onJobOrderClick: (jobOrderId: string) => void;
  index: number;
}

const statusColors = {
  draft: "border-muted",
  sent: "border-primary",
  acknowledged: "border-primary",
  "in-progress": "border-warning",
  completed: "border-success",
  cancelled: "border-destructive",
};

export function PurchaseOrderCard({ purchaseOrder, onClick, onJobOrderClick, index }: PurchaseOrderCardProps) {
  return (
    <div
      className={`glass rounded-xl p-5 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 border-l-4 ${statusColors[purchaseOrder.status]} cursor-pointer animate-fade-in`}
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ShoppingCart className="h-5 w-5 text-primary flex-shrink-0" />
          <h3 className="font-heading font-semibold text-lg text-foreground truncate">
            {purchaseOrder.number}
          </h3>
        </div>
        <StatusBadge status={purchaseOrder.status} />
      </div>

      {/* Vendor */}
      <div className="mb-3">
        <p className="text-sm font-medium text-primary">
          {purchaseOrder.vendor_name}
        </p>
      </div>

      {/* Customer & Project */}
      <div className="space-y-1 mb-3 text-sm text-muted-foreground">
        <p>{purchaseOrder.customer_name}</p>
        <p>{purchaseOrder.project_name}</p>
      </div>

      {/* Job Order Link */}
      <div className="mb-4">
        <button
          className="text-sm text-primary hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            onJobOrderClick(purchaseOrder.job_order_id);
          }}
        >
          Job Order: {purchaseOrder.job_order_number}
        </button>
      </div>

      {/* Amount */}
      <div className="mb-4">
        <p className="text-3xl font-heading font-bold text-primary">
          ${purchaseOrder.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Due Date */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Calendar className="h-4 w-4" />
        <span>Due: {purchaseOrder.due_date}</span>
      </div>

      {/* View Button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <Eye className="h-4 w-4 mr-2" />
        View Details
      </Button>
    </div>
  );
}
