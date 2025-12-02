import { FileWarning, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ClaimEmptyStateProps {
  onAdd: () => void;
}

export function ClaimEmptyState({ onAdd }: ClaimEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <FileWarning className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No insurance claims</h3>
      <p className="text-muted-foreground mb-4 max-w-sm">
        Track insurance claims by creating your first claim record.
      </p>
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4 mr-2" />
        New Claim
      </Button>
    </div>
  );
}
