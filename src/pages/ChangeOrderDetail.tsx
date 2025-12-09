import { useParams, useNavigate } from "react-router-dom";
import { DetailPageLayout } from "@/components/layout/DetailPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Edit,
  Trash2,
  MoreVertical,
  CheckCircle,
  XCircle,
  Send,
  Receipt,
  Loader2,
  FileText,
  Building2,
  User,
  Link as LinkIcon,
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import {
  useChangeOrder,
  useDeleteChangeOrder,
  useUpdateChangeOrderStatus,
  ChangeOrderStatus,
} from "@/integrations/supabase/hooks/useChangeOrders";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";

const statusConfig: Record<
  ChangeOrderStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  pending_approval: { label: "Pending Approval", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  invoiced: { label: "Invoiced", variant: "default" },
};

export default function ChangeOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: changeOrder, isLoading } = useChangeOrder(id);
  const deleteChangeOrder = useDeleteChangeOrder();
  const updateStatus = useUpdateChangeOrderStatus();
  const { isAdmin, isManager } = useUserRole();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const canEdit = changeOrder?.status === "draft" && (isAdmin || isManager);
  const canDelete = changeOrder?.status === "draft" && (isAdmin || isManager);
  const canSubmitForApproval = changeOrder?.status === "draft" && (isAdmin || isManager);
  const canApprove = changeOrder?.status === "pending_approval" && (isAdmin || isManager);
  const canCreateInvoice = changeOrder?.status === "approved" && (isAdmin || isManager);

  const handleStatusChange = async (status: ChangeOrderStatus) => {
    if (!id) return;
    const { data: { user } } = await supabase.auth.getUser();
    await updateStatus.mutateAsync({
      id,
      status,
      approved_by: status === "approved" ? user?.id : undefined,
    });
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteChangeOrder.mutateAsync(id);
    navigate("/change-orders");
  };

  if (isLoading) {
    return (
      <DetailPageLayout title="Change Order">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DetailPageLayout>
    );
  }

  if (!changeOrder) {
    return (
      <DetailPageLayout title="Change Order Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground">The change order doesn't exist.</p>
        </div>
      </DetailPageLayout>
    );
  }

  const status = statusConfig[changeOrder.status];

  return (
    <DetailPageLayout
      title={changeOrder.number}
      description={changeOrder.reason}
      actions={
        <div className="flex items-center gap-2">
          {canSubmitForApproval && (
            <Button variant="outline" onClick={() => handleStatusChange("pending_approval")} disabled={updateStatus.isPending}>
              <Send className="mr-2 h-4 w-4" />
              Submit for Approval
            </Button>
          )}
          {canApprove && (
            <>
              <Button variant="default" onClick={() => handleStatusChange("approved")} disabled={updateStatus.isPending}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button variant="destructive" onClick={() => handleStatusChange("rejected")} disabled={updateStatus.isPending}>
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </>
          )}
          {canCreateInvoice && (
            <Button onClick={() => navigate(`/invoices/new?changeOrderId=${id}`)}>
              <Receipt className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem onClick={() => navigate(`/change-orders/${id}/edit`)}>
                  <Edit className="mr-2 h-4 w-4" />Edit
                </DropdownMenuItem>
              )}
              {changeOrder.status === "rejected" && (
                <DropdownMenuItem onClick={() => handleStatusChange("draft")}>
                  <FileText className="mr-2 h-4 w-4" />Revise
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Badge variant={status.variant} className="text-sm px-3 py-1">{status.label}</Badge>
          <span className="text-sm text-muted-foreground">Created {format(new Date(changeOrder.created_at), "MMMM d, yyyy")}</span>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><p className="text-sm font-medium text-muted-foreground">Reason</p><p className="mt-1">{changeOrder.reason}</p></div>
              {changeOrder.description && <div><p className="text-sm font-medium text-muted-foreground">Description</p><p className="mt-1">{changeOrder.description}</p></div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><LinkIcon className="h-5 w-5" />Linked Records</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div><p className="text-sm font-medium text-muted-foreground">Project</p>
                  <Button variant="link" className="p-0 h-auto" onClick={() => navigate(`/projects/${changeOrder.project_id}`)}>{changeOrder.project?.name || "Unknown"}</Button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div><p className="text-sm font-medium text-muted-foreground">Customer</p><p>{changeOrder.customer_name}</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changeOrder.line_items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">${item.unit_price.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">${item.total.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm"><span>Subtotal:</span><span>${changeOrder.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span>Tax ({changeOrder.tax_rate}%):</span><span>${changeOrder.tax_amount.toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold text-lg border-t pt-2"><span>Total:</span><span>${changeOrder.total.toFixed(2)}</span></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Change Order</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DetailPageLayout>
  );
}
