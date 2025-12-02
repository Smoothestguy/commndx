import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProductEmptyStateProps {
  onAddProduct: () => void;
  hasFilters?: boolean;
}

export function ProductEmptyState({ onAddProduct, hasFilters }: ProductEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="text-center py-12 glass rounded-lg">
        <Package className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
          No products found
        </h3>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
          No products match your current filters. Try adjusting your search or category filter.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-12 glass rounded-lg">
      <Package className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
        No products yet
      </h3>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
        Start building your product catalog by adding your first product or service.
      </p>
      <Button variant="glow" onClick={onAddProduct}>
        <Package className="h-4 w-4 mr-2" />
        Add Your First Product
      </Button>
    </div>
  );
}
