import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalculatorInput } from "@/components/ui/calculator-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Loader2, AlertCircle, Check, ChevronsUpDown } from "lucide-react";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import { useUpdatePurchaseOrder, PurchaseOrderWithLineItems, POLineItem } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { z } from "zod";

const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(2000),
  quantity: z.number().min(0, "Quantity cannot be negative"),
  unit_price: z.number(),
});

const purchaseOrderSchema = z.object({
  vendor_id: z.string().uuid("Please select a vendor"),
  due_date: z.string().min(1, "Due date is required"),
  notes: z.string().max(1000).optional(),
});

interface EditLineItem {
  id?: string;
  description: string;
  quantity: string;
  unit_price: string;
  total: number;
  billed_quantity: number;
}

interface PurchaseOrderEditFormProps {
  purchaseOrder: PurchaseOrderWithLineItems;
}

export const PurchaseOrderEditForm = ({ purchaseOrder }: PurchaseOrderEditFormProps) => {
  const navigate = useNavigate();
  const { data: vendors, isLoading: vendorsLoading } = useVendors();
  const updatePurchaseOrder = useUpdatePurchaseOrder();

  const [selectedVendorId, setSelectedVendorId] = useState<string>(purchaseOrder.vendor_id);
  const [dueDate, setDueDate] = useState<string>(purchaseOrder.due_date.split("T")[0]);
  const [notes, setNotes] = useState<string>(purchaseOrder.notes || "");
  const [status, setStatus] = useState<string>(purchaseOrder.status);
  const [vendorComboboxOpen, setVendorComboboxOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");

  const [lineItems, setLineItems] = useState<EditLineItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedVendor = vendors?.find(v => v.id === selectedVendorId);
  const activeVendors = vendors?.filter(v => v.status === "active") || [];

  // Initialize line items from purchase order
  useEffect(() => {
    if (purchaseOrder.line_items) {
      const items = purchaseOrder.line_items.map((item: POLineItem) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity.toString(),
        unit_price: item.unit_price.toString(),
        total: Number(item.total),
        billed_quantity: Number(item.billed_quantity || 0),
      }));
      setLineItems(items);
    }
  }, [purchaseOrder.line_items]);

  const calculateLineItemTotal = (quantity: string, unitPrice: string) => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    return qty * price;
  };

  const updateLineItem = (index: number, field: keyof EditLineItem, value: string) => {
    const newLineItems = [...lineItems];
    newLineItems[index] = { ...newLineItems[index], [field]: value };

    if (field === "quantity" || field === "unit_price") {
      newLineItems[index].total = calculateLineItemTotal(
        newLineItems[index].quantity,
        newLineItems[index].unit_price
      );
    }

    setLineItems(newLineItems);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { description: "", quantity: "1", unit_price: "", total: 0, billed_quantity: 0 },
    ]);
  };

  const removeLineItem = (index: number) => {
    const item = lineItems[index];
    // Can't remove if already billed
    if (item.billed_quantity > 0) {
      return;
    }
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const total = lineItems.reduce((sum, item) => sum + item.total, 0);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    try {
      purchaseOrderSchema.parse({
        vendor_id: selectedVendorId,
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
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          error.errors.forEach((err) => {
            newErrors[`line_${index}_${err.path[0]}`] = err.message;
          });
        }
      }

      // Validate quantity is not less than billed
      const qty = parseFloat(item.quantity) || 0;
      if (qty < item.billed_quantity) {
        newErrors[`line_${index}_quantity`] = `Cannot be less than billed quantity (${item.billed_quantity})`;
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

    const purchaseOrderData = {
      id: purchaseOrder.id,
      purchaseOrder: {
        vendor_id: selectedVendorId,
        vendor_name: selectedVendor?.name || purchaseOrder.vendor_name,
        status: status as any,
        subtotal: total,
        tax_rate: 0,
        tax_amount: 0,
        total,
        notes: notes || undefined,
        due_date: dueDate,
      },
      lineItems: lineItems.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        markup: 0,
        total: item.total,
        billed_quantity: item.billed_quantity,
      })),
    };

    await updatePurchaseOrder.mutateAsync(purchaseOrderData);
    navigate(`/purchase-orders/${purchaseOrder.id}`);
  };

  if (vendorsLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const allowedStatuses = ["draft", "sent", "acknowledged", "in-progress", "completed"];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {purchaseOrder.is_closed && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This PO is closed and cannot be edited.
          </AlertDescription>
        </Alert>
      )}

      {/* PO Info (Read-only) */}
      <Card className="glass border-border">
        <CardHeader>
          <CardTitle className="font-heading">Purchase Order Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-muted-foreground text-xs">PO Number</Label>
              <p className="font-medium">{purchaseOrder.number}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Job Order</Label>
              <p className="font-medium">{purchaseOrder.job_order_number}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Customer</Label>
              <p className="font-medium">{purchaseOrder.customer_name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Project</Label>
              <p className="font-medium">{purchaseOrder.project_name}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editable Settings */}
      <Card className="glass border-border">
        <CardHeader>
          <CardTitle className="font-heading">PO Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Searchable Vendor Combobox */}
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor *</Label>
              <Popover open={vendorComboboxOpen} onOpenChange={setVendorComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    disabled={purchaseOrder.is_closed}
                    className={cn(
                      "w-full justify-between bg-secondary border-border",
                      !selectedVendorId && "text-muted-foreground"
                    )}
                  >
                    {selectedVendor ? (
                      <div className="flex flex-col items-start text-left">
                        <span className="font-medium">{selectedVendor.name}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {selectedVendor.specialty}
                        </span>
                      </div>
                    ) : (
                      "Select vendor..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search vendors..."
                      value={vendorSearch}
                      onValueChange={setVendorSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No vendors found.</CommandEmpty>
                      <CommandGroup>
                        {activeVendors.map((vendor) => (
                          <CommandItem
                            key={vendor.id}
                            value={`${vendor.name} ${vendor.specialty || ''}`}
                            onSelect={() => {
                              setSelectedVendorId(vendor.id);
                              setVendorComboboxOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedVendorId === vendor.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span className="font-medium">{vendor.name}</span>
                              <span className="text-xs text-muted-foreground">{vendor.specialty}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {errors.vendor_id && (
                <p className="text-sm text-destructive">{errors.vendor_id}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus} disabled={purchaseOrder.is_closed}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date *</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-secondary border-border max-w-xs"
              disabled={purchaseOrder.is_closed}
            />
            {errors.due_date && (
              <p className="text-sm text-destructive">{errors.due_date}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes..."
              className="bg-secondary border-border min-h-[80px]"
              disabled={purchaseOrder.is_closed}
            />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card className="glass border-border">
        <CardHeader>
          <CardTitle className="font-heading">Line Items (Vendor Costs)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lineItems.map((item, index) => {
            const remaining = parseFloat(item.quantity) - item.billed_quantity;
            const hasBilled = item.billed_quantity > 0;

            return (
              <div
                key={index}
                className="p-4 rounded-lg bg-secondary/50 border border-border space-y-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Item {index + 1}</span>
                  <div className="flex items-center gap-2">
                    {hasBilled && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        {item.billed_quantity} billed
                      </span>
                    )}
                    {lineItems.length > 1 && !hasBilled && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLineItem(index)}
                        disabled={purchaseOrder.is_closed}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2 sm:col-span-3">
                    <Label>Description *</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => updateLineItem(index, "description", e.target.value)}
                      placeholder="Item description"
                      className="bg-secondary border-border"
                      disabled={purchaseOrder.is_closed}
                    />
                    {errors[`line_${index}_description`] && (
                      <p className="text-sm text-destructive">
                        {errors[`line_${index}_description`]}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Ordered Quantity *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                      className="bg-secondary border-border"
                      disabled={purchaseOrder.is_closed}
                    />
                    {errors[`line_${index}_quantity`] && (
                      <p className="text-sm text-destructive">
                        {errors[`line_${index}_quantity`]}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Vendor Cost *</Label>
                    <CalculatorInput
                      value={item.unit_price}
                      onValueChange={(value) => updateLineItem(index, "unit_price", value.toString())}
                      placeholder="0.00"
                      className="bg-secondary border-border"
                      disabled={purchaseOrder.is_closed}
                    />
                    {errors[`line_${index}_unit_price`] && (
                      <p className="text-sm text-destructive">
                        {errors[`line_${index}_unit_price`]}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Line Total</Label>
                    <Input
                      value={`$${item.total.toFixed(2)}`}
                      readOnly
                      className="bg-muted border-border font-medium"
                    />
                  </div>
                </div>

                {/* Billing info row */}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/50">
                  <div className="text-center">
                    <Label className="text-xs text-muted-foreground">Ordered</Label>
                    <p className="font-medium">{parseFloat(item.quantity) || 0}</p>
                  </div>
                  <div className="text-center">
                    <Label className="text-xs text-muted-foreground">Billed</Label>
                    <p className="font-medium text-success">{item.billed_quantity}</p>
                  </div>
                  <div className="text-center">
                    <Label className="text-xs text-muted-foreground">Remaining</Label>
                    <p className={`font-medium ${remaining > 0 ? "text-warning" : ""}`}>
                      {remaining.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={addLineItem}
            disabled={purchaseOrder.is_closed}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card className="glass border-border">
        <CardContent className="pt-6">
          <div className="flex justify-between font-semibold text-lg">
            <span>Total (Vendor Cost)</span>
            <span className="text-primary">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(`/purchase-orders/${purchaseOrder.id}`)}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={updatePurchaseOrder.isPending || purchaseOrder.is_closed}
        >
          {updatePurchaseOrder.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </form>
  );
};
