import { Button } from "@/components/ui/button";
import { X, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProjectStage } from "@/integrations/supabase/hooks/useProjects";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    { value: "all", label: "All" },
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

  const hasActiveFilters = filterStatus !== "all" || filterStage !== "all" || search;

  return (
    <div className="space-y-2">
      {/* Compact Filter Row */}
      <div className="flex items-center gap-2">
        {/* Stage Pills - Scrollable */}
        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {stageOptions.map((option) => (
            <Button
              key={option.value}
              variant={filterStage === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStage(option.value)}
              className={`flex-shrink-0 h-7 px-2.5 text-xs ${
                filterStage === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 hover:bg-secondary"
              }`}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {/* Status Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 px-2.5 flex-shrink-0 bg-background"
            >
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              <span className="text-xs">
                {filterStatus === "all" ? "Status" : statusOptions.find(s => s.value === filterStatus)?.label}
              </span>
              {filterStatus !== "all" && (
                <Badge variant="secondary" className="ml-1.5 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                  1
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuLabel className="text-xs">Filter by Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {statusOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setFilterStatus(option.value)}
                className={filterStatus === option.value ? "bg-accent" : ""}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {search && (
            <Badge variant="secondary" className="text-[10px] h-5 gap-1">
              "{search}"
            </Badge>
          )}
          {filterStage !== "all" && (
            <Badge variant="secondary" className="text-[10px] h-5 gap-1">
              {stageLabels[filterStage as ProjectStage] || filterStage}
            </Badge>
          )}
          {filterStatus !== "all" && (
            <Badge variant="secondary" className="text-[10px] h-5 gap-1 capitalize">
              {filterStatus}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3 mr-0.5" />
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
