import { Button } from "@/components/ui/button";
import { FileEdit, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ChangeOrderEmptyStateProps {
  projectId?: string;
}

export function ChangeOrderEmptyState({ projectId }: ChangeOrderEmptyStateProps) {
  const navigate = useNavigate();

  const handleCreate = () => {
    const url = projectId ? `/change-orders/new?projectId=${projectId}` : "/change-orders/new";
    navigate(url);
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <FileEdit className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No Change Orders Yet</h3>
      <p className="text-muted-foreground mb-4 max-w-md">
        Change orders track modifications to the original scope of work. Create your first change order to get started.
      </p>
      <Button onClick={handleCreate}>
        <Plus className="mr-2 h-4 w-4" />
        Create Change Order
      </Button>
    </div>
  );
}
