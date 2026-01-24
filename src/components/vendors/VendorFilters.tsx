import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, ArrowUpAZ, ArrowDownAZ } from "lucide-react";
import { VendorType } from "@/integrations/supabase/hooks/useVendors";

type SortField = "name" | "company" | "vendor_type";

interface VendorFiltersProps {
  statusFilter: "all" | "active" | "inactive";
  onStatusFilterChange: (status: "all" | "active" | "inactive") => void;
  typeFilter?: "all" | VendorType;
  onTypeFilterChange?: (type: "all" | VendorType) => void;
  sortBy?: SortField;
  onSortByChange?: (sortBy: SortField) => void;
  sortOrder?: "asc" | "desc";
  onSortOrderChange?: (order: "asc" | "desc") => void;
}

export const VendorFilters = ({
  statusFilter,
  onStatusFilterChange,
  typeFilter = "all",
  onTypeFilterChange,
  sortBy = "name",
  onSortByChange,
  sortOrder = "asc",
  onSortOrderChange,
}: VendorFiltersProps) => {
  const hasActiveFilters = statusFilter !== "all" || typeFilter !== "all";

  return (
    <div className="flex items-center gap-2 min-w-max">
      {/* Status Filter */}
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-[100px] sm:w-[110px] h-10 sm:h-9 bg-secondary border-border flex-shrink-0">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent className="bg-popover border-border">
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>

      {/* Type Filter */}
      {onTypeFilterChange && (
        <Select value={typeFilter} onValueChange={onTypeFilterChange}>
          <SelectTrigger className="w-[100px] sm:w-[130px] h-10 sm:h-9 bg-secondary border-border flex-shrink-0">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="contractor">Contractor</SelectItem>
            <SelectItem value="personnel">Personnel</SelectItem>
            <SelectItem value="supplier">Supplier</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Sort By */}
      {onSortByChange && (
        <Select value={sortBy} onValueChange={onSortByChange}>
          <SelectTrigger className="w-[90px] sm:w-[110px] h-10 sm:h-9 bg-secondary border-border flex-shrink-0">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="company">Company</SelectItem>
            <SelectItem value="vendor_type">Type</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Sort Order Toggle */}
      {onSortOrderChange && (
        <Button
          variant="outline"
          size="sm"
          className="h-10 w-10 sm:h-9 sm:w-auto sm:px-3 flex-shrink-0"
          onClick={() => onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")}
        >
          {sortOrder === "asc" ? (
            <ArrowUpAZ className="h-4 w-4" />
          ) : (
            <ArrowDownAZ className="h-4 w-4" />
          )}
        </Button>
      )}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-10 sm:h-9 sm:w-auto sm:px-3 text-muted-foreground flex-shrink-0"
          onClick={() => {
            onStatusFilterChange("all");
            onTypeFilterChange?.("all");
          }}
        >
          <X className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Clear</span>
        </Button>
      )}
    </div>
  );
};
