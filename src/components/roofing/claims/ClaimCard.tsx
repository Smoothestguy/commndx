import { FileWarning, Building2, User, Calendar, DollarSign, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import type { InsuranceClaim, ClaimStatus } from "@/types/roofing";

interface ClaimCardProps {
  claim: InsuranceClaim;
  onEdit?: (claim: InsuranceClaim) => void;
  onDelete?: (id: string) => void;
  onClick?: (claim: InsuranceClaim) => void;
}

const statusColors: Record<ClaimStatus, string> = {
  filed: "bg-blue-500/10 text-blue-500",
  pending_adjuster: "bg-yellow-500/10 text-yellow-500",
  adjuster_scheduled: "bg-purple-500/10 text-purple-500",
  approved: "bg-green-500/10 text-green-500",
  denied: "bg-red-500/10 text-red-500",
  in_progress: "bg-orange-500/10 text-orange-500",
  completed: "bg-gray-500/10 text-gray-500",
};

const statusLabels: Record<ClaimStatus, string> = {
  filed: "Filed",
  pending_adjuster: "Pending Adjuster",
  adjuster_scheduled: "Adjuster Scheduled",
  approved: "Approved",
  denied: "Denied",
  in_progress: "In Progress",
  completed: "Completed",
};

export function ClaimCard({ claim, onEdit, onDelete, onClick }: ClaimCardProps) {
  return (
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onClick?.(claim)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileWarning className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium">
                  {claim.claim_number || "Claim Pending"}
                </h3>
                <Badge variant="outline" className={statusColors[claim.status]}>
                  {statusLabels[claim.status]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {claim.customer?.name}
                {claim.project && ` • ${claim.project.name}`}
              </p>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(claim); }}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onDelete?.(claim.id); }}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{claim.insurance_company}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Loss: {format(new Date(claim.date_of_loss), "MMM d, yyyy")}</span>
          </div>
          
          {claim.adjuster_name && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{claim.adjuster_name}</span>
            </div>
          )}
          
          {claim.approved_amount && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-green-600">
                ${claim.approved_amount.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {claim.adjuster_visit_date && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground">
              Adjuster Visit: {format(new Date(claim.adjuster_visit_date), "MMM d, yyyy")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
