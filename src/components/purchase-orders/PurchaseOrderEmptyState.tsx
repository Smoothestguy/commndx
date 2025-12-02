import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PurchaseOrderEmptyStateProps {
  onCreatePO: () => void;
  hasFilters?: boolean;
}

export function PurchaseOrderEmptyState({ onCreatePO, hasFilters }: PurchaseOrderEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="text-center py-12 glass rounded-lg">
        <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
          No purchase orders found
        </h3>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
          No purchase orders match your current filters. Try adjusting your search or status filter.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-12 glass rounded-lg">
      <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
        No purchase orders yet
      </h3>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
        Create purchase orders to manage vendor orders for your active job orders.
      </p>
      <Button variant="glow" onClick={onCreatePO}>
        <ShoppingCart className="h-4 w-4 mr-2" />
        Create Your First PO
      </Button>
    </div>
  );
}
