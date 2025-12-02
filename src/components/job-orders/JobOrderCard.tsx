import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Briefcase, Eye } from "lucide-react";
import { JobOrder } from "@/integrations/supabase/hooks/useJobOrders";

interface JobOrderCardProps {
  jobOrder: JobOrder;
  onClick: () => void;
  index: number;
}

const statusColors = {
  active: "border-success",
  "in-progress": "border-primary",
  completed: "border-success",
  "on-hold": "border-warning",
};

export function JobOrderCard({ jobOrder, onClick, index }: JobOrderCardProps) {
  const progress = (jobOrder.invoiced_amount / jobOrder.total) * 100;

  return (
    <div
      className={`glass rounded-xl p-5 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 border-l-4 ${statusColors[jobOrder.status]} cursor-pointer animate-fade-in`}
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Briefcase className="h-5 w-5 text-primary flex-shrink-0" />
          <h3 className="font-heading font-semibold text-lg text-foreground truncate">
            {jobOrder.number}
          </h3>
        </div>
        <StatusBadge status={jobOrder.status} />
      </div>

      {/* Customer & Project */}
      <div className="space-y-1 mb-4">
        <p className="text-sm font-medium text-foreground">
          {jobOrder.customer_name}
        </p>
        <p className="text-sm text-muted-foreground">
          {jobOrder.project_name}
        </p>
      </div>

      {/* Total Value */}
      <div className="mb-3">
        <p className="text-xs text-muted-foreground mb-1">Total Value</p>
        <p className="text-2xl font-heading font-bold text-primary">
          ${jobOrder.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Invoiced Progress</span>
          <span>{progress.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-success to-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Financial Info */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-xs text-muted-foreground">Invoiced</p>
          <p className="text-sm font-semibold text-success">
            ${jobOrder.invoiced_amount.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Remaining</p>
          <p className="text-sm font-semibold text-warning">
            ${jobOrder.remaining_amount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* View Button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <Eye className="h-4 w-4 mr-2" />
        View Details
      </Button>
    </div>
  );
}
