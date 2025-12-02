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
} from "@/components/ui/dropdown-menu";
import { usePurchaseOrder, useUpdatePurchaseOrder } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowLeft, ShoppingCart, Truck, Building, Briefcase, Send, CheckCircle, CheckCheck, XCircle, Loader2, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

const PurchaseOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isSending, setIsSending] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const { data: purchaseOrder, isLoading } = usePurchaseOrder(id || "");
  const { data: vendors } = useVendors();
  const updatePurchaseOrder = useUpdatePurchaseOrder();
  const { role, isAdmin, isManager } = useUserRole();
  const isMobile = useIsMobile();
  const vendor = purchaseOrder && vendors?.find((v) => v.id === purchaseOrder.vendor_id);

  const canApprove = (isAdmin || isManager) && purchaseOrder?.status === 'pending_approval';
  const canSend = purchaseOrder?.status === 'draft' && purchaseOrder?.approved_by;
  const canComplete = purchaseOrder?.status === 'in-progress';

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

          {/* More dropdown - contains secondary actions */}
          {(canApprove || canSend || canComplete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size={isMobile ? "sm" : "icon"}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canApprove && (
                  <DropdownMenuItem onClick={() => handleApprove(false)} disabled={isApproving}>
                    <XCircle className="mr-2 h-4 w-4" /> 
                    {isMobile ? "Reject PO" : "Reject"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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

        {/* Project Info */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              Project
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium">{purchaseOrder.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Project</span>
              <span className="font-medium">{purchaseOrder.project_name}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card className="glass border-border/50 mt-6">
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          {isMobile ? (
            // Mobile: Card-based layout
            <div className="space-y-3">
              {purchaseOrder.line_items.map((item) => (
                <Card key={item.id} className="p-4 bg-secondary/30">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-sm flex-1 pr-2">{item.description}</span>
                    <span className="text-primary font-semibold shrink-0">
                      ${Number(item.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div>
                      <span className="block text-xs mb-0.5">Quantity</span>
                      <span>{item.quantity}</span>
                    </div>
                    <div>
                      <span className="block text-xs mb-0.5">Unit Price</span>
                      <span>${Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            // Desktop: Table layout
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrder.line_items.map((item) => (
                  <TableRow key={item.id} className="border-border/30">
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      ${Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${Number(item.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="mt-4 pt-4 border-t border-border/30 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${Number(purchaseOrder.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Tax ({purchaseOrder.tax_rate}%)</span>
              <span>${Number(purchaseOrder.tax_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center text-lg font-bold pt-2 border-t border-border/30">
              <span>Total</span>
              <span className="text-primary">${Number(purchaseOrder.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </CardContent>
      </Card>

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
    </PageLayout>
  );
};

export default PurchaseOrderDetail;
