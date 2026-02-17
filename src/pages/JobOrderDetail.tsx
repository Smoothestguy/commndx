import { useState } from "react";
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
import { ArrowLeft, Receipt, ShoppingCart, Plus, Briefcase, Pencil, MoreVertical, Trash2, TrendingDown } from "lucide-react";
import { useJobOrder, useDeleteJobOrder } from "@/integrations/supabase/hooks/useJobOrders";
import { useInvoicesByJobOrder } from "@/integrations/supabase/hooks/useInvoices";
import { usePurchaseOrders } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { useIsMobile } from "@/hooks/use-mobile";
import { CreateInvoiceFromJODialog } from "@/components/invoices/CreateInvoiceFromJODialog";
import { formatCurrency } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

const JobOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteJobOrder = useDeleteJobOrder();

  const { data: jobOrder, isLoading: loadingJobOrder, error: errorJobOrder } = useJobOrder(id || "");
  const { data: allInvoices = [], isLoading: loadingInvoices } = useInvoicesByJobOrder(id || "");
  const { data: allPOs = [], isLoading: loadingPOs } = usePurchaseOrders();
  
  const relatedPOs = allPOs.filter((po: any) => po.job_order_id === id);
  const relatedInvoices = allInvoices;

  if (loadingJobOrder || loadingInvoices || loadingPOs) {
    return (
      <PageLayout title="Loading...">
        <div>Loading job order details...</div>
      </PageLayout>
    );
  }

  if (errorJobOrder || !jobOrder) {
    return (
      <PageLayout title="Job Order Not Found">
        <Button variant="ghost" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>
      </PageLayout>
    );
  }

  const progressPercentage = (jobOrder.invoiced_amount / jobOrder.total) * 100;

  return (
    <PageLayout
      title={jobOrder.number}
      description={`${jobOrder.customer_name} - ${jobOrder.project_name}`}
      actions={
        <div className="flex gap-2">
          <Button 
            variant="glow" 
            size={isMobile ? "sm" : "default"}
            onClick={() => setInvoiceDialogOpen(true)}
          >
            <Receipt className={`h-4 w-4 ${!isMobile && "mr-2"}`} />
            {!isMobile && "Create Invoice"}
          </Button>

          {!isMobile && (
            <>
              <Button variant="outline" onClick={() => navigate(`/job-orders/${id}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
              <Button variant="outline" onClick={() => navigate(`/purchase-orders/new?jobOrderId=${id}`)}>
                <ShoppingCart className="mr-2 h-4 w-4" /> New PO
              </Button>
            </>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size={isMobile ? "sm" : "icon"}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isMobile && (
                <>
                  <DropdownMenuItem onClick={() => navigate(`/job-orders/${id}/edit`)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit Job Order
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(`/purchase-orders/new?jobOrderId=${id}`)}>
                    <ShoppingCart className="mr-2 h-4 w-4" /> New Purchase Order
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem 
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete Job Order
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <Button
        variant="ghost"
        className="mb-6"
        onClick={() => navigate(`/projects/${jobOrder.project_id}`)}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Project
      </Button>

      <div className="grid gap-4 lg:gap-6 lg:grid-cols-3">
        {/* Job Info */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Job Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={jobOrder.status} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium">{jobOrder.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Project</span>
              <span className="font-medium">{jobOrder.project_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start Date</span>
              <span>{new Date(jobOrder.start_date).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">From Estimate</span>
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => navigate(`/estimates/${jobOrder.estimate_id}`)}
              >
                View Estimate
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card className="glass border-border/50 lg:col-span-2">
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 rounded-lg bg-secondary/50">
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-heading font-bold text-primary">
                  {formatCurrency(jobOrder.total)}
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-secondary/50">
                <p className="text-sm text-muted-foreground">Invoiced</p>
                <p className="text-2xl font-heading font-bold text-success">
                  {formatCurrency(jobOrder.invoiced_amount)}
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-secondary/50">
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className="text-2xl font-heading font-bold text-warning">
                  {formatCurrency(jobOrder.remaining_amount)}
                </p>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Billing Progress</span>
                <span className="font-medium">{progressPercentage.toFixed(1)}%</span>
              </div>
              <div className="h-3 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card className="glass border-border/50 mt-6">
        <CardHeader>
          <CardTitle>Job Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          {isMobile ? (
            <div className="space-y-3">
              {jobOrder.line_items.map((item: any) => {
                const billed = Number(item.billed_quantity || 0);
                const remaining = Math.max(0, Number(item.quantity) - billed);
                const billedPct = item.quantity > 0 ? (billed / item.quantity) * 100 : 0;
                return (
                  <Card key={item.id} className="p-4 bg-secondary/30">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm">{item.description}</span>
                      <span className="text-primary font-semibold ml-2 shrink-0">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-sm text-muted-foreground mb-2">
                      <div>
                        <span className="block text-xs mb-0.5">Qty</span>
                        <span>{item.quantity}</span>
                      </div>
                      <div>
                        <span className="block text-xs mb-0.5">Margin</span>
                        <span>{item.markup ?? 0}%</span>
                      </div>
                      <div>
                        <span className="block text-xs mb-0.5">Billed</span>
                        <span className={billed > 0 ? "text-success" : ""}>{billed}</span>
                      </div>
                      <div>
                        <span className="block text-xs mb-0.5">Remaining</span>
                        <span className={remaining === 0 ? "text-muted-foreground" : "text-warning"}>{remaining}</span>
                      </div>
                    </div>
                    {billed > 0 && (
                      <Progress value={billedPct} className="h-1.5" />
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Billed</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Margin %</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-[100px]">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobOrder.line_items.map((item: any) => {
                  const billed = Number(item.billed_quantity || 0);
                  const remaining = Math.max(0, Number(item.quantity) - billed);
                  const billedPct = item.quantity > 0 ? (billed / item.quantity) * 100 : 0;
                  return (
                    <TableRow key={item.id} className="border-border/30">
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        <span className={billed > 0 ? "text-success font-medium" : "text-muted-foreground"}>{billed}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={remaining === 0 ? "text-muted-foreground" : "text-warning font-medium"}>{remaining}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.unit_price)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-muted-foreground">{item.markup ?? 0}%</span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.total)}
                      </TableCell>
                      <TableCell>
                        <Progress value={billedPct} className="h-2" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <div className="mt-4 pt-4 border-t border-border/30 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(jobOrder.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax ({jobOrder.tax_rate}%)</span>
              <span>{formatCurrency(jobOrder.tax_amount)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-border/30">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(jobOrder.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vendor Billing Summary */}
      {(() => {
        const totalBilled = jobOrder.line_items.reduce((sum: number, item: any) => 
          sum + (Number(item.billed_quantity || 0) * Number(item.unit_price)), 0);
        const vendorBillingPct = jobOrder.subtotal > 0 ? (totalBilled / jobOrder.subtotal) * 100 : 0;
        return (
          <Card className="glass border-border/50 mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-primary" />
                Vendor Billing Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="text-center p-4 rounded-lg bg-secondary/50">
                  <p className="text-sm text-muted-foreground">JO Subtotal</p>
                  <p className="text-2xl font-heading font-bold">{formatCurrency(jobOrder.subtotal)}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-secondary/50">
                  <p className="text-sm text-muted-foreground">Vendor Billed</p>
                  <p className="text-2xl font-heading font-bold text-success">{formatCurrency(totalBilled)}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-secondary/50">
                  <p className="text-sm text-muted-foreground">Remaining to Bill</p>
                  <p className="text-2xl font-heading font-bold text-warning">{formatCurrency(jobOrder.subtotal - totalBilled)}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Vendor Billing Progress</span>
                  <span className="font-medium">{vendorBillingPct.toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(vendorBillingPct, 100)} className="h-3" />
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Related Purchase Orders */}
      <Card className="glass border-border/50 mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Purchase Orders ({relatedPOs.length})
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate("/purchase-orders/new")}>
            <Plus className="h-4 w-4 mr-1" />
            Add PO
          </Button>
        </CardHeader>
        <CardContent>
          {relatedPOs.length > 0 ? (
            isMobile ? (
              <div className="space-y-3">
                {relatedPOs.map((po: any) => (
                  <Card 
                    key={po.id} 
                    className="p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                    onClick={() => navigate(`/purchase-orders/${po.id}`)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-medium">{po.number}</span>
                        <p className="text-sm text-muted-foreground">{po.vendor_name}</p>
                      </div>
                      <StatusBadge status={po.status} />
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">
                        Due: {new Date(po.due_date).toLocaleDateString()}
                      </span>
                      <span className="text-primary font-semibold">
                        {formatCurrency(po.total)}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead>PO #</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relatedPOs.map((po: any) => (
                    <TableRow 
                      key={po.id} 
                      className="border-border/30 cursor-pointer hover:bg-secondary/50"
                      onClick={() => navigate(`/purchase-orders/${po.id}`)}
                    >
                      <TableCell className="font-medium">{po.number}</TableCell>
                      <TableCell>{po.vendor_name}</TableCell>
                      <TableCell><StatusBadge status={po.status} /></TableCell>
                      <TableCell className="text-right text-primary font-medium">
                        {formatCurrency(po.total)}
                      </TableCell>
                      <TableCell>{new Date(po.due_date).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          ) : (
            <p className="text-muted-foreground text-center py-4">No purchase orders yet</p>
          )}
        </CardContent>
      </Card>

      {/* Related Invoices */}
      <Card className="glass border-border/50 mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Invoices ({relatedInvoices.length})
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate("/invoices/new")}>
            <Plus className="h-4 w-4 mr-1" />
            Add Invoice
          </Button>
        </CardHeader>
        <CardContent>
          {relatedInvoices.length > 0 ? (
            isMobile ? (
              <div className="space-y-3">
                {relatedInvoices.map((inv: any) => (
                  <Card 
                    key={inv.id} 
                    className="p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-medium">{inv.number}</span>
                        {inv.paid_date && (
                          <p className="text-xs text-muted-foreground">
                            Paid: {new Date(inv.paid_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={inv.status} />
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">
                        Due: {new Date(inv.due_date).toLocaleDateString()}
                      </span>
                      <span className="text-primary font-semibold">
                        {formatCurrency(inv.total)}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Paid Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relatedInvoices.map((inv: any) => (
                    <TableRow 
                      key={inv.id} 
                      className="border-border/30 cursor-pointer hover:bg-secondary/50"
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                    >
                      <TableCell className="font-medium">{inv.number}</TableCell>
                      <TableCell><StatusBadge status={inv.status} /></TableCell>
                      <TableCell className="text-right text-primary font-medium">
                        {formatCurrency(inv.total)}
                      </TableCell>
                      <TableCell>{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                      <TableCell>{inv.paid_date ? new Date(inv.paid_date).toLocaleDateString() : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          ) : (
            <p className="text-muted-foreground text-center py-4">No invoices yet</p>
          )}
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <CreateInvoiceFromJODialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        jobOrder={jobOrder}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{jobOrder.number}</strong>?
              {(relatedInvoices.length > 0 || relatedPOs.length > 0) && (
                <span className="block mt-2 text-destructive">
                  Warning: This job order has {relatedInvoices.length} invoice(s) and {relatedPOs.length} purchase order(s) linked to it. Deleting may affect these records.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteJobOrder.isPending}
              onClick={async () => {
                await deleteJobOrder.mutateAsync(id!);
                navigate(`/projects/${jobOrder.project_id}`);
              }}
            >
              {deleteJobOrder.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
};

export default JobOrderDetail;
