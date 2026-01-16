import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectStage } from "@/integrations/supabase/hooks/useProjects";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProjectFiltersProps {
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  filterStage: string;
  setFilterStage: (stage: string) => void;
  activeFiltersCount: number;
  onClearFilters: () => void;
  search: string;
  inline?: boolean;
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
  inline = false,
}: ProjectFiltersProps) {
  const hasActiveFilters = filterStatus !== "all" || filterStage !== "all" || search;

  // Inline mode: just render the selects without wrapper
  if (inline) {
    return (
      <>
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-[120px] sm:w-[140px] min-h-[40px] text-xs sm:text-sm bg-background">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="quote">Quote</SelectItem>
            <SelectItem value="task_order">Task Order</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[120px] sm:w-[140px] min-h-[40px] text-xs sm:text-sm bg-background">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="on-hold">On Hold</SelectItem>
          </SelectContent>
        </Select>
      </>
    );
  }
  return (
    <div className="space-y-2">
      {/* Filters row - grid on mobile, flex on larger screens */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2 w-full">
        {/* Stage Select */}
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-full sm:w-[140px] min-h-[44px] sm:min-h-[40px] text-xs sm:text-sm bg-background">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="quote">Quote</SelectItem>
            <SelectItem value="task_order">Task Order</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>

        {/* Status Select */}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[140px] min-h-[44px] sm:min-h-[40px] text-xs sm:text-sm bg-background">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="on-hold">On Hold</SelectItem>
          </SelectContent>
        </Select>
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
