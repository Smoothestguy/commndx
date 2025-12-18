import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProjectStage } from "@/integrations/supabase/hooks/useProjects";

interface ProjectFiltersProps {
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  filterStage: string;
  setFilterStage: (stage: string) => void;
  activeFiltersCount: number;
  onClearFilters: () => void;
  search: string;
}

const stageLabels: Record<ProjectStage, string> = {
  quote: "Quote",
  task_order: "Task Order",
  active: "Active",
  complete: "Complete",
  canceled: "Canceled",
};

export function ProjectFilters({
  filterStatus,
  setFilterStatus,
  filterStage,
  setFilterStage,
  activeFiltersCount,
  onClearFilters,
  search,
}: ProjectFiltersProps) {
  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
    { value: "on-hold", label: "On Hold" },
  ];

  const stageOptions = [
    { value: "all", label: "All Stages" },
    { value: "quote", label: "Quote" },
    { value: "task_order", label: "Task Order" },
    { value: "active", label: "Active" },
    { value: "complete", label: "Complete" },
    { value: "canceled", label: "Canceled" },
  ];

  return (
    <div className="mb-4 space-y-2">
      {/* Stage Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {stageOptions.map((option) => (
          <Button
            key={option.value}
            variant={filterStage === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStage(option.value)}
            className={`flex-shrink-0 ${
              filterStage === option.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary hover:bg-secondary/80"
            }`}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Status Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {statusOptions.map((option) => (
          <Button
            key={option.value}
            variant={filterStatus === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus(option.value)}
            className={`flex-shrink-0 ${
              filterStatus === option.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary hover:bg-secondary/80"
            }`}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {search && (
            <Badge variant="secondary" className="gap-1">
              Search: {search}
            </Badge>
          )}
          {filterStage !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Stage: {stageLabels[filterStage as ProjectStage] || filterStage}
            </Badge>
          )}
          {filterStatus !== "all" && (
            <Badge variant="secondary" className="gap-1 capitalize">
              Status: {filterStatus}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3 mr-1" />
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
