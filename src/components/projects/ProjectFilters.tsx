import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProjectFiltersProps {
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  activeFiltersCount: number;
  onClearFilters: () => void;
  search: string;
}

export function ProjectFilters({
  filterStatus,
  setFilterStatus,
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

  return (
    <div className="mb-4">
      {/* Status Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
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
