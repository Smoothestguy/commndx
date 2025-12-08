import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Loader2, AlertCircle, Info } from "lucide-react";
import { useJobOrders, useJobOrder } from "@/integrations/supabase/hooks/useJobOrders";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import { useAddPurchaseOrder } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";

const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(500),
  quantity: z.number().positive("Quantity must be positive"),
  unit_price: z.number().positive("Unit price must be positive"),
  margin: z.number().min(0, "Margin cannot be negative").max(99.99, "Margin must be less than 100%"),
});

const purchaseOrderSchema = z.object({
  job_order_id: z.string().uuid("Please select a job order"),
  vendor_id: z.string().uuid("Please select a vendor"),
  tax_rate: z.number().min(0).max(100),
  due_date: z.string().min(1, "Due date is required"),
  notes: z.string().max(1000).optional(),
});

interface LineItem {
  description: string;
  quantity: string;
  unit_price: string;
  margin: string;
  total: number;
}

export const PurchaseOrderForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobOrderIdFromUrl = searchParams.get("jobOrderId");
  
  const { user } = useAuth();
  const { data: jobOrders, isLoading: jobOrdersLoading } = useJobOrders();
  const { data: vendors, isLoading: vendorsLoading } = useVendors();
  const { data: prefillJobOrder, isLoading: prefillLoading } = useJobOrder(jobOrderIdFromUrl || "");
  const addPurchaseOrder = useAddPurchaseOrder();

  const [selectedJobOrderId, setSelectedJobOrderId] = useState<string>("");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [taxRate, setTaxRate] = useState<string>("8.5");
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isPrefilled, setIsPrefilled] = useState(false);

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: "1", unit_price: "", margin: "0", total: 0 },
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get selected job order details
  const selectedJobOrder = jobOrders?.find(jo => jo.id === selectedJobOrderId);
  const selectedVendor = vendors?.find(v => v.id === selectedVendorId);

  // Generate PO number
  const generatePONumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `PO-${year}-${random}`;
  };

  const calculateLineItemTotal = (quantity: string, unitPrice: string, margin: string) => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    const mgn = parseFloat(margin) || 0;
    // Margin-based pricing: total = qty * price / (1 - margin/100)
    return mgn > 0 && mgn < 100 ? qty * price / (1 - mgn / 100) : qty * price;
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    const newLineItems = [...lineItems];
    newLineItems[index] = { ...newLineItems[index], [field]: value };

    // Recalculate total for this line item
    if (field === "quantity" || field === "unit_price" || field === "margin") {
      newLineItems[index].total = calculateLineItemTotal(
        newLineItems[index].quantity,
        newLineItems[index].unit_price,
        newLineItems[index].margin
      );
    }

    setLineItems(newLineItems);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { description: "", quantity: "1", unit_price: "", margin: "0", total: 0 },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * (parseFloat(taxRate) || 0) / 100;
  const total = subtotal + taxAmount;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    try {
      purchaseOrderSchema.parse({
        job_order_id: selectedJobOrderId,
        vendor_id: selectedVendorId,
        tax_rate: parseFloat(taxRate),
        due_date: dueDate,
        notes,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          newErrors[err.path[0]] = err.message;
        });
      }
    }

    lineItems.forEach((item, index) => {
      try {
        lineItemSchema.parse({
          description: item.description,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price),
          margin: parseFloat(item.margin),
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          error.errors.forEach((err) => {
            newErrors[`line_${index}_${err.path[0]}`] = err.message;
          });
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!selectedJobOrder || !selectedVendor) return;

    const purchaseOrderData = {
      purchaseOrder: {
        number: generatePONumber(),
        job_order_id: selectedJobOrderId,
        job_order_number: selectedJobOrder.number,
        vendor_id: selectedVendorId,
        vendor_name: selectedVendor.name,
        project_id: selectedJobOrder.project_id,
        project_name: selectedJobOrder.project_name,
        customer_id: selectedJobOrder.customer_id,
        customer_name: selectedJobOrder.customer_name,
        status: 'pending_approval' as const, // All new POs need approval
        submitted_by: user?.id,
        submitted_for_approval_at: new Date().toISOString(),
        subtotal,
        tax_rate: parseFloat(taxRate),
        tax_amount: taxAmount,
        total,
        notes: notes || undefined,
        due_date: dueDate,
      },
      lineItems: lineItems.map((item) => ({
        description: item.description,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        markup: parseFloat(item.margin), // DB column is still "markup"
        total: item.total,
      })),
    };

    await addPurchaseOrder.mutateAsync(purchaseOrderData);
    navigate("/purchase-orders");
  };

  // Set default due date (30 days from now)
  useEffect(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    setDueDate(date.toISOString().split("T")[0]);
  }, []);

  // Auto-populate from job order when navigating from job order detail
  useEffect(() => {
    if (prefillJobOrder && jobOrderIdFromUrl && !isPrefilled) {
      // Set job order selection
      setSelectedJobOrderId(prefillJobOrder.id);
      
      // Set tax rate from job order
      setTaxRate(prefillJobOrder.tax_rate.toString());
      
      // Map job order line items to purchase order line items
      if (prefillJobOrder.line_items && prefillJobOrder.line_items.length > 0) {
        const mappedLineItems: LineItem[] = prefillJobOrder.line_items.map((item) => {
          const total = calculateLineItemTotal(
            item.quantity.toString(),
            item.unit_price.toString(),
            (item.markup || 0).toString()
          );
          return {
            description: item.description,
            quantity: item.quantity.toString(),
            unit_price: item.unit_price.toString(),
            margin: (item.markup || 0).toString(),
            total,
          };
        });
        setLineItems(mappedLineItems);
      }
      
      setIsPrefilled(true);
    }
  }, [prefillJobOrder, jobOrderIdFromUrl, isPrefilled]);

  if (jobOrdersLoading || vendorsLoading || (jobOrderIdFromUrl && prefillLoading)) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Info Alert about Prefill */}
      {isPrefilled && prefillJobOrder && (
        <Alert className="border-primary/50 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription>
            This purchase order is linked to Job Order <strong>{prefillJobOrder.number}</strong>. 
            Line items have been pre-filled from the job order. You can edit them as needed.
          </AlertDescription>
        </Alert>
      )}

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Purchase orders require manager approval before they can be sent to vendors.
        </AlertDescription>
      </Alert>

      {/* Job Order & Vendor Selection */}
      <Card className="glass border-border">
        <CardHeader>
          <CardTitle className="font-heading">Job Order & Vendor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="jobOrder">Job Order *</Label>
              <Select value={selectedJobOrderId} onValueChange={setSelectedJobOrderId}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select job order" />
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)]">
                  {jobOrders?.map((jobOrder) => (
                    <SelectItem key={jobOrder.id} value={jobOrder.id} className="py-2">
                      <div className="flex flex-col gap-0.5">
                        <div className="font-medium">{jobOrder.number}</div>
                        <div className="text-xs text-muted-foreground">
                          {jobOrder.customer_name} • {jobOrder.project_name}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.job_order_id && (
                <p className="text-sm text-destructive">{errors.job_order_id}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor *</Label>
              <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)]">
                  {vendors?.filter(v => v.status === "active").map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id} className="py-2">
                      <div className="flex flex-col gap-0.5">
                        <div className="font-medium">{vendor.name}</div>
                        <div className="text-xs text-muted-foreground">{vendor.specialty}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.vendor_id && (
                <p className="text-sm text-destructive">{errors.vendor_id}</p>
              )}
            </div>
          </div>

          {/* Display Job Order Info */}
          {selectedJobOrder && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <h4 className="font-semibold text-sm mb-2">Job Order Details</h4>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">{selectedJobOrder.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Project:</span>
                  <span className="font-medium">{selectedJobOrder.project_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Value:</span>
                  <span className="font-medium text-primary">
                    ${selectedJobOrder.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="bg-secondary border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-secondary border-border"
              />
              {errors.due_date && (
                <p className="text-sm text-destructive">{errors.due_date}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card className="glass border-border">
        <CardHeader>
          <CardTitle className="font-heading">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lineItems.map((item, index) => (
            <div
              key={index}
              className="p-4 rounded-lg bg-secondary/50 border border-border space-y-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Item {index + 1}</span>
                {lineItems.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLineItem(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Description *</Label>
                  <Input
                    value={item.description}
                    onChange={(e) => updateLineItem(index, "description", e.target.value)}
                    placeholder="Item description (e.g., Subcontracted electrical work)"
                    className="bg-secondary border-border"
                  />
                  {errors[`line_${index}_description`] && (
                    <p className="text-sm text-destructive">
                      {errors[`line_${index}_description`]}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Unit Price *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(index, "unit_price", e.target.value)}
                      className="bg-secondary border-border pl-7"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Margin (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    max="99.99"
                    value={item.margin}
                    onChange={(e) => updateLineItem(index, "margin", e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Total</Label>
                  <Input
                    value={`$${item.total.toFixed(2)}`}
                    readOnly
                    className="bg-muted border-border font-semibold"
                  />
                </div>
              </div>
            </div>
          ))}
          
          <Button type="button" variant="outline" className="w-full" onClick={addLineItem}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="glass border-border">
        <CardHeader>
          <CardTitle className="font-heading">Additional Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add delivery instructions, special requirements, or other notes..."
              className="bg-secondary border-border min-h-[100px]"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">{notes.length}/1000 characters</p>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card className="glass border-border">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Tax ({taxRate}%):
              </span>
              <span className="font-medium">${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-heading border-t border-border pt-2">
              <span className="font-bold">Total:</span>
              <span className="font-bold text-primary">${total.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/purchase-orders")}
          disabled={addPurchaseOrder.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" variant="glow" disabled={addPurchaseOrder.isPending}>
          {addPurchaseOrder.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Purchase Order
        </Button>
      </div>
    </form>
  );
};
