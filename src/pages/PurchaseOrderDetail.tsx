import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenuSeparator,
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
import { usePurchaseOrder, useUpdatePurchaseOrder, useDeletePurchaseOrder, useReopenPurchaseOrder } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { usePOAddendums } from "@/integrations/supabase/hooks/usePOAddendums";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowLeft, ShoppingCart, Truck, Building, Send, CheckCircle, CheckCheck, XCircle, Loader2, MoreVertical, Receipt, Lock, LockOpen, Pencil, Printer, Download, Copy, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { CreateBillFromPODialog } from "@/components/purchase-orders/CreateBillFromPODialog";
import { ClosePODialog } from "@/components/purchase-orders/ClosePODialog";
import { ReopenPODialog } from "@/components/purchase-orders/ReopenPODialog";
import { POBillingSummary } from "@/components/purchase-orders/POBillingSummary";
import { RelatedVendorBills } from "@/components/purchase-orders/RelatedVendorBills";
import { POAddendums } from "@/components/purchase-orders/POAddendums";
import { RestoreLineItemsDialog } from "@/components/purchase-orders/RestoreLineItemsDialog";
import { formatCurrency } from "@/lib/utils";
import { generatePurchaseOrderPDF, ProjectInfoForPDF } from "@/utils/purchaseOrderPdfExport";
import { downloadWorkOrderPDF, printWorkOrderPDF, mapPurchaseOrderToWorkOrder } from "@/utils/workOrderPdfExport";
import { FileText, AlertTriangle } from "lucide-react";

const PurchaseOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isSending, setIsSending] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showCreateBillDialog, setShowCreateBillDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: purchaseOrder, isLoading } = usePurchaseOrder(id || "");
  const { data: addendums } = usePOAddendums(id || "");
  const { data: vendors } = useVendors();
  const { data: projects } = useProjects();
  const updatePurchaseOrder = useUpdatePurchaseOrder();
  const deletePurchaseOrder = useDeletePurchaseOrder();
  const { isAdmin, isManager } = useUserRole();
  const isMobile = useIsMobile();
  const vendor = purchaseOrder && vendors?.find((v) => v.id === purchaseOrder.vendor_id);
  const project = purchaseOrder && projects?.find((p) => p.id === purchaseOrder.project_id);

  const canApprove = (isAdmin || isManager) && purchaseOrder?.status === 'pending_approval';
  const canSend = purchaseOrder?.status === 'draft' && purchaseOrder?.approved_by;
  const canComplete = purchaseOrder?.status === 'in-progress';
  const canCreateBill = purchaseOrder && !purchaseOrder.is_closed;
  const canClose = purchaseOrder && !purchaseOrder.is_closed && (isAdmin || isManager);
  const canReopen = purchaseOrder && purchaseOrder.is_closed && isAdmin;
  const canEdit = purchaseOrder && !purchaseOrder.is_closed && (isAdmin || isManager);
  const canDelete = purchaseOrder && (
    (purchaseOrder.status === 'draft' || purchaseOrder.status === 'pending_approval') || isAdmin
  ) && (isAdmin || isManager);
  const canDuplicate = !!purchaseOrder;

  const billedAmount = Number(purchaseOrder?.billed_amount || 0);
  const total = Number(purchaseOrder?.total || 0);
  const totalAddendumAmount = Number(purchaseOrder?.total_addendum_amount || 0);
  const grandTotal = total + totalAddendumAmount;
  const remainingAmount = grandTotal - billedAmount;
  
  // Detect orphaned PO (has subtotal but no line items)
  const hasOrphanedLineItems = purchaseOrder && 
    purchaseOrder.subtotal > 0 && 
    (!purchaseOrder.line_items || purchaseOrder.line_items.length === 0);


  const handleApprove = async (approved: boolean) => {
    if (!purchaseOrder) return;

    setIsApproving(true);
    try {
      const { error } = await supabase.functions.invoke("approve-purchase-order", {
        body: { 
          purchaseOrderId: purchaseOrder.id,
          approved,
        },
      });

      if (error) throw error;

      toast.success(`Purchase order ${approved ? 'approved' : 'rejected'} successfully!`);
    } catch (error: any) {
      console.error(`Error ${approved ? 'approving' : 'rejecting'} purchase order:`, error);
      toast.error(error.message || `Failed to ${approved ? 'approve' : 'reject'} purchase order`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleSendToVendor = async () => {
    if (!purchaseOrder) return;
    
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-purchase-order", {
        body: { purchaseOrderId: purchaseOrder.id },
      });

      if (error) throw error;

      toast.success("Purchase order sent to vendor successfully!");
    } catch (error: any) {
      console.error("Error sending purchase order:", error);
      toast.error(error.message || "Failed to send purchase order");
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkComplete = async () => {
    if (!purchaseOrder) return;
    
    try {
      await updatePurchaseOrder.mutateAsync({
        id: purchaseOrder.id,
        purchaseOrder: { status: "completed" },
      });
      toast.success("Purchase order marked as complete!");
    } catch (error: any) {
      console.error("Error marking complete:", error);
      toast.error("Failed to mark purchase order as complete");
    }
  };

  const handlePrint = async () => {
    if (!purchaseOrder) return;
    
    const workOrderData = mapPurchaseOrderToWorkOrder({
      purchaseOrder: {
        ...purchaseOrder,
        line_items: purchaseOrder.line_items.map(item => ({
          description: item.description,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          total: Number(item.total),
        })),
      },
      project: project ? {
        address: project.address,
        city: project.city,
        state: project.state,
        zip: project.zip,
        poc_name: project.poc_name,
        poc_phone: project.poc_phone,
        start_date: project.start_date,
      } : null,
      installationInstructions: purchaseOrder.notes || undefined,
    });
    
    await printWorkOrderPDF(workOrderData);
  };

  const handleDownloadPDF = () => {
    if (!purchaseOrder) return;
    
    // Build project info for PDF from the linked project
    const projectInfo: ProjectInfoForPDF | undefined = project ? {
      address: project.address,
      city: project.city,
      state: project.state,
      zip: project.zip,
      contact_name: project.poc_name,
      contact_phone: project.poc_phone,
      contact_email: project.poc_email,
    } : undefined;
    
    generatePurchaseOrderPDF(purchaseOrder, addendums, projectInfo);
  };

  const handleDownloadWorkOrder = async () => {
    if (!purchaseOrder) return;
    
    const workOrderData = mapPurchaseOrderToWorkOrder({
      purchaseOrder: {
        ...purchaseOrder,
        line_items: purchaseOrder.line_items.map(item => ({
          description: item.description,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          total: Number(item.total),
        })),
      },
      project: project ? {
        address: project.address,
        city: project.city,
        state: project.state,
        zip: project.zip,
        poc_name: project.poc_name,
        poc_phone: project.poc_phone,
        start_date: project.start_date,
      } : null,
      installationInstructions: purchaseOrder.notes || undefined,
    });
    
    await downloadWorkOrderPDF(workOrderData);
  };

  const handleDuplicate = () => {
    if (!purchaseOrder) return;
    navigate(`/purchase-orders/new?duplicate=${purchaseOrder.id}`);
  };

  const handleDelete = async () => {
    if (!purchaseOrder) return;
    
    setIsDeleting(true);
    try {
      await deletePurchaseOrder.mutateAsync(purchaseOrder.id);
      toast.success("Purchase order deleted successfully");
      navigate("/purchase-orders");
    } catch (error: any) {
      console.error("Error deleting purchase order:", error);
      toast.error("Failed to delete purchase order");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (isLoading) {
    return (
      <PageLayout title="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    );
  }

  if (!purchaseOrder) {
    return (
      <PageLayout title="Purchase Order Not Found">
        <Button variant="ghost" onClick={() => navigate("/purchase-orders")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Purchase Orders
        </Button>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={purchaseOrder.number}
      description={`PO for ${purchaseOrder.vendor_name}`}
      actions={
        <div className="flex gap-2">
          {/* Primary actions - always visible (context-dependent) */}
          {canApprove && (
            <Button 
              size={isMobile ? "sm" : "default"}
              onClick={() => handleApprove(true)} 
              disabled={isApproving}
            >
              {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              {!isMobile && <span className="ml-2">Approve</span>}
            </Button>
          )}
          {canSend && (
            <Button 
              variant="glow" 
              size={isMobile ? "sm" : "default"}
              onClick={handleSendToVendor} 
              disabled={isSending}
            >
              <Send className={`h-4 w-4 ${!isMobile && "mr-2"}`} />
              {!isMobile && (isSending ? "Sending..." : "Send to Vendor")}
            </Button>
          )}
          {canComplete && (
            <Button 
              variant="success" 
              size={isMobile ? "sm" : "default"}
              onClick={handleMarkComplete}
            >
              <CheckCircle className={`h-4 w-4 ${!isMobile && "mr-2"}`} />
              {!isMobile && "Mark Complete"}
            </Button>
          )}
          {canCreateBill && (
            <Button 
              size={isMobile ? "sm" : "default"}
              onClick={() => setShowCreateBillDialog(true)}
            >
              <Receipt className={`h-4 w-4 ${!isMobile && "mr-2"}`} />
              {!isMobile && "Create Bill"}
            </Button>
          )}

          {/* Print and Download buttons */}
          <Button 
            variant="outline" 
            size={isMobile ? "sm" : "default"}
            onClick={handlePrint}
            className="no-print"
          >
            <Printer className={`h-4 w-4 ${!isMobile && "mr-2"}`} />
            {!isMobile && "Print"}
          </Button>
          <Button 
            variant="outline" 
            size={isMobile ? "sm" : "default"}
            onClick={handleDownloadPDF}
          >
            <Download className={`h-4 w-4 ${!isMobile && "mr-2"}`} />
            {!isMobile && "PDF"}
          </Button>

          {/* More dropdown - contains secondary actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size={isMobile ? "sm" : "icon"} className="no-print">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem onClick={() => navigate(`/purchase-orders/${purchaseOrder.id}/edit`)}>
                  <Pencil className="mr-2 h-4 w-4" /> 
                  Edit
                </DropdownMenuItem>
              )}
              {canDuplicate && (
                <DropdownMenuItem onClick={handleDuplicate}>
                  <Copy className="mr-2 h-4 w-4" /> 
                  Duplicate
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleDownloadWorkOrder}>
                <FileText className="mr-2 h-4 w-4" /> 
                Download Work Order
              </DropdownMenuItem>
              {canApprove && (
                <DropdownMenuItem onClick={() => handleApprove(false)} disabled={isApproving}>
                  <XCircle className="mr-2 h-4 w-4" /> 
                  Reject
                </DropdownMenuItem>
              )}
              {canClose && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowCloseDialog(true)}>
                    <Lock className="mr-2 h-4 w-4" /> 
                    Close PO
                  </DropdownMenuItem>
                </>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> 
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <Button
        variant="ghost"
        className="mb-6"
        onClick={() => navigate("/purchase-orders")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Purchase Orders
      </Button>

      {/* Missing Line Items Warning */}
      {hasOrphanedLineItems && (
        <div className="mb-6 bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Line Items Missing</p>
              <p className="text-sm text-muted-foreground">
                This PO has a subtotal of {formatCurrency(purchaseOrder.subtotal)} but no line items are showing. 
                Would you like to restore them?
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowRestoreDialog(true)}
            className="shrink-0"
          >
            Restore Items
          </Button>
        </div>
      )}

      {/* Closed PO Warning */}
      {purchaseOrder.is_closed && (
        <div className="mb-6 bg-warning/10 border border-warning/20 rounded-lg p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-warning" />
            <div>
              <p className="font-medium text-warning">This Purchase Order is Closed</p>
              <p className="text-sm text-muted-foreground">
                No new vendor bills can be created against this PO.
                {purchaseOrder.closed_at && ` Closed on ${format(new Date(purchaseOrder.closed_at), "MMM d, yyyy")}`}
              </p>
            </div>
          </div>
          {canReopen && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowReopenDialog(true)}
              className="shrink-0"
            >
              <LockOpen className="h-4 w-4 mr-2" />
              Reopen
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:gap-6 lg:grid-cols-3">
        {/* PO Info */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              PO Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={purchaseOrder.status} />
            </div>
            {purchaseOrder.status === 'pending_approval' && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                <p className="text-sm font-medium text-warning">⏳ Awaiting Manager Approval</p>
                {purchaseOrder.submitted_for_approval_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Submitted: {format(new Date(purchaseOrder.submitted_for_approval_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                )}
              </div>
            )}
            {purchaseOrder.approved_by && purchaseOrder.approved_at && (
              <div className="bg-success/10 border border-success/20 rounded-lg p-3">
                <p className="text-sm font-medium text-success">✓ Approved</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(purchaseOrder.approved_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due Date</span>
              <span className="font-medium">{format(new Date(purchaseOrder.due_date), "MMM d, yyyy")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{format(new Date(purchaseOrder.created_at), "MMM d, yyyy")}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Job Order</span>
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => navigate(`/job-orders/${purchaseOrder.job_order_id}`)}
              >
                {purchaseOrder.job_order_number}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Vendor Info */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Vendor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{purchaseOrder.vendor_name}</span>
            </div>
            {vendor && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="text-sm">{vendor.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span>{vendor.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Specialty</span>
                  <span>{vendor.specialty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rating</span>
                  <span className="text-warning">★ {vendor.rating}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Billing Summary */}
        <POBillingSummary
          total={grandTotal}
          billedAmount={billedAmount}
          remainingAmount={remainingAmount}
        />
      </div>

      {/* Project Info */}
      <Card className="glass border-border/50 mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-primary" />
            Project
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-8">
          <div>
            <span className="text-muted-foreground text-sm">Customer</span>
            <p className="font-medium">{purchaseOrder.customer_name}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-sm">Project</span>
            <p className="font-medium">{purchaseOrder.project_name}</p>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card className="glass border-border/50 mt-6">
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          {isMobile ? (
            // Mobile: Card-based layout
            <div className="space-y-3">
              {purchaseOrder.line_items.map((item) => {
                const billed = Number(item.billed_quantity || 0);
                const remaining = Number(item.quantity) - billed;
                return (
                  <Card key={item.id} className="p-4 bg-secondary/30">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm flex-1 pr-2">{item.description}</span>
                      <span className="text-primary font-semibold shrink-0">
                        {formatCurrency(Number(item.total))}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-sm text-muted-foreground">
                      <div>
                        <span className="block text-xs mb-0.5">Ordered</span>
                        <span>{item.quantity}</span>
                      </div>
                      <div>
                        <span className="block text-xs mb-0.5">Billed</span>
                        <span className="text-success">{billed}</span>
                      </div>
                      <div>
                        <span className="block text-xs mb-0.5">Remaining</span>
                        <span className={remaining > 0 ? "text-warning" : ""}>{remaining}</span>
                      </div>
                      <div>
                        <span className="block text-xs mb-0.5">Unit Price</span>
                        <span>{formatCurrency(Number(item.unit_price))}</span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            // Desktop: Table layout
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Billed</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrder.line_items.map((item) => {
                  const billed = Number(item.billed_quantity || 0);
                  const remaining = Number(item.quantity) - billed;
                  return (
                    <TableRow key={item.id} className="border-border/30">
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right text-success">{billed}</TableCell>
                      <TableCell className={`text-right ${remaining > 0 ? "text-warning font-medium" : "text-muted-foreground"}`}>
                        {remaining}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(item.unit_price))}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(item.total))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <div className="mt-4 pt-4 border-t border-border/30 space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <span>PO Total (Vendor Cost)</span>
              <span>{formatCurrency(Number(purchaseOrder.total))}</span>
            </div>
            {totalAddendumAmount > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">+ Addendums</span>
                <span className="text-success">+{formatCurrency(totalAddendumAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-lg font-bold pt-2 border-t border-border/30">
              <span>Grand Total</span>
              <span className="text-primary">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Addendums / Change Orders */}
      <div className="mt-6">
        <POAddendums
          purchaseOrderId={purchaseOrder.id}
          purchaseOrderNumber={purchaseOrder.number}
          isClosed={purchaseOrder.is_closed}
        />
      </div>

      {/* Related Vendor Bills */}
      <div className="mt-6">
        <RelatedVendorBills purchaseOrderId={purchaseOrder.id} />
      </div>

      {/* Notes */}
      {purchaseOrder.notes && (
        <Card className="glass border-border/50 mt-6">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{purchaseOrder.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <CreateBillFromPODialog
        open={showCreateBillDialog}
        onOpenChange={setShowCreateBillDialog}
        purchaseOrder={purchaseOrder}
      />
      <ClosePODialog
        open={showCloseDialog}
        onOpenChange={setShowCloseDialog}
        purchaseOrderId={purchaseOrder.id}
        purchaseOrderNumber={purchaseOrder.number}
        remainingAmount={remainingAmount}
      />
      <ReopenPODialog
        open={showReopenDialog}
        onOpenChange={setShowReopenDialog}
        purchaseOrderId={purchaseOrder.id}
        purchaseOrderNumber={purchaseOrder.number}
      />
      <RestoreLineItemsDialog
        open={showRestoreDialog}
        onOpenChange={setShowRestoreDialog}
        purchaseOrderId={purchaseOrder.id}
        jobOrderId={purchaseOrder.job_order_id}
        expectedSubtotal={purchaseOrder.subtotal}
      />
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {purchaseOrder.number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
};

export default PurchaseOrderDetail;
