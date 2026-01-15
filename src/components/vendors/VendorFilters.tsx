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
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {/* Status Filter */}
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-[110px] h-9 bg-secondary border-border">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>

      {/* Type Filter */}
      {onTypeFilterChange && (
        <Select value={typeFilter} onValueChange={onTypeFilterChange}>
          <SelectTrigger className="w-[130px] h-9 bg-secondary border-border">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
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
          <SelectTrigger className="w-[110px] h-9 bg-secondary border-border">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
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
          className="h-9 px-3"
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
          className="h-9 px-3 text-muted-foreground"
          onClick={() => {
            onStatusFilterChange("all");
            onTypeFilterChange?.("all");
          }}
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
};
