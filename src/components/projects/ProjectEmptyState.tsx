import { Button } from "@/components/ui/button";
import { FolderOpen, Plus } from "lucide-react";

interface ProjectEmptyStateProps {
  hasFilters: boolean;
  onAddProject: () => void;
  onClearFilters: () => void;
}

export function ProjectEmptyState({
  hasFilters,
  onAddProject,
  onClearFilters,
}: ProjectEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="glass rounded-2xl p-8 max-w-md text-center animate-fade-in">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <h3 className="font-heading text-xl font-semibold mb-2">No projects found</h3>
          <p className="text-muted-foreground mb-6">
            Try adjusting your filters to find what you're looking for.
          </p>
          <Button variant="outline" onClick={onClearFilters}>
            Clear Filters
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="glass rounded-2xl p-8 max-w-md text-center animate-fade-in">
        <div className="flex justify-center mb-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 glow">
            <FolderOpen className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h3 className="font-heading text-2xl font-semibold mb-2">
          No projects yet
        </h3>
        <p className="text-muted-foreground mb-6">
          Start by creating your first project and tracking its progress.
        </p>
        <Button variant="glow" onClick={onAddProject}>
          <Plus className="h-4 w-4 mr-2" />
          Add Your First Project
        </Button>
      </div>
    </div>
  );
}
