import { Badge } from "@/components/ui/badge";
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
  const statusFilters = [
    { value: "all" as const, label: "All" },
    { value: "active" as const, label: "Active" },
    { value: "inactive" as const, label: "Inactive" },
  ];

  const typeFilters = [
    { value: "all" as const, label: "All Types" },
    { value: "contractor" as const, label: "Contractor" },
    { value: "personnel" as const, label: "Personnel" },
    { value: "supplier" as const, label: "Supplier" },
  ];

  const sortFields = [
    { value: "name" as const, label: "Name" },
    { value: "company" as const, label: "Company" },
    { value: "vendor_type" as const, label: "Type" },
  ];

  const hasActiveFilters = statusFilter !== "all" || typeFilter !== "all";

  return (
    <div className="mb-6 space-y-4">
      {/* Status Filters */}
      <div>
        <p className="text-sm text-muted-foreground mb-2">Status</p>
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => onStatusFilterChange(filter.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                statusFilter === filter.value
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Type Filters */}
      {onTypeFilterChange && (
        <div>
          <p className="text-sm text-muted-foreground mb-2">Type</p>
          <div className="flex flex-wrap gap-2">
            {typeFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => onTypeFilterChange(filter.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  typeFilter === filter.value
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sort Options */}
      {onSortByChange && onSortOrderChange && (
        <div>
          <p className="text-sm text-muted-foreground mb-2">Sort by</p>
          <div className="flex flex-wrap items-center gap-2">
            {sortFields.map((field) => (
              <button
                key={field.value}
                onClick={() => onSortByChange(field.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  sortBy === field.value
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                {field.label}
              </button>
            ))}
            <button
              onClick={() => onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")}
              className="px-3 py-2 rounded-full bg-secondary text-muted-foreground hover:bg-secondary/80 transition-all flex items-center gap-1"
            >
              {sortOrder === "asc" ? (
                <ArrowUpAZ className="h-4 w-4" />
              ) : (
                <ArrowDownAZ className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">{sortOrder === "asc" ? "A-Z" : "Z-A"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {statusFilter !== "all" && (
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80"
              onClick={() => onStatusFilterChange("all")}
            >
              Status: {statusFilter}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {typeFilter !== "all" && onTypeFilterChange && (
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80"
              onClick={() => onTypeFilterChange("all")}
            >
              Type: {typeFilter}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};
