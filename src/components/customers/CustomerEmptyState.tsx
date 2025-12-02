import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CustomerEmptyStateProps {
  onAddCustomer: () => void;
  isFiltered?: boolean;
}

export const CustomerEmptyState = ({
  onAddCustomer,
  isFiltered = false,
}: CustomerEmptyStateProps) => {
  return (
    <div className="glass rounded-xl p-12 text-center animate-fade-in">
      <div className="flex justify-center mb-4">
        <div className="p-4 rounded-full bg-primary/10">
          <Users className="h-12 w-12 text-primary" />
        </div>
      </div>
      <h3 className="font-heading text-xl font-semibold text-foreground mb-2">
        {isFiltered ? "No customers found" : "No customers yet"}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        {isFiltered
          ? "Try adjusting your search to find what you're looking for"
          : "Start building your customer base by adding your first customer"}
      </p>
      {!isFiltered && (
        <Button variant="glow" onClick={onAddCustomer}>
          Add Your First Customer
        </Button>
      )}
    </div>
  );
};
