import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EstimateEmptyStateProps {
  onCreateEstimate: () => void;
  hasFilters?: boolean;
}

export function EstimateEmptyState({ onCreateEstimate, hasFilters }: EstimateEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="text-center py-12 glass rounded-lg">
        <FileText className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
          No estimates found
        </h3>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
          No estimates match your current filters. Try adjusting your search or status filter.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-12 glass rounded-lg">
      <FileText className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
        No estimates yet
      </h3>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
        Create your first project estimate to start winning new business.
      </p>
      <Button variant="glow" onClick={onCreateEstimate}>
        <FileText className="h-4 w-4 mr-2" />
        Create Your First Estimate
      </Button>
    </div>
  );
}
