import { MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActivityEmptyStateProps {
  onAdd: () => void;
}

export function ActivityEmptyState({ onAdd }: ActivityEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <MessageSquare className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No activities yet</h3>
      <p className="text-muted-foreground mb-4 max-w-sm">
        Start tracking your customer interactions by logging your first activity.
      </p>
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4 mr-2" />
        Log Activity
      </Button>
    </div>
  );
}
