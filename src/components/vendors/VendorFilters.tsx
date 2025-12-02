import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface VendorFiltersProps {
  statusFilter: "all" | "active" | "inactive";
  onStatusFilterChange: (status: "all" | "active" | "inactive") => void;
}

export const VendorFilters = ({
  statusFilter,
  onStatusFilterChange,
}: VendorFiltersProps) => {
  const filters = [
    { value: "all" as const, label: "All" },
    { value: "active" as const, label: "Active" },
    { value: "inactive" as const, label: "Inactive" },
  ];

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2 mb-3">
        {filters.map((filter) => (
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

      {statusFilter !== "all" && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filter:</span>
          <Badge
            variant="secondary"
            className="cursor-pointer hover:bg-secondary/80"
            onClick={() => onStatusFilterChange("all")}
          >
            {statusFilter}
            <X className="h-3 w-3 ml-1" />
          </Badge>
        </div>
      )}
    </div>
  );
};
