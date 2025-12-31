import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type EstimateStatus = "draft" | "pending" | "approved" | "sent" | "closed";

interface EstimateFiltersProps {
  selectedStatus: EstimateStatus | "";
  onStatusChange: (status: EstimateStatus | "") => void;
}

const statuses: { value: EstimateStatus | ""; label: string }[] = [
  { value: "", label: "All Estimates" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "sent", label: "Sent" },
  { value: "closed", label: "Closed" },
];

export function EstimateFilters({
  selectedStatus,
  onStatusChange,
}: EstimateFiltersProps) {
  return (
    <div className="space-y-3 mb-6">
      {/* Status Pills */}
      <div className="flex flex-wrap gap-2">
        {statuses.map((status) => (
          <button
            key={status.value}
            onClick={() => onStatusChange(status.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              selectedStatus === status.value
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {status.label}
          </button>
        ))}
      </div>

      {/* Active Filter Display */}
      {selectedStatus && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filter:</span>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            <span className="text-sm font-medium capitalize">{selectedStatus}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0 hover:bg-transparent"
              onClick={() => onStatusChange("")}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
