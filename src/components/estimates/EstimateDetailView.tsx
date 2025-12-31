import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProducts } from "@/integrations/supabase/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  useEstimate,
  useUpdateEstimate,
  useDeleteEstimate,
  useConvertEstimateToJobOrder,
  useConvertEstimateToInvoice,
  useEstimateQuickBooksStatus,
  useSyncEstimateToQuickBooks,
} from "@/integrations/supabase/hooks/useEstimates";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { ConvertToJobOrderDialog } from "./ConvertToJobOrderDialog";
import { EstimateAttachments } from "./EstimateAttachments";
import { EstimateVersionHistory } from "./EstimateVersionHistory";
import { Download, Edit, Trash2, Briefcase, MoreVertical, Loader2, Send, Copy, CheckCircle, FileText, Eye, RefreshCw } from "lucide-react";
import { generateEstimatePDF } from "@/utils/estimatePdfExport";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface EstimateDetailViewProps {
  estimateId: string;
}

export function EstimateDetailView({ estimateId }: EstimateDetailViewProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: estimate, isLoading, error } = useEstimate(estimateId);
  const updateEstimate = useUpdateEstimate();
  const deleteEstimate = useDeleteEstimate();
  const convertToJobOrder = useConvertEstimateToJobOrder();
  const convertToInvoice = useConvertEstimateToInvoice();
  const { data: qbStatus, isLoading: qbStatusLoading } = useEstimateQuickBooksStatus(estimateId);
  const syncToQuickBooks = useSyncEstimateToQuickBooks();
  const [isSending, setIsSending] = useState(false);
  const { data: products } = useProducts();
  const { data: companySettings } = useCompanySettings();
  const { data: customers } = useCustomers();

  // Get customer address
  const customer = customers?.find((c) => c.id === estimate?.customer_id);
  const customerAddress = customer?.address || null;

  const getProductName = (item: { product_id?: string | null; product_name?: string | null }) => {
    // Prefer stored product_name, fallback to lookup from products table
    if (item.product_name) return item.product_name;
    if (!item.product_id) return null;
    return products?.find((p) => p.id === item.product_id)?.name || null;
  };

  const handleStatusChange = async (status: "draft" | "pending" | "approved" | "sent") => {
    updateEstimate.mutate({
      id: estimateId,
      estimate: { status },
    });
  };

  const handleDelete = async () => {
    deleteEstimate.mutate(estimateId, {
      onSuccess: () => {
        navigate("/estimates");
      },
    });
  };

  const handleConvert = async (projectId: string, projectName: string) => {
    convertToJobOrder.mutate(
      { estimateId, projectId, projectName },
      {
        onSuccess: (jobOrder) => {
          navigate(`/job-orders/${jobOrder.id}`);
        },
      }
    );
  };

  const handleConvertToInvoice = async () => {
    convertToInvoice.mutate(estimateId, {
      onSuccess: (invoice) => {
        navigate(`/invoices/${invoice.id}`);
      },
    });
  };

  const handleSendToCustomer = async () => {
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-estimate", {
        body: { estimateId },
      });

      if (error) throw error;

      toast.success("Estimate sent to customer successfully!");
      // Refetch estimate to get updated data
      window.location.reload();
    } catch (error: any) {
      console.error("Error sending estimate:", error);
      toast.error(error.message || "Failed to send estimate");
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyApprovalLink = () => {
    if (estimate?.approval_token) {
      const approvalUrl = `${window.location.origin}/approve-estimate/${estimate.approval_token}`;
      navigator.clipboard.writeText(approvalUrl);
      toast.success("Approval link copied to clipboard!");
    }
  };

  if (isLoading) {
    return (
      <PageLayout title="Loading..." description="Please wait">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  if (error || !estimate) {
    return (
      <PageLayout title="Error" description="Failed to load estimate">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              {error?.message || "Estimate not found"}
            </p>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  const canConvertToJobOrder = estimate.status === "approved";
  const canConvertToInvoice = estimate.status === "approved";

  return (
    <PageLayout
      title={
        <div className="flex items-center gap-3">
          <span>{estimate.number}</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            <Eye className="h-3 w-3" />
            Viewing
          </span>
        </div>
      }
      description="Estimate details"
      actions={
        <div className="flex gap-2">
          {/* Primary action - always visible */}
          {estimate.status !== "approved" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={isSending}
                  size={isMobile ? "sm" : "default"}
                >
                  {isSending ? (
                    <Loader2 className={`h-4 w-4 animate-spin ${!isMobile && "mr-2"}`} />
                  ) : (
                    <Send className={`h-4 w-4 ${!isMobile && "mr-2"}`} />
                  )}
                  {!isMobile && (estimate.sent_at ? "Resend Estimate" : "Send to Customer")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Send Estimate to Customer?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will send estimate {estimate.number} to {estimate.customer_name} via email. Are you sure you want to proceed?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSendToCustomer}>
                    Send Estimate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Desktop: Show all buttons */}
          {!isMobile && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  const salesRepName = estimate.created_by_profile 
                    ? `${estimate.created_by_profile.first_name || ''} ${estimate.created_by_profile.last_name || ''}`.trim() || null
                    : null;
                  const creatorEmail = estimate.created_by_profile?.email || null;
                  generateEstimatePDF({
                    number: estimate.number,
                    customerName: estimate.customer_name,
                    customerAddress,
                        customerPhone: estimate.customer_contact?.phone,
                        customerEmail: estimate.customer_contact?.email,
                        jobsiteAddress: estimate.jobsite_address || estimate.customer_contact?.jobsite_address,
                    projectName: estimate.project_name,
                    status: estimate.status,
                    createdAt: estimate.created_at,
                    validUntil: estimate.valid_until,
                    notes: estimate.notes,
                    lineItems: estimate.line_items.map((item) => ({
                      id: item.id,
                      description: item.description,
                      productName: getProductName(item as any) || undefined,
                      quantity: item.quantity,
                      unitPrice: item.unit_price,
                      markup: item.markup,
                      total: item.total,
                    })),
                    subtotal: estimate.subtotal,
                    taxRate: estimate.tax_rate,
                    taxAmount: estimate.tax_amount,
                    total: estimate.total,
                    salesRepName,
                    creatorEmail,
                    companySettings,
                  });
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>

              {estimate.approval_token && (
                <Button variant="outline" onClick={handleCopyApprovalLink}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => syncToQuickBooks.mutate(estimateId)}
                disabled={syncToQuickBooks.isPending}
              >
                {syncToQuickBooks.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : qbStatus?.quickbooks_estimate_id ? (
                  <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {qbStatus?.quickbooks_estimate_id ? "QB Synced" : "Sync to QB"}
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate(`/estimates/${estimateId}/edit`)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>

              {canConvertToJobOrder && (
                <ConvertToJobOrderDialog
                  trigger={
                    <Button disabled={convertToJobOrder.isPending}>
                      {convertToJobOrder.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Briefcase className="mr-2 h-4 w-4" />
                      )}
                      Convert to Job Order
                    </Button>
                  }
                  customerId={estimate.customer_id}
                  estimateProjectId={estimate.project_id}
                  estimateProjectName={estimate.project_name}
                  isPending={convertToJobOrder.isPending}
                  onConvert={handleConvert}
                />
              )}

              {canConvertToInvoice && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="secondary" disabled={convertToInvoice.isPending}>
                      {convertToInvoice.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-2 h-4 w-4" />
                      )}
                      Convert to Invoice
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Convert to Invoice</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will create a new invoice from this estimate for direct billing. Continue?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleConvertToInvoice}>Convert</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}

          {/* More menu - contains secondary actions and mobile overflow */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size={isMobile ? "sm" : "icon"}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Mobile: Show additional actions */}
              {isMobile && (
                <>
                  <DropdownMenuItem
                    onClick={() => {
                      const salesRepName = estimate.created_by_profile 
                        ? `${estimate.created_by_profile.first_name || ''} ${estimate.created_by_profile.last_name || ''}`.trim() || null
                        : null;
                      const creatorEmail = estimate.created_by_profile?.email || null;
                      generateEstimatePDF({
                        number: estimate.number,
                        customerName: estimate.customer_name,
                        customerAddress,
                        customerPhone: estimate.customer_contact?.phone,
                        customerEmail: estimate.customer_contact?.email,
                        jobsiteAddress: estimate.jobsite_address || estimate.customer_contact?.jobsite_address,
                        projectName: estimate.project_name,
                        status: estimate.status,
                        createdAt: estimate.created_at,
                        validUntil: estimate.valid_until,
                        notes: estimate.notes,
                        lineItems: estimate.line_items.map((item) => ({
                          id: item.id,
                          description: item.description,
                          productName: getProductName(item as any) || undefined,
                          quantity: item.quantity,
                          unitPrice: item.unit_price,
                          markup: item.markup,
                          total: item.total,
                        })),
                        subtotal: estimate.subtotal,
                        taxRate: estimate.tax_rate,
                        taxAmount: estimate.tax_amount,
                        total: estimate.total,
                        salesRepName,
                        creatorEmail,
                        companySettings,
                      });
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </DropdownMenuItem>
                  {estimate.approval_token && (
                    <DropdownMenuItem onClick={handleCopyApprovalLink}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Approval Link
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate(`/estimates/${estimateId}/edit`)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Estimate
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => syncToQuickBooks.mutate(estimateId)}
                    disabled={syncToQuickBooks.isPending}
                  >
                    {syncToQuickBooks.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : qbStatus?.quickbooks_estimate_id ? (
                      <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {qbStatus?.quickbooks_estimate_id ? "QB Synced" : "Sync to QuickBooks"}
                  </DropdownMenuItem>
                  {canConvertToJobOrder && (
                    <ConvertToJobOrderDialog
                      trigger={
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <Briefcase className="mr-2 h-4 w-4" />
                          Convert to Job Order
                        </DropdownMenuItem>
                      }
                      customerId={estimate.customer_id}
                      estimateProjectId={estimate.project_id}
                      estimateProjectName={estimate.project_name}
                      isPending={convertToJobOrder.isPending}
                      onConvert={handleConvert}
                    />
                  )}
                  {canConvertToInvoice && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <FileText className="mr-2 h-4 w-4" />
                          Convert to Invoice
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Convert to Invoice</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will create a new invoice from this estimate for direct billing. Continue?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleConvertToInvoice}>Convert</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <Separator className="my-1" />
                </>
              )}
              
              {/* Status changes */}
              <DropdownMenuItem onClick={() => handleStatusChange("draft")}>
                Mark as Draft
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange("pending")}>
                Mark as Pending
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange("sent")}>
                Mark as Sent
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange("approved")}>
                Mark as Approved
              </DropdownMenuItem>
              <Separator className="my-1" />
              
              {/* Delete */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Estimate</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this estimate? This action cannot be
                      undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <div className="grid gap-4 lg:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Estimate Information</CardTitle>
                <StatusBadge status={estimate.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Customer</p>
                  <p className="text-sm">{estimate.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Project</p>
                  <p className="text-sm">{estimate.project_name || "No project"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Valid Until</p>
                  <p className="text-sm">
                    {format(new Date(estimate.valid_until), "MMM dd, yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created</p>
                  <p className="text-sm">
                    {format(new Date(estimate.created_at), "MMM dd, yyyy")}
                  </p>
                </div>
              </div>

              {estimate.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{estimate.notes}</p>
                </div>
              )}

              {/* Approval Tracking */}
              {estimate.sent_at && (
                <div className="pt-4 border-t border-border space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Send className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Sent on:</span>
                    <span className="font-medium">
                      {format(new Date(estimate.sent_at), "MMM dd, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                  
                  {estimate.approved_at && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-muted-foreground">
                        {estimate.customer_approved ? "Approved by customer" : "Approved internally"} on:
                      </span>
                      <span className="font-medium">
                        {format(new Date(estimate.approved_at), "MMM dd, yyyy 'at' h:mm a")}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              {isMobile ? (
                // Mobile: Card-based layout
                <div className="space-y-3">
                {estimate.line_items.map((item) => {
                    const productName = getProductName(item as any);
                    return (
                      <Card key={item.id} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex flex-col">
                            {productName && (
                              <span className="font-semibold text-sm text-foreground">
                                {productName}
                              </span>
                            )}
                            {item.description && (
                              <span className={productName ? "text-xs text-muted-foreground mt-0.5" : "font-medium text-sm"}>
                                {item.description}
                              </span>
                            )}
                            {!productName && !item.description && (
                              <span className="font-medium text-sm text-muted-foreground">
                                No description
                              </span>
                            )}
                          </div>
                          <span className="text-primary font-semibold ml-2 shrink-0">
                            {formatCurrency(item.total)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <div>
                            <span className="block text-xs mb-0.5">Qty</span>
                            <span>{item.quantity}</span>
                          </div>
                          <div>
                            <span className="block text-xs mb-0.5">Unit Price</span>
                            <span>{formatCurrency(item.unit_price)}</span>
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
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {estimate.line_items.map((item) => {
                      const productName = getProductName(item as any);
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <span className="font-medium">
                              {productName || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground">
                              {item.description || "-"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.unit_price)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.total)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground text-sm">Subtotal</span>
                <span className="font-medium">{formatCurrency(estimate.subtotal)}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground text-sm">Tax ({estimate.tax_rate}%)</span>
                <span className="font-medium">{formatCurrency(estimate.tax_amount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center gap-2">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-bold text-primary">{formatCurrency(estimate.total)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Next Steps Card - appears when estimate is approved */}
          {estimate.status === "approved" && (
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Estimate Approved!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  This estimate is ready to be converted. Choose how to proceed:
                </p>
                
                {canConvertToJobOrder && (
                  <ConvertToJobOrderDialog
                    trigger={
                      <Button 
                        className="w-full" 
                        disabled={convertToJobOrder.isPending}
                      >
                        {convertToJobOrder.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Briefcase className="mr-2 h-4 w-4" />
                        )}
                        Convert to Job Order
                      </Button>
                    }
                    customerId={estimate.customer_id}
                    estimateProjectId={estimate.project_id}
                    estimateProjectName={estimate.project_name}
                    isPending={convertToJobOrder.isPending}
                    onConvert={handleConvert}
                  />
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="secondary"
                      className="w-full" 
                      disabled={convertToInvoice.isPending}
                    >
                      {convertToInvoice.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-2 h-4 w-4" />
                      )}
                      Convert to Invoice
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Convert to Invoice</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will create a new invoice from this estimate for direct billing. Continue?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleConvertToInvoice}>Convert</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}

          {/* Workflow guidance for non-approved estimates */}
          {estimate.status !== "approved" && (
            <Card className="border-dashed">
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground text-center">
                  💡 Once approved, you can convert this estimate to a job order or invoice
                </p>
              </CardContent>
            </Card>
          )}

          {/* Version History */}
          <EstimateVersionHistory estimateId={estimateId} />

          {/* Attachments */}
          <EstimateAttachments estimateId={estimateId} />
        </div>
      </div>
    </PageLayout>
  );
}
