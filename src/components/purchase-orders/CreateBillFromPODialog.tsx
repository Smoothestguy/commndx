import { useState } from "react";
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
import { useAddVendorBill } from "@/integrations/supabase/hooks/useVendorBills";
import { PurchaseOrderWithLineItems } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { format } from "date-fns";
import { AlertTriangle, Receipt } from "lucide-react";

interface CreateBillFromPODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrderWithLineItems;
}

interface LineItemQuantity {
  id: string;
  description: string;
  originalQuantity: number;
  billedQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  quantityToBill: number;
}

export function CreateBillFromPODialog({
  open,
  onOpenChange,
  purchaseOrder,
}: CreateBillFromPODialogProps) {
  const navigate = useNavigate();
  const addVendorBill = useAddVendorBill();

  const initialLineItems: LineItemQuantity[] = purchaseOrder.line_items.map((item) => ({
    id: item.id || "",
    description: item.description,
    originalQuantity: Number(item.quantity),
    billedQuantity: Number(item.billed_quantity || 0),
    remainingQuantity: Number(item.quantity) - Number(item.billed_quantity || 0),
    unitPrice: Number(item.unit_price),
    quantityToBill: Math.max(0, Number(item.quantity) - Number(item.billed_quantity || 0)),
  }));

  const [lineItems, setLineItems] = useState<LineItemQuantity[]>(initialLineItems);
  const [billDate, setBillDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));

  const updateQuantity = (id: string, value: number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const validValue = Math.max(0, Math.min(value, item.remainingQuantity));
          return { ...item, quantityToBill: validValue };
        }
        return item;
      })
    );
  };

  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantityToBill * item.unitPrice,
    0
  );
  const taxRate = purchaseOrder.tax_rate;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const hasValidItems = lineItems.some((item) => item.quantityToBill > 0);
  const hasExceededQuantity = lineItems.some(
    (item) => item.quantityToBill > item.remainingQuantity
  );

  const handleSubmit = async () => {
    if (!hasValidItems || hasExceededQuantity) return;

    const billLineItems = lineItems
      .filter((item) => item.quantityToBill > 0)
      .map((item) => ({
        po_line_item_id: item.id,
        project_id: purchaseOrder.project_id,
        category_id: null,
        description: item.description,
        quantity: item.quantityToBill,
        unit_cost: item.unitPrice,
        total: item.quantityToBill * item.unitPrice,
      }));

    try {
      const result = await addVendorBill.mutateAsync({
        bill: {
          vendor_id: purchaseOrder.vendor_id,
          vendor_name: purchaseOrder.vendor_name,
          bill_date: billDate,
          due_date: dueDate,
          status: "open",
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total,
          notes: `Created from Purchase Order ${purchaseOrder.number}`,
          purchase_order_id: purchaseOrder.id,
          purchase_order_number: purchaseOrder.number,
        },
        lineItems: billLineItems,
      });

      onOpenChange(false);
      navigate(`/vendor-bills/${result.id}`);
    } catch (error) {
      console.error("Error creating vendor bill:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Create Vendor Bill from PO {purchaseOrder.number}
          </DialogTitle>
          <DialogDescription>
            Enter the quantities to bill. You can create partial bills by billing less than the remaining quantity.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="billDate">Bill Date</Label>
            <Input
              id="billDate"
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Description</TableHead>
                <TableHead className="text-right w-24">Ordered</TableHead>
                <TableHead className="text-right w-24">Billed</TableHead>
                <TableHead className="text-right w-24">Remaining</TableHead>
                <TableHead className="text-right w-32">Qty to Bill</TableHead>
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
                    {item.billedQuantity}
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
                      value={item.quantityToBill}
                      onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                      className="w-24 text-right"
                      disabled={item.remainingQuantity === 0}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    ${item.unitPrice.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${(item.quantityToBill * item.unitPrice).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {hasExceededQuantity && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">
              Some quantities exceed the remaining unbilled amount.
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
            disabled={!hasValidItems || hasExceededQuantity || addVendorBill.isPending}
          >
            {addVendorBill.isPending ? "Creating..." : "Create Vendor Bill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
