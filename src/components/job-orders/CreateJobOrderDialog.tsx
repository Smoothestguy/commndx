import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Trash2, Plus, Check, ChevronsUpDown, Package, Wrench, HardHat } from "lucide-react";
import { useAddJobOrder } from "@/integrations/supabase/hooks/useJobOrders";
import { useProducts } from "@/integrations/supabase/hooks/useProducts";
import { cn } from "@/lib/utils";

interface LineItem {
  id: string;
  product_id?: string;
  description: string;
  quantity: string;
  unit_price: string;
  markup: string;
  total: number;
}

interface CreateJobOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  customerId: string;
  customerName: string;
}

export function CreateJobOrderDialog({
  isOpen,
  onClose,
  projectId,
  projectName,
  customerId,
  customerName,
}: CreateJobOrderDialogProps) {
  const addJobOrder = useAddJobOrder();
  const { data: products } = useProducts();
  
  const [status, setStatus] = useState<"active" | "in-progress" | "completed" | "on-hold">("active");
  const [taxRate, setTaxRate] = useState(8.25);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [completionDate, setCompletionDate] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: "1", unit_price: "0", markup: "30", total: 0 },
  ]);
  const [productComboboxOpen, setProductComboboxOpen] = useState<Record<string, boolean>>({});
  const [productSearch, setProductSearch] = useState<Record<string, string>>({});

  // Group products by type
  const getProductsByType = (type: 'product' | 'service' | 'labor') => {
    return products?.filter((p) => p.item_type === type) || [];
  };

  const calculateLineItemTotal = (quantity: string, unitPrice: string, markup: string): number => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    const mrk = parseFloat(markup) || 0;
    const markedUpPrice = mrk > 0 && mrk < 100 ? price / (1 - mrk / 100) : price;
    return qty * markedUpPrice;
  };

  const updateLineItem = (id: string, field: keyof Omit<LineItem, 'id'>, value: string) => {
    const updated = lineItems.map(item => {
      if (item.id !== id) return item;
      const newItem = { ...item, [field]: value };
      
      if (field === "quantity" || field === "unit_price" || field === "markup") {
        newItem.total = calculateLineItemTotal(
          field === "quantity" ? value : newItem.quantity,
          field === "unit_price" ? value : newItem.unit_price,
          field === "markup" ? value : newItem.markup
        );
      }
      
      return newItem;
    });
    setLineItems(updated);
  };

  const selectProduct = (lineItemId: string, productId: string) => {
    const product = products?.find((p) => p.id === productId);
    if (product) {
      setLineItems(items => items.map(item => {
        if (item.id !== lineItemId) return item;
        const unitPrice = product.cost.toString();
        const markup = product.markup.toString();
        return {
          ...item,
          product_id: productId,
          description: product.description || product.name,
          unit_price: unitPrice,
          markup: markup,
          total: calculateLineItemTotal(item.quantity, unitPrice, markup),
        };
      }));
    }
    setProductComboboxOpen(prev => ({ ...prev, [lineItemId]: false }));
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { id: crypto.randomUUID(), description: "", quantity: "1", unit_price: "0", markup: "30", total: 0 }]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validLineItems = lineItems.filter(item => item.description.trim() !== "");
    if (validLineItems.length === 0) return;

    await addJobOrder.mutateAsync({
      jobOrder: {
        number: "",
        estimate_id: null,
        customer_id: customerId,
        customer_name: customerName,
        project_id: projectId,
        project_name: projectName,
        status,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        invoiced_amount: 0,
        remaining_amount: total,
        start_date: startDate,
        completion_date: completionDate || undefined,
      },
      lineItems: validLineItems.map(item => {
        const product = products?.find(p => p.id === item.product_id);
        return {
          description: item.description,
          quantity: parseFloat(item.quantity) || 0,
          unit_price: parseFloat(item.unit_price) || 0,
          markup: parseFloat(item.markup) || 0,
          total: item.total,
          product_id: item.product_id,
          product_name: product?.name,
        };
      }),
    });

    onClose();
    resetForm();
  };

  const resetForm = () => {
    setStatus("active");
    setTaxRate(8.25);
    setStartDate(new Date().toISOString().split("T")[0]);
    setCompletionDate("");
    setLineItems([{ id: crypto.randomUUID(), description: "", quantity: "1", unit_price: "0", markup: "30", total: 0 }]);
    setProductComboboxOpen({});
    setProductSearch({});
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle className="font-heading">Create Job Order</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <form id="create-jo-form" onSubmit={handleSubmit} className="space-y-6 pb-6">
            {/* Project & Customer Info (Read-only) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Project</Label>
                <div className="p-3 bg-muted/50 rounded-md text-sm">{projectName}</div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Customer</Label>
                <div className="p-3 bg-muted/50 rounded-md text-sm">{customerName}</div>
              </div>
            </div>

            {/* Status & Dates */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Completion Date</Label>
                <Input
                  type="date"
                  value={completionDate}
                  onChange={(e) => setCompletionDate(e.target.value)}
                />
              </div>
            </div>

            {/* Tax Rate */}
            <div className="w-32 space-y-2">
              <Label>Tax Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
              />
            </div>

            {/* Line Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Line Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {lineItems.map((item) => (
                  <div key={item.id} className="p-4 bg-muted/30 rounded-lg space-y-3">
                    {/* Product Selector */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Product (Optional)</Label>
                      <Popover
                        open={productComboboxOpen[item.id] || false}
                        onOpenChange={(open) => setProductComboboxOpen(prev => ({ ...prev, [item.id]: open }))}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between",
                              !item.product_id && "text-muted-foreground"
                            )}
                          >
                            {item.product_id
                              ? products?.find(p => p.id === item.product_id)?.name
                              : "Select product..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput
                              placeholder="Search products..."
                              value={productSearch[item.id] || ""}
                              onValueChange={(value) => setProductSearch(prev => ({ ...prev, [item.id]: value }))}
                            />
                            <CommandList>
                              <CommandEmpty>No products found.</CommandEmpty>
                              
                              {/* Products Group */}
                              {getProductsByType('product').length > 0 && (
                                <CommandGroup heading={<span className="flex items-center gap-1"><Package className="h-3 w-3" /> Products</span>}>
                                  {getProductsByType('product').map((product) => (
                                    <CommandItem
                                      key={product.id}
                                      value={`${product.name} ${product.sku || ''} ${product.category || ''}`}
                                      onSelect={() => selectProduct(item.id, product.id)}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", item.product_id === product.id ? "opacity-100" : "opacity-0")} />
                                      <div className="flex flex-col">
                                        <span>{product.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          ${product.cost?.toFixed(2)} • {product.category || 'Uncategorized'}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}

                              {/* Services Group */}
                              {getProductsByType('service').length > 0 && (
                                <CommandGroup heading={<span className="flex items-center gap-1"><Wrench className="h-3 w-3" /> Services</span>}>
                                  {getProductsByType('service').map((product) => (
                                    <CommandItem
                                      key={product.id}
                                      value={`${product.name} ${product.sku || ''} ${product.category || ''}`}
                                      onSelect={() => selectProduct(item.id, product.id)}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", item.product_id === product.id ? "opacity-100" : "opacity-0")} />
                                      <div className="flex flex-col">
                                        <span>{product.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          ${product.cost?.toFixed(2)} • {product.category || 'Uncategorized'}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}

                              {/* Labor Group */}
                              {getProductsByType('labor').length > 0 && (
                                <CommandGroup heading={<span className="flex items-center gap-1"><HardHat className="h-3 w-3" /> Labor</span>}>
                                  {getProductsByType('labor').map((product) => (
                                    <CommandItem
                                      key={product.id}
                                      value={`${product.name} ${product.sku || ''} ${product.category || ''}`}
                                      onSelect={() => selectProduct(item.id, product.id)}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", item.product_id === product.id ? "opacity-100" : "opacity-0")} />
                                      <div className="flex flex-col">
                                        <span>{product.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          ${product.cost?.toFixed(2)}/hr
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Description and other fields */}
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4 space-y-1">
                        <Label className="text-xs text-muted-foreground">Description</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                          placeholder="Description"
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs text-muted-foreground">Qty</Label>
                        <Input
                          type="number"
                          step="any"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, "quantity", e.target.value)}
                          min="0"
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs text-muted-foreground">Unit Price</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) => updateLineItem(item.id, "unit_price", e.target.value)}
                            className="pl-7"
                          />
                        </div>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs text-muted-foreground">Margin %</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="99"
                          value={item.markup}
                          onChange={(e) => updateLineItem(item.id, "markup", e.target.value)}
                        />
                      </div>
                      <div className="col-span-1 space-y-1">
                        <Label className="text-xs text-muted-foreground">Total</Label>
                        <div className="p-2 text-sm font-medium">${item.total.toFixed(2)}</div>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(item.id)}
                          disabled={lineItems.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
              ))}
                
                {/* Add Item button at bottom for easy access */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLineItem}
                  className="w-full border-dashed"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ({taxRate}%):</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-base pt-2 border-t">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-jo-form" disabled={addJobOrder.isPending}>
            {addJobOrder.isPending ? "Creating..." : "Create Job Order"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
