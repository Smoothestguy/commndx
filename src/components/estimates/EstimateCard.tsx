import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, Eye, Edit, AlertCircle } from "lucide-react";
import { Estimate } from "@/integrations/supabase/hooks/useEstimates";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";

interface EstimateCardProps {
  estimate: Estimate;
  onClick: () => void;
  index: number;
}

const statusColors = {
  draft: "border-amber-500",
  pending: "border-warning",
  approved: "border-success",
  sent: "border-primary",
};

export function EstimateCard({ estimate, onClick, index }: EstimateCardProps) {
  const navigate = useNavigate();
  const isDraft = estimate.status === "draft";
  const isIncomplete = isDraft && (!estimate.customer_name || estimate.customer_name === "Draft");

  const handleContinueEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/estimates/new?draft=${estimate.id}`);
  };

  return (
    <div
      className={`glass rounded-xl p-5 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 border-l-4 ${statusColors[estimate.status]} cursor-pointer animate-fade-in ${isDraft ? 'bg-amber-500/5' : ''}`}
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FileText className={`h-5 w-5 flex-shrink-0 ${isDraft ? 'text-amber-500' : 'text-primary'}`} />
          <h3 className="font-heading font-semibold text-lg text-foreground truncate">
            {estimate.number}
          </h3>
          {isDraft && (
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
              Draft
            </Badge>
          )}
        </div>
        <StatusBadge status={estimate.status} />
      </div>

      {/* Incomplete Warning */}
      {isIncomplete && (
        <div className="flex items-center gap-2 p-2 mb-3 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-4 w-4" />
          <span className="text-xs font-medium">Incomplete - click to continue</span>
        </div>
      )}

      {/* Customer & Project */}
      <div className="space-y-1 mb-4">
        <p className={`text-sm font-medium ${isIncomplete ? 'text-muted-foreground italic' : 'text-foreground'}`}>
          {isIncomplete ? 'No customer selected' : estimate.customer_name}
        </p>
        {estimate.project_name && (
          <p className="text-sm text-muted-foreground">
            {estimate.project_name}
          </p>
        )}
      </div>

      <div className="mb-4">
        <p className={`text-3xl font-heading font-bold ${isDraft ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`}>
          {formatCurrency(estimate.total)}
        </p>
      </div>

      {/* Valid Until */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Calendar className="h-4 w-4" />
        <span>Valid until {estimate.valid_until}</span>
      </div>

      {/* Action Buttons */}
      {isDraft ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
          onClick={handleContinueEditing}
        >
          <Edit className="h-4 w-4 mr-2" />
          Continue Editing
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/estimates/${estimate.id}/edit`);
            }}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      )}
    </div>
  );
}
