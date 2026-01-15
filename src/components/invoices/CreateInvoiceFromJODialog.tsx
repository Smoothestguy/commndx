import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAddInvoice } from "@/integrations/supabase/hooks/useInvoices";
import { JobOrderWithLineItems } from "@/integrations/supabase/hooks/useJobOrders";
import { format } from "date-fns";
import { AlertTriangle, Receipt } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card } from "@/components/ui/card";
import { getNextInvoiceNumber } from "@/utils/invoiceNumberGenerator";
import { toast } from "sonner";

interface CreateInvoiceFromJODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobOrder: JobOrderWithLineItems;
}

interface LineItemQuantity {
  id: string;
  productId?: string;
  productName?: string;
  description: string;
  originalQuantity: number;
  invoicedQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  markup: number;
  quantityToInvoice: number;
  isTaxable: boolean;
}

export function CreateInvoiceFromJODialog({
  open,
  onOpenChange,
  jobOrder,
}: CreateInvoiceFromJODialogProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const addInvoice = useAddInvoice();

  const initialLineItems: LineItemQuantity[] = jobOrder.line_items.map((item) => ({
    id: item.id || "",
    productId: item.product_id || undefined,
    productName: item.product_name || undefined,
    description: item.description,
    originalQuantity: Number(item.quantity),
    invoicedQuantity: Number(item.invoiced_quantity || 0),
    remainingQuantity: Number(item.quantity) - Number(item.invoiced_quantity || 0),
    unitPrice: Number(item.unit_price),
    markup: Number(item.markup || 0),
    quantityToInvoice: Math.max(0, Number(item.quantity) - Number(item.invoiced_quantity || 0)),
    isTaxable: item.is_taxable ?? true,
  }));

  const [lineItems, setLineItems] = useState<LineItemQuantity[]>(initialLineItems);
  const [dueDate, setDueDate] = useState(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [isLoadingNumber, setIsLoadingNumber] = useState(false);

  // Fetch the next invoice number for preview
  useEffect(() => {
    if (!open) return;

    const fetchInvoiceNumber = async () => {
      setIsLoadingNumber(true);
      try {
        const result = await getNextInvoiceNumber();
        setInvoiceNumber(result.number);
      } catch (error) {
        console.error('Error fetching invoice number:', error);
        toast.error('Failed to generate invoice number');
      } finally {
        setIsLoadingNumber(false);
      }
    };

    fetchInvoiceNumber();
  }, [open]);

  const updateQuantity = (id: string, value: number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const validValue = Math.max(0, Math.min(value, item.remainingQuantity));
          return { ...item, quantityToInvoice: validValue };
        }
        return item;
      })
    );
  };

  const calculateLineTotal = (item: LineItemQuantity) => {
    const baseTotal = item.quantityToInvoice * item.unitPrice;
    return item.markup > 0 && item.markup < 100
      ? baseTotal / (1 - item.markup / 100)
      : baseTotal;
  };

  const computedSubtotal = lineItems.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  const taxRate = jobOrder.tax_rate;

  // Detect if this is a "full remaining invoice" - invoicing all remaining quantities
  // and this is the first invoice for this job order
  const isFullRemainingInvoice = 
    jobOrder.invoiced_amount === 0 && 
    lineItems.every((item) => item.quantityToInvoice === item.remainingQuantity && item.remainingQuantity > 0);

  // Use stored Job Order tax/totals for full invoice to avoid recalculation discrepancies
  // Otherwise, calculate tax only on taxable items
  let subtotal: number;
  let taxAmount: number;
  let total: number;

  if (isFullRemainingInvoice) {
    // Use exact Job Order values to maintain consistency
    subtotal = jobOrder.subtotal;
    taxAmount = jobOrder.tax_amount;
    total = jobOrder.total;
  } else {
    // For partial invoices, calculate based on selected quantities
    subtotal = computedSubtotal;
    const taxableSubtotal = lineItems
      .filter((item) => item.isTaxable)
      .reduce((sum, item) => sum + calculateLineTotal(item), 0);
    taxAmount = Math.round(taxableSubtotal * (taxRate / 100) * 100) / 100;
    total = Math.round((subtotal + taxAmount) * 100) / 100;
  }

  const hasValidItems = lineItems.some((item) => item.quantityToInvoice > 0);
  const hasExceededQuantity = lineItems.some(
    (item) => item.quantityToInvoice > item.remainingQuantity
  );
  // For full invoice, total should match exactly; for partial, allow small rounding tolerance
  const exceedsBalance = isFullRemainingInvoice 
    ? false 
    : total > jobOrder.remaining_amount + 0.01;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!hasValidItems || hasExceededQuantity || exceedsBalance) return;

    setIsSubmitting(true);
    
    try {
      // Re-fetch a fresh invoice number at submit time to avoid stale numbers
      const freshNumberResult = await getNextInvoiceNumber();
      const freshInvoiceNumber = freshNumberResult.number;

      const invoiceLineItems = lineItems
        .filter((item) => item.quantityToInvoice > 0)
        .map((item) => ({
          jo_line_item_id: item.id,
          product_id: item.productId || null,
          product_name: item.productName || null,
          description: item.description,
          quantity: item.quantityToInvoice,
          unit_price: item.unitPrice,
          markup: item.markup,
          total: calculateLineTotal(item),
        })) as any[];

      const result = await addInvoice.mutateAsync({
        number: freshInvoiceNumber,
        job_order_id: jobOrder.id,
        job_order_number: jobOrder.number,
        customer_id: jobOrder.customer_id,
        customer_name: jobOrder.customer_name,
        project_name: jobOrder.project_name,
        status: "draft",
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        due_date: dueDate,
        line_items: invoiceLineItems,
      });

      onOpenChange(false);
      navigate(`/invoices/${result.id}`);
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast.error("Failed to create invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Create Invoice from {jobOrder.number}
          </DialogTitle>
          <DialogDescription>
            Select the quantities to invoice. You can create partial invoices by invoicing less than the remaining quantity.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </div>

        {isMobile ? (
          <div className="space-y-3">
            {lineItems.map((item) => (
              <Card key={item.id} className="p-4 space-y-3">
                <div className="font-medium text-sm">{item.description}</div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs block">Ordered</span>
                    <span>{item.originalQuantity}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Invoiced</span>
                    <span>{item.invoicedQuantity}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Remaining</span>
                    <span className={item.remainingQuantity === 0 ? "text-muted-foreground" : "text-primary font-medium"}>
                      {item.remainingQuantity}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-xs">Qty to Invoice</Label>
                    <Input
                      type="number"
                      min={0}
                      max={item.remainingQuantity}
                      step="any"
                      value={item.quantityToInvoice}
                      onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                      className="w-24"
                      disabled={item.remainingQuantity === 0}
                    />
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block">Line Total</span>
                    <span className="font-medium">${calculateLineTotal(item).toFixed(2)}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right w-24">Ordered</TableHead>
                  <TableHead className="text-right w-24">Invoiced</TableHead>
                  <TableHead className="text-right w-24">Remaining</TableHead>
                  <TableHead className="text-right w-32">Qty to Invoice</TableHead>
                  <TableHead className="text-right w-28">Unit Price</TableHead>
                  <TableHead className="text-right w-28">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.description}</TableCell>
                    <TableCell className="text-right">{item.originalQuantity}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.invoicedQuantity}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={item.remainingQuantity === 0 ? "text-muted-foreground" : "text-primary font-medium"}>
                        {item.remainingQuantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        max={item.remainingQuantity}
                        step="any"
                        value={item.quantityToInvoice}
                        onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                        className="w-24 text-right"
                        disabled={item.remainingQuantity === 0}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      ${item.unitPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${calculateLineTotal(item).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {hasExceededQuantity && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">
              Some quantities exceed the remaining uninvoiced amount.
            </span>
          </div>
        )}

        {exceedsBalance && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">
              Invoice total (${total.toFixed(2)}) exceeds remaining job order balance (${jobOrder.remaining_amount.toFixed(2)})
            </span>
          </div>
        )}

        <div className="space-y-2 pt-4 border-t">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax ({taxRate}%)</span>
            <span>${taxAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>Total</span>
            <span className="text-primary">${total.toFixed(2)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasValidItems || hasExceededQuantity || exceedsBalance || addInvoice.isPending || isLoadingNumber || !invoiceNumber || isSubmitting}
          >
            {isLoadingNumber ? "Loading..." : isSubmitting ? "Creating..." : "Create Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
