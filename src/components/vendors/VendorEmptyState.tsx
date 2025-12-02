import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VendorEmptyStateProps {
  onAddVendor: () => void;
  isFiltered?: boolean;
}

export const VendorEmptyState = ({
  onAddVendor,
  isFiltered = false,
}: VendorEmptyStateProps) => {
  return (
    <div className="glass rounded-xl p-12 text-center animate-fade-in">
      <div className="flex justify-center mb-4">
        <div className="p-4 rounded-full bg-primary/10">
          <Store className="h-12 w-12 text-primary" />
        </div>
      </div>
      <h3 className="font-heading text-xl font-semibold text-foreground mb-2">
        {isFiltered ? "No vendors found" : "No vendors yet"}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        {isFiltered
          ? "Try adjusting your filters or search to find what you're looking for"
          : "Start building your vendor network by adding your first vendor"}
      </p>
      {!isFiltered && (
        <Button variant="glow" onClick={onAddVendor}>
          Add Your First Vendor
        </Button>
      )}
    </div>
  );
};
