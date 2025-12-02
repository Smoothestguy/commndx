import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FileText, Calendar, Eye } from "lucide-react";
import { Estimate } from "@/integrations/supabase/hooks/useEstimates";

interface EstimateCardProps {
  estimate: Estimate;
  onClick: () => void;
  index: number;
}

const statusColors = {
  draft: "border-muted",
  pending: "border-warning",
  approved: "border-success",
  sent: "border-primary",
};

export function EstimateCard({ estimate, onClick, index }: EstimateCardProps) {
  return (
    <div
      className={`glass rounded-xl p-5 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 border-l-4 ${statusColors[estimate.status]} cursor-pointer animate-fade-in`}
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FileText className="h-5 w-5 text-primary flex-shrink-0" />
          <h3 className="font-heading font-semibold text-lg text-foreground truncate">
            {estimate.number}
          </h3>
        </div>
        <StatusBadge status={estimate.status} />
      </div>

      {/* Customer & Project */}
      <div className="space-y-1 mb-4">
        <p className="text-sm font-medium text-foreground">
          {estimate.customer_name}
        </p>
        {estimate.project_name && (
          <p className="text-sm text-muted-foreground">
            {estimate.project_name}
          </p>
        )}
      </div>

      {/* Amount */}
      <div className="mb-4">
        <p className="text-3xl font-heading font-bold text-primary">
          ${estimate.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Valid Until */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Calendar className="h-4 w-4" />
        <span>Valid until {estimate.valid_until}</span>
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
