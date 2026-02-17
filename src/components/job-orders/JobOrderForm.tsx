import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalculatorInput } from "@/components/ui/calculator-input";
import { Label } from "@/components/ui/label";
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
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Plus, Trash2, Check, ChevronsUpDown, Package, Wrench, HardHat, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { useProducts } from "@/integrations/supabase/hooks/useProducts";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { toast } from "sonner";

const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(2000),
  quantity: z.number().min(0, "Quantity cannot be negative"),
  unit_price: z.number().min(0, "Unit price cannot be negative"),
  margin: z.number().min(0, "Margin cannot be negative").max(99.99, "Margin must be less than 100%"),
});

const jobOrderSchema = z.object({
  status: z.enum(["active", "in-progress", "completed", "on-hold"]),
  tax_rate: z.number().min(0).max(100),
  start_date: z.string().min(1, "Start date is required"),
  completion_date: z.string().optional(),
});

interface LineItem {
  id: string;
  product_id?: string;
  description: string;
  quantity: string;
  unit_price: string;
  margin: string;
  total: number;
}

interface JobOrderFormProps {
  initialData?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const JobOrderForm = ({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: JobOrderFormProps) => {
  const { data: products } = useProducts();
  
  const [status, setStatus] = useState<"active" | "in-progress" | "completed" | "on-hold">(
    initialData?.status || "active"
  );
  const [taxRate, setTaxRate] = useState<string>(
    initialData?.tax_rate?.toString() || "8.5"
  );
  const [startDate, setStartDate] = useState<string>(
    initialData?.start_date || new Date().toISOString().split("T")[0]
  );
  const [completionDate, setCompletionDate] = useState<string>(
    initialData?.completion_date || ""
  );

  const [lineItems, setLineItems] = useState<LineItem[]>(() => {
    if (initialData?.line_items && initialData.line_items.length > 0) {
      return initialData.line_items.map((item: any) => ({
        id: crypto.randomUUID(),
        product_id: item.product_id,
        description: item.description,
        quantity: item.quantity.toString(),
        unit_price: item.unit_price.toString(),
        margin: item.markup.toString(),
        total: item.total,
      }));
    }
    return [{ id: crypto.randomUUID(), description: "", quantity: "1", unit_price: "", margin: "0", total: 0 }];
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [productComboboxOpen, setProductComboboxOpen] = useState<Record<string, boolean>>({});
  const [productSearch, setProductSearch] = useState<Record<string, string>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    const reordered = [...lineItems];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, moved);
    setLineItems(reordered);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Group products by type
  const getProductsByType = (type: 'product' | 'service' | 'labor') => {
    return products?.filter((p) => p.item_type === type) || [];
  };

  const calculateLineItemTotal = (quantity: string, unitPrice: string, margin: string) => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    const mgn = parseFloat(margin) || 0;
    return mgn > 0 && mgn < 100 ? qty * price / (1 - mgn / 100) : qty * price;
  };

  const updateLineItem = (id: string, field: keyof Omit<LineItem, 'id'>, value: string) => {
    const newLineItems = lineItems.map(item => {
      if (item.id !== id) return item;
      const newItem = { ...item, [field]: value };

      if (field === "quantity" || field === "unit_price" || field === "margin") {
        newItem.total = calculateLineItemTotal(
          newItem.quantity,
          newItem.unit_price,
          newItem.margin
        );
      }

      return newItem;
    });
    setLineItems(newLineItems);
  };

  const selectProduct = (lineItemId: string, productId: string) => {
    const product = products?.find((p) => p.id === productId);
    if (product) {
      setLineItems(items => items.map(item => {
        if (item.id !== lineItemId) return item;
        const unitPrice = product.cost.toString();
        const margin = product.markup.toString();
        return {
          ...item,
          product_id: productId,
          description: product.description || product.name,
          unit_price: unitPrice,
          margin: margin,
          total: calculateLineItemTotal(item.quantity, unitPrice, margin),
        };
      }));
    }
    setProductComboboxOpen(prev => ({ ...prev, [lineItemId]: false }));
  };

  const addLineItem = () => {
    const newId = crypto.randomUUID();
    setLineItems([
      ...lineItems,
      { id: newId, description: "", quantity: "1", unit_price: "", margin: "0", total: 0 },
    ]);
    setExpandedItems(prev => new Set(prev).add(newId));
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * (parseFloat(taxRate) || 0) / 100;
  const total = subtotal + taxAmount;

  // Calculate remaining amount based on existing invoiced amount
  const invoicedAmount = initialData?.invoiced_amount || 0;
  const remainingAmount = total - invoicedAmount;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    try {
      jobOrderSchema.parse({
        status,
        tax_rate: parseFloat(taxRate),
        start_date: startDate,
        completion_date: completionDate || undefined,
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
    if (Object.keys(newErrors).length > 0) {
      toast.error("Please fix the validation errors before saving.");
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const jobOrderData = {
      jobOrder: {
        status,
        tax_rate: parseFloat(taxRate),
        tax_amount: taxAmount,
        subtotal,
        total,
        remaining_amount: remainingAmount,
        start_date: startDate,
        completion_date: completionDate || null,
      },
      lineItems: lineItems.map((item) => ({
        description: item.description,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        markup: parseFloat(item.margin),
        total: item.total,
      })),
    };

    await onSubmit(jobOrderData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Job Order Info (Read-only) */}
      {initialData && (
        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="font-heading">Job Order Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Number:</span>
                <span className="font-medium">{initialData.number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium">{initialData.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Project:</span>
                <span className="font-medium">{initialData.project_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Invoiced:</span>
                <span className="font-medium text-success">
                  ${invoicedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status & Dates */}
      <Card className="glass border-border">
        <CardHeader>
          <CardTitle className="font-heading">Status & Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="on-hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="text-sm text-destructive">{errors.status}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-secondary border-border"
              />
              {errors.start_date && (
                <p className="text-sm text-destructive">{errors.start_date}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="completionDate">Completion Date</Label>
              <Input
                id="completionDate"
                type="date"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
                className="bg-secondary border-border"
              />
            </div>
          </div>

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
        </CardContent>
      </Card>

      {/* Line Items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold">Line Items</h3>
          <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Item
          </Button>
        </div>
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[hsl(var(--table-header-bg))] hover:bg-[hsl(var(--table-header-bg))]">
                <TableHead className="h-8 text-xs font-semibold text-[hsl(var(--table-header-fg))] w-[30px]"></TableHead>
                <TableHead className="h-8 text-xs font-semibold text-[hsl(var(--table-header-fg))] w-[50px]">#</TableHead>
                <TableHead className="h-8 text-xs font-semibold text-[hsl(var(--table-header-fg))]">Description</TableHead>
                <TableHead className="h-8 text-xs font-semibold text-[hsl(var(--table-header-fg))] w-[80px] text-right">Qty</TableHead>
                <TableHead className="h-8 text-xs font-semibold text-[hsl(var(--table-header-fg))] w-[95px] text-right">Price</TableHead>
                <TableHead className="h-8 text-xs font-semibold text-[hsl(var(--table-header-fg))] w-[85px] text-right">Margin</TableHead>
                <TableHead className="h-8 text-xs font-semibold text-[hsl(var(--table-header-fg))] w-[100px] text-right">Total</TableHead>
                <TableHead className="h-8 text-xs font-semibold text-[hsl(var(--table-header-fg))] w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((item, index) => {
                const isExpanded = expandedItems.has(item.id);
                return (
                  <Collapsible key={item.id} open={isExpanded} onOpenChange={() => toggleExpand(item.id)} asChild>
                    <>
                      <TableRow
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={() => handleDrop(index)}
                        onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
                        className={cn(
                          "cursor-pointer text-xs hover:bg-muted/50 transition-colors",
                          dragOverIndex === index && "border-t-2 border-primary"
                        )}
                        onClick={() => toggleExpand(item.id)}
                      >
                        <TableCell className="py-1.5 px-1 cursor-grab" onClick={(e) => e.stopPropagation()}>
                          <GripVertical className="h-3 w-3 text-muted-foreground" />
                        </TableCell>
                        <TableCell className="py-1.5 px-2">
                          <div className="flex items-center gap-1">
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            )}
                            <span className="font-medium">{index + 1}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5 px-2">
                          <span className="truncate block max-w-[200px]">
                            {item.description || <span className="text-muted-foreground italic">No description</span>}
                          </span>
                        </TableCell>
                        <TableCell className="py-1.5 px-1 text-right" onClick={(e) => e.stopPropagation()}>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.id, "quantity", e.target.value)}
                            className="h-7 w-[60px] text-xs text-right bg-transparent border-transparent hover:border-border focus:border-primary tabular-nums px-1 ml-auto"
                          />
                        </TableCell>
                        <TableCell className="py-1.5 px-1 text-right" onClick={(e) => e.stopPropagation()}>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) => updateLineItem(item.id, "unit_price", e.target.value)}
                            className="h-7 w-[75px] text-xs text-right bg-transparent border-transparent hover:border-border focus:border-primary tabular-nums px-1 ml-auto"
                          />
                        </TableCell>
                        <TableCell className="py-1.5 px-1 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="99.99"
                              value={item.margin}
                              onChange={(e) => updateLineItem(item.id, "margin", e.target.value)}
                              className="h-7 w-[55px] text-xs text-right bg-transparent border-transparent hover:border-border focus:border-primary tabular-nums px-1"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5 px-2 text-right font-semibold tabular-nums">${item.total.toFixed(2)}</TableCell>
                        <TableCell className="py-1.5 px-2">
                          {lineItems.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeLineItem(item.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <tr>
                          <td colSpan={8} className="p-0 border-b">
                            <div className="bg-secondary/30 p-3 space-y-3">
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
                                        "w-full justify-between bg-secondary border-border h-8 text-xs",
                                        !item.product_id && "text-muted-foreground"
                                      )}
                                    >
                                      {item.product_id
                                        ? products?.find(p => p.id === item.product_id)?.name
                                        : "Select product..."}
                                      <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
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

                              {/* Description */}
                              <div className="space-y-1">
                                <Label className="text-xs">Description *</Label>
                                <Input
                                  value={item.description}
                                  onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                                  placeholder="Item description"
                                  className="bg-secondary border-border h-8 text-xs"
                                />
                                {errors[`line_${index}_description`] && (
                                  <p className="text-xs text-destructive">{errors[`line_${index}_description`]}</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

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
            {initialData && (
              <>
                <div className="flex justify-between text-sm text-success">
                  <span>Already Invoiced:</span>
                  <span className="font-medium">${invoicedAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t border-border pt-2">
                  <span>Remaining Amount:</span>
                  <span className="text-warning">${remainingAmount.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" variant="glow" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
};
