import { CheckSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TaskEmptyStateProps {
  onAdd: () => void;
}

export function TaskEmptyState({ onAdd }: TaskEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <CheckSquare className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No tasks yet</h3>
      <p className="text-muted-foreground mb-4 max-w-sm">
        Stay organized by creating your first task.
      </p>
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4 mr-2" />
        New Task
      </Button>
    </div>
  );
}
