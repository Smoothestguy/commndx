import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreVertical, Eye, Edit, Trash2, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useNavigate } from "react-router-dom";
import { ChangeOrder, ChangeOrderStatus } from "@/integrations/supabase/hooks/useChangeOrders";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";

interface ChangeOrderCardProps {
  changeOrder: ChangeOrder & { project?: { id: string; name: string } };
  onDelete?: (id: string) => void;
  onHardDelete?: (id: string) => void;
}

const statusConfig: Record<ChangeOrderStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  pending_approval: { label: "Pending Approval", variant: "outline" },
  pending_field_supervisor: { label: "Pending Field Supervisor", variant: "outline" },
  pending_customer_pm: { label: "Pending Customer PM", variant: "outline" },
  approved_pending_wo: { label: "Approved — Awaiting WO", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  invoiced: { label: "Invoiced", variant: "default" },
};

export function ChangeOrderCard({ changeOrder, onDelete, onHardDelete }: ChangeOrderCardProps) {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const status = statusConfig[changeOrder.status];

  const canEdit = isAdmin || (changeOrder.status !== "approved" && changeOrder.status !== "invoiced");
  const canDelete = changeOrder.status === "draft" && onDelete;
  const canHardDelete = changeOrder.status === "draft" && onHardDelete;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{changeOrder.number}</h3>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {changeOrder.project?.name || "No Project"}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/change-orders/${changeOrder.id}`)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                {canEdit && (
                  <DropdownMenuItem onClick={() => navigate(`/change-orders/${changeOrder.id}/edit`)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem onClick={() => onDelete(changeOrder.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Move to Trash
                  </DropdownMenuItem>
                )}
                {canHardDelete && (
                  <DropdownMenuItem
                    onClick={() => onHardDelete(changeOrder.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Permanently
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Reason</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{changeOrder.reason}</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="text-sm font-medium">{changeOrder.customer_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-lg font-semibold">
                    ${changeOrder.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                <span>Created {format(new Date(changeOrder.created_at), "MMM d, yyyy")}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => navigate(`/change-orders/${changeOrder.id}`)}
                >
                  <FileText className="mr-1 h-3 w-3" />
                  View
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => navigate(`/change-orders/${changeOrder.id}`)}>
          <Eye className="mr-2 h-4 w-4" />
          View Details
        </ContextMenuItem>
        {canEdit && (
          <ContextMenuItem onClick={() => navigate(`/change-orders/${changeOrder.id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </ContextMenuItem>
        )}
        {canDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onDelete(changeOrder.id)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Move to Trash
            </ContextMenuItem>
          </>
        )}
        {canHardDelete && (
          <ContextMenuItem
            onClick={() => onHardDelete(changeOrder.id)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Permanently
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
