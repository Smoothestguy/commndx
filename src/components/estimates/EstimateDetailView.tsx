import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/integrations/supabase/hooks/useEstimates";
import { ConvertToJobOrderDialog } from "./ConvertToJobOrderDialog";
import { Edit, Trash2, Briefcase, MoreVertical, Loader2, Send, Copy, CheckCircle, FileText } from "lucide-react";
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
  const [isSending, setIsSending] = useState(false);

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
      title={estimate.number}
      description="Estimate details"
      actions={
        <div className="flex gap-2">
          {/* Primary action - always visible */}
          {estimate.status !== "approved" && (
            <Button
              onClick={handleSendToCustomer}
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
          )}

          {/* Desktop: Show all buttons */}
          {!isMobile && (
            <>
              {estimate.approval_token && (
                <Button variant="outline" onClick={handleCopyApprovalLink}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
              )}

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
                  {estimate.line_items.map((item) => (
                    <Card key={item.id} className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm">{item.description}</span>
                        <span className="text-primary font-semibold ml-2 shrink-0">
                          ${Number(item.total).toFixed(2)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                        <div>
                          <span className="block text-xs mb-0.5">Qty</span>
                          <span>{item.quantity}</span>
                        </div>
                        <div>
                          <span className="block text-xs mb-0.5">Unit Price</span>
                          <span>${Number(item.unit_price).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="block text-xs mb-0.5">Markup</span>
                          <span>{item.markup}%</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                // Desktop: Table layout
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Markup</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {estimate.line_items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          ${Number(item.unit_price).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">{item.markup}%</TableCell>
                        <TableCell className="text-right">
                          ${Number(item.total).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
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
                <span className="font-medium">${Number(estimate.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground text-sm">Tax ({estimate.tax_rate}%)</span>
                <span className="font-medium">${Number(estimate.tax_amount).toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center gap-2">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-bold text-primary">${Number(estimate.total).toFixed(2)}</span>
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
        </div>
      </div>
    </PageLayout>
  );
}
