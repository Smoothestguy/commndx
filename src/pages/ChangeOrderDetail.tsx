import { useParams, useNavigate } from "react-router-dom";
import { DetailPageLayout } from "@/components/layout/DetailPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Edit, Trash2, MoreVertical, CheckCircle, XCircle, Send, Receipt, Loader2,
  FileText, Building2, User, Link as LinkIcon, Package, Truck, AlertTriangle,
  ShieldAlert, Upload, ShieldCheck,
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import {
  useChangeOrder, useDeleteChangeOrder, useHardDeleteChangeOrder,
  useUpdateChangeOrderStatus, useUpdateChangeOrder, ChangeOrderStatus,
} from "@/integrations/supabase/hooks/useChangeOrders";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { ImportToAddendumDialog } from "@/components/change-orders/ImportToAddendumDialog";
import { ConvertCOToPODialog } from "@/components/change-orders/ConvertCOToPODialog";
import { ChangeOrderApprovalTimeline } from "@/components/change-orders/ChangeOrderApprovalTimeline";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";

const statusConfig: Record<
  ChangeOrderStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  pending_approval: { label: "Pending Approval", variant: "outline" },
  pending_field_supervisor: { label: "Pending Field Supervisor", variant: "outline" },
  pending_customer_pm: { label: "Pending Customer PM", variant: "outline" },
  approved_pending_wo: { label: "Approved — Awaiting WO", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  invoiced: { label: "Invoiced", variant: "default" },
};

export default function ChangeOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: changeOrder, isLoading, error, isError } = useChangeOrder(id);
  const deleteChangeOrder = useDeleteChangeOrder();
  const hardDeleteChangeOrder = useHardDeleteChangeOrder();
  const updateStatus = useUpdateChangeOrderStatus();
  const updateChangeOrder = useUpdateChangeOrder();
  const { isAdmin, isManager } = useUserRole();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showHardDeleteDialog, setShowHardDeleteDialog] = useState(false);
  const [showAddToPODialog, setShowAddToPODialog] = useState(false);
  const [showConvertToPODialog, setShowConvertToPODialog] = useState(false);
  const [woNumber, setWoNumber] = useState("");
  const [woUploading, setWoUploading] = useState(false);

  // Submit for approval mutation
  const submitForApproval = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-co-approval", {
        body: { change_order_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["change_orders"] });
      toast.success("Change order submitted for approval — emails sent!");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const isEditable = changeOrder?.status === "draft";
  const canEdit = isAdmin || (isEditable && isManager);
  const canDelete = isAdmin || (changeOrder?.status === "draft" && isManager);
  const canSubmitForApproval = changeOrder?.status === "draft" && (isAdmin || isManager);
  const canApprove = changeOrder?.status === "pending_approval" && isAdmin;
  const canCreateInvoice = (changeOrder?.status === "approved" || changeOrder?.status === "invoiced") && (isAdmin || isManager);
  const canAddToPO = changeOrder?.status === "approved" && (isAdmin || isManager);
  const isAwaitingWO = changeOrder?.status === "approved_pending_wo";

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
    if (!id || !changeOrder) return;
    await deleteChangeOrder.mutateAsync(id);
    navigate(`/projects/${changeOrder.project_id}`);
  };

  const handleHardDelete = async () => {
    if (!id || !changeOrder) return;
    await hardDeleteChangeOrder.mutateAsync(id);
    navigate(`/projects/${changeOrder.project_id}`);
  };

  const handleWOUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    
    setWoUploading(true);
    try {
      const filePath = `change-orders/${id}/wo-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("form-uploads")
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;

      await updateChangeOrder.mutateAsync({
        id,
        customer_wo_file_path: filePath,
        customer_wo_uploaded_at: new Date().toISOString(),
      } as any);

      toast.success("Work order document uploaded");
      queryClient.invalidateQueries({ queryKey: ["change_orders"] });
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setWoUploading(false);
    }
  };

  const handleAuthorizeWork = async () => {
    if (!id || !changeOrder) return;
    
    if (!woNumber.trim() && !changeOrder.customer_wo_number) {
      toast.error("Please enter the customer Work Order number");
      return;
    }

    try {
      const { error } = await supabase
        .from("change_orders")
        .update({
          work_authorized: true,
          status: "approved",
          customer_wo_number: woNumber.trim() || changeOrder.customer_wo_number,
        } as any)
        .eq("id", id);

      if (error) throw error;
      
      // Log the action
      await supabase.from("change_order_approval_log").insert({
        change_order_id: id,
        action: "wo_received",
        actor_name: "System",
        notes: `Work authorized. WO #${woNumber.trim() || changeOrder.customer_wo_number}`,
      } as any);

      queryClient.invalidateQueries({ queryKey: ["change_orders"] });
      toast.success("Work authorized!");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const backPath = changeOrder ? `/projects/${changeOrder.project_id}` : "/projects";

  if (isLoading) {
    return (
      <DetailPageLayout title="Change Order" backPath="/projects">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DetailPageLayout>
    );
  }

  if (isError) {
    return (
      <DetailPageLayout title="Error Loading Change Order" backPath="/projects">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">Failed to load change order.</p>
          <p className="text-sm text-muted-foreground mt-2">{(error as Error)?.message}</p>
        </div>
      </DetailPageLayout>
    );
  }

  if (!changeOrder) {
    return (
      <DetailPageLayout title="Change Order Not Found" backPath="/projects">
        <div className="text-center py-12">
          <p className="text-muted-foreground">The change order doesn't exist.</p>
        </div>
      </DetailPageLayout>
    );
  }

  const status = statusConfig[changeOrder.status];

  const desktopActions = (
    <div className="flex items-center gap-2">
      {canSubmitForApproval && (
        <Button variant="default" onClick={() => submitForApproval.mutate()} disabled={submitForApproval.isPending}>
          {submitForApproval.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Submit for Approval
        </Button>
      )}
      {canApprove && (
        <>
          <Button variant="default" onClick={() => handleStatusChange("approved")} disabled={updateStatus.isPending}>
            <CheckCircle className="mr-2 h-4 w-4" /> Approve
          </Button>
          <Button variant="destructive" onClick={() => handleStatusChange("rejected")} disabled={updateStatus.isPending}>
            <XCircle className="mr-2 h-4 w-4" /> Reject
          </Button>
        </>
      )}
      {canAddToPO && (
        <>
          <Button variant="outline" onClick={() => setShowConvertToPODialog(true)}>
            <Truck className="mr-2 h-4 w-4" /> Convert to PO
          </Button>
          <Button variant="outline" onClick={() => setShowAddToPODialog(true)}>
            <Package className="mr-2 h-4 w-4" /> Add to Existing PO
          </Button>
        </>
      )}
      {canCreateInvoice && (
        <Button onClick={() => navigate(`/invoices/new?changeOrderId=${id}`)}>
          <Receipt className="mr-2 h-4 w-4" /> Create Invoice
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
          <DropdownMenuItem onClick={() => window.print()}>
            <FileText className="mr-2 h-4 w-4" />Print
          </DropdownMenuItem>
          {canDelete && (
            <DropdownMenuItem onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="mr-2 h-4 w-4" />Move to Trash
            </DropdownMenuItem>
          )}
          {isAdmin && changeOrder?.status === "draft" && (
            <DropdownMenuItem onClick={() => setShowHardDeleteDialog(true)} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />Delete Permanently
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <DetailPageLayout
      title={changeOrder.number}
      subtitle={changeOrder.reason}
      backPath={backPath}
      desktopActions={desktopActions}
    >
      <div className="space-y-6">
        {/* Work Authorization Banner */}
        {!changeOrder.work_authorized && changeOrder.status !== "draft" && (
          <div className="flex items-center gap-2 bg-destructive/10 text-destructive p-3 rounded-lg border border-destructive/20">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span className="font-semibold text-sm">NOT AUTHORIZED — Do not begin work until this change order is fully approved and a Work Order is received.</span>
          </div>
        )}
        {changeOrder.work_authorized && (
          <div className="flex items-center gap-2 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 p-3 rounded-lg border border-green-200 dark:border-green-800">
            <ShieldCheck className="h-5 w-5 shrink-0" />
            <span className="font-semibold text-sm">WORK AUTHORIZED{changeOrder.customer_wo_number ? ` — WO #${changeOrder.customer_wo_number}` : ""}</span>
          </div>
        )}

        <div className="flex items-center gap-4 flex-wrap">
          <Badge variant={status.variant} className="text-sm px-3 py-1">{status.label}</Badge>
          <Badge variant={changeOrder.change_type === 'deductive' ? 'destructive' : 'default'} className="text-sm px-3 py-1">
            {changeOrder.change_type === 'deductive' ? 'Deductive (Credit)' : 'Additive'}
          </Badge>
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

        {/* Approval Timeline */}
        <ChangeOrderApprovalTimeline
          changeOrderId={changeOrder.id}
          status={changeOrder.status}
          sentForApprovalAt={(changeOrder as any).sent_for_approval_at}
          fieldSupervisorSignedAt={(changeOrder as any).field_supervisor_signed_at}
          customerPmSignedAt={(changeOrder as any).customer_pm_signed_at}
          workAuthorized={changeOrder.work_authorized}
          customerWoNumber={changeOrder.customer_wo_number}
        />

        {/* Work Order Upload (when awaiting WO) */}
        {isAwaitingWO && (isAdmin || isManager) && (
          <Card className="border-amber-300 dark:border-amber-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <Upload className="h-5 w-5" />
                Upload Customer Work Order
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Both customer signatures have been received. Upload the customer's formal Work Order document and enter the WO number to authorize work.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer WO/CO Number</Label>
                  <Input
                    placeholder="e.g. WO-2024-001"
                    value={woNumber}
                    onChange={(e) => setWoNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Work Order Document</Label>
                  <Input type="file" onChange={handleWOUpload} disabled={woUploading} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                  {(changeOrder as any).customer_wo_file_path && (
                    <p className="text-xs text-green-600">✓ Document uploaded</p>
                  )}
                </div>
              </div>
              <Button
                onClick={handleAuthorizeWork}
                disabled={!woNumber.trim() && !changeOrder.customer_wo_number}
                className="w-full sm:w-auto"
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Authorize Work
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Scope Reference Section for Deductive COs */}
        {changeOrder.change_type === 'deductive' && changeOrder.scope_reference && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" /> Scope Reduction Reference
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{changeOrder.scope_reference}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Client Price</TableHead>
                  <TableHead className="text-right">Vendor Cost</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changeOrder.line_items.map((item) => {
                  const vendorTotal = item.quantity * (item.vendor_cost || 0);
                  const margin = item.total - vendorTotal;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCurrency(item.vendor_cost || 0)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(margin)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="mt-4 flex justify-end">
              {(() => {
                const vendorCostTotal = changeOrder.line_items.reduce((sum, item) => sum + (item.quantity * (item.vendor_cost || 0)), 0);
                const grossProfit = changeOrder.total - vendorCostTotal;
                const marginPercent = vendorCostTotal > 0 ? ((grossProfit / vendorCostTotal) * 100) : 0;
                return (
                  <div className="w-80 space-y-2">
                    <div className="flex justify-between text-sm"><span>Client Subtotal:</span><span>{formatCurrency(changeOrder.subtotal)}</span></div>
                    <div className="flex justify-between text-sm"><span>Tax ({changeOrder.tax_rate}%):</span><span>{formatCurrency(changeOrder.tax_amount)}</span></div>
                    <div className="flex justify-between font-semibold text-lg border-t pt-2"><span>Client Total:</span><span>{formatCurrency(changeOrder.total)}</span></div>
                    <div className="flex justify-between text-sm text-muted-foreground pt-2 border-t"><span>Vendor Cost Total:</span><span>{formatCurrency(vendorCostTotal)}</span></div>
                    <div className="flex justify-between text-sm font-medium text-green-600"><span>Gross Profit:</span><span>{formatCurrency(grossProfit)} ({marginPercent.toFixed(1)}%)</span></div>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
            <AlertDialogDescription>This change order will be moved to trash. You can restore it later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Move to Trash</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showHardDeleteDialog} onOpenChange={setShowHardDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete?</AlertDialogTitle>
            <AlertDialogDescription>This action CANNOT be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleHardDelete} className="bg-destructive text-destructive-foreground">Delete Forever</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportToAddendumDialog
        open={showAddToPODialog}
        onOpenChange={setShowAddToPODialog}
        projectId={changeOrder.project_id}
        changeOrderId={id}
      />

      {changeOrder && (
        <ConvertCOToPODialog
          open={showConvertToPODialog}
          onOpenChange={setShowConvertToPODialog}
          changeOrder={changeOrder}
        />
      )}
    </DetailPageLayout>
  );
}
