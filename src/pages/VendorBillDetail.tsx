import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Edit, Trash2, DollarSign, Calendar, Building2, FileText, ChevronDown } from "lucide-react";
import { formatLocalDate } from "@/lib/dateUtils";
import { useState } from "react";
import { useVendorBill, useDeleteVendorBill } from "@/integrations/supabase/hooks/useVendorBills";
import { usePersonnelForVendor } from "@/integrations/supabase/hooks/useVendorPersonnelData";
import { VendorBillPaymentDialog } from "@/components/vendor-bills/VendorBillPaymentDialog";
import { VendorBillPaymentHistory } from "@/components/vendor-bills/VendorBillPaymentHistory";
import { VendorBillAttachments } from "@/components/vendor-bills/VendorBillAttachments";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function VendorBillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const { data: bill, isLoading } = useVendorBill(id);
  const deleteBill = useDeleteVendorBill();
  const { data: linkedPersonnel } = usePersonnelForVendor(bill?.vendor_id);

  const handleDelete = () => {
    if (id) {
      deleteBill.mutate(id, {
        onSuccess: () => navigate("/vendor-bills" + window.location.search),
      });
    }
    setDeleteOpen(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "secondary";
      case "pending": return "default";
      case "partial": return "outline";
      case "paid": return "default";
      case "overdue": return "destructive";
      default: return "secondary";
    }
  };

  if (isLoading) {
    return (
      <PageLayout title="Vendor Bill" description="Loading...">
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </PageLayout>
    );
  }

  if (!bill) {
    return (
      <PageLayout title="Vendor Bill" description="Not found">
        <div className="text-center py-8 text-muted-foreground">Bill not found</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={`Bill ${bill.number}`} description={bill.vendor_name}>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <Button variant="ghost" onClick={() => navigate("/vendor-bills" + window.location.search)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Bills
          </Button>
          <div className="flex gap-2 flex-wrap">
            {linkedPersonnel && linkedPersonnel.length > 0 && (
              linkedPersonnel.length === 1 ? (
                <Button 
                  variant="outline" 
                  onClick={() => navigate(`/personnel/${linkedPersonnel[0].id}?tab=documents`)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Personnel Docs
                </Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <FileText className="h-4 w-4 mr-2" />
                      Personnel Docs
                      <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {linkedPersonnel.map((person) => (
                      <DropdownMenuItem 
                        key={person.id}
                        onClick={() => navigate(`/personnel/${person.id}?tab=documents`)}
                      >
                        {person.first_name} {person.last_name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            )}
            {bill.status !== "paid" && (
              <Button onClick={() => setPaymentOpen(true)}>
                <DollarSign className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate(`/vendor-bills/${id}/edit${window.location.search}`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Bill Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Bill Details
              </CardTitle>
              <Badge variant={getStatusColor(bill.status)}>
                {bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Vendor</p>
                <p className="font-medium">{bill.vendor_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bill Date</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatLocalDate(bill.bill_date, "MMM dd, yyyy")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatLocalDate(bill.due_date, "MMM dd, yyyy")}
                </p>
              </div>
            </div>
            {bill.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="text-sm">{bill.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
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
                {bill.line_items?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">${Number(item.unit_cost).toFixed(2)}</TableCell>
                    <TableCell className="text-right">${Number(item.total).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Separator className="my-4" />
            <div className="space-y-2 text-right">
              <div className="flex justify-end gap-8">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">${Number(bill.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-end gap-8">
                <span className="text-muted-foreground">Tax ({bill.tax_rate}%):</span>
                <span className="font-medium">${Number(bill.tax_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-end gap-8 text-lg">
                <span className="font-semibold">Total:</span>
                <span className="font-bold">${((r) => r === 0 ? 0 : r)(Math.round(Number(bill.total) * 100) / 100).toFixed(2)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-end gap-8">
                <span className="text-muted-foreground">Amount Paid:</span>
                <span className="font-medium text-green-600">${((r) => r === 0 ? 0 : r)(Math.round(Number(bill.paid_amount) * 100) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-end gap-8 text-lg">
                <span className="font-semibold">Remaining:</span>
                <span className="font-bold text-primary">${((r) => r === 0 ? 0 : r)(Math.round(Number(bill.remaining_amount) * 100) / 100).toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment History */}
        {bill.payments && bill.payments.length > 0 && (
          <VendorBillPaymentHistory billId={bill.id} payments={bill.payments} />
        )}

        {/* Attachments */}
        <VendorBillAttachments billId={bill.id} isEditMode={false} />
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bill</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Are you sure you want to delete bill {bill.number}? This action cannot be undone.</p>
                
                {bill.line_items?.some(item => item.po_line_item_id) && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      This bill is linked to a purchase order. Deleting it will:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Revert billed quantities on the linked PO line items</li>
                        <li>Update the purchase order status accordingly</li>
                        <li>Allow those items to be billed again</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Dialog */}
      <VendorBillPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        billId={bill.id}
        remainingAmount={Number(bill.remaining_amount)}
      />
    </PageLayout>
  );
}
