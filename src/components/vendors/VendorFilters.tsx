import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { VendorType } from "@/integrations/supabase/hooks/useVendors";

interface VendorFiltersProps {
  statusFilter: "all" | "active" | "inactive";
  onStatusFilterChange: (status: "all" | "active" | "inactive") => void;
  typeFilter?: "all" | VendorType;
  onTypeFilterChange?: (type: "all" | VendorType) => void;
}

export const VendorFilters = ({
  statusFilter,
  onStatusFilterChange,
  typeFilter = "all",
  onTypeFilterChange,
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
