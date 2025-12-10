import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface InvoiceFiltersProps {
  statusFilter: "all" | "draft" | "sent" | "partially_paid" | "paid" | "overdue";
  onStatusFilterChange: (status: "all" | "draft" | "sent" | "partially_paid" | "paid" | "overdue") => void;
}

export const InvoiceFilters = ({
  statusFilter,
  onStatusFilterChange,
}: InvoiceFiltersProps) => {
  const filters = [
    { value: "all" as const, label: "All" },
    { value: "draft" as const, label: "Draft" },
    { value: "sent" as const, label: "Sent" },
    { value: "partially_paid" as const, label: "Partial" },
    { value: "paid" as const, label: "Paid" },
    { value: "overdue" as const, label: "Overdue" },
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
