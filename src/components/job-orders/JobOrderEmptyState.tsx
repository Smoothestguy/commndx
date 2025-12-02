import { Briefcase } from "lucide-react";

interface JobOrderEmptyStateProps {
  hasFilters?: boolean;
}

export function JobOrderEmptyState({ hasFilters }: JobOrderEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="text-center py-12 glass rounded-lg">
        <Briefcase className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
          No job orders found
        </h3>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
          No job orders match your current filters. Try adjusting your search or status filter.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-12 glass rounded-lg">
      <Briefcase className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
        No job orders yet
      </h3>
      <p className="text-muted-foreground max-w-sm mx-auto">
        Job orders are created automatically when you approve estimates. Start by creating and approving an estimate.
      </p>
    </div>
  );
}
