import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalculatorInput } from "@/components/ui/calculator-input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, Plus, Trash2, Send, Save, ChevronDown, Check, ChevronsUpDown, Package, Wrench, HardHat } from "lucide-react";
import { useAddPOAddendum, useUpdatePOAddendum, usePOAddendums, POAddendum, POAddendumLineItem } from "@/integrations/supabase/hooks/usePOAddendums";
import { useProducts } from "@/integrations/supabase/hooks/useProducts";
import { PendingFile, PendingAttachmentsUpload } from "@/components/shared/PendingAttachmentsUpload";
import { finalizeAttachments, cleanupPendingAttachments } from "@/utils/attachmentUtils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface LineItem {
  id: string;
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  markup: number;
  total: number;
}

interface AddAddendumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  editAddendum?: POAddendum | null;
  editLineItems?: POAddendumLineItem[];
}

export function AddAddendumDialog({
  open,
  onOpenChange,
  purchaseOrderId,
  purchaseOrderNumber,
  editAddendum,
  editLineItems,
}: AddAddendumDialogProps) {
  const { user } = useAuth();
  const [description, setDescription] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [pendingAttachments, setPendingAttachments] = useState<PendingFile[]>([]);
  
  // Customer representative fields
  const [customerRepName, setCustomerRepName] = useState("");
  const [customerRepTitle, setCustomerRepTitle] = useState("");
  const [customerRepEmail, setCustomerRepEmail] = useState("");
  const [requireApproval, setRequireApproval] = useState(false);
  
  // Product combobox state
  const [productComboboxOpen, setProductComboboxOpen] = useState<Record<string, boolean>>({});
  const [productSearch, setProductSearch] = useState<Record<string, string>>({});
  
  const addAddendum = useAddPOAddendum();
  const updateAddendum = useUpdatePOAddendum();
  const { data: products } = useProducts();
  const { data: existingAddendums } = usePOAddendums(purchaseOrderId);

  const isEditMode = !!editAddendum;
  const isApproved = editAddendum?.approval_status === 'approved';

  // Group products by type
  const getProductsByType = (type: 'product' | 'service' | 'labor') => {
    return products?.filter((p) => p.item_type === type) || [];
  };

  // Populate form when editing
  useEffect(() => {
    if (editAddendum && open) {
      setDescription(editAddendum.description || "");
      setCustomerRepName(editAddendum.customer_rep_name || "");
      setCustomerRepTitle(editAddendum.customer_rep_title || "");
      setCustomerRepEmail(editAddendum.customer_rep_email || "");
      setRequireApproval(!!editAddendum.customer_rep_email);
      setPendingAttachments([]);
      
      // Populate line items
      if (editLineItems && editLineItems.length > 0) {
        const items: LineItem[] = editLineItems.map(item => ({
          id: crypto.randomUUID(),
          productId: item.product_id || "",
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          markup: item.markup,
          total: item.total,
        }));
        setLineItems(items);
        setExpandedItems(new Set()); // Collapse all in edit mode
      }
    }
  }, [editAddendum, editLineItems, open]);

  // Calculate next CO number
  const nextNumber = (() => {
    if (!existingAddendums || existingAddendums.length === 0) return "CO-1";
    const numbers = existingAddendums
      .filter(a => a.number?.startsWith("CO-"))
      .map(a => parseInt(a.number!.replace("CO-", ""), 10))
      .filter(n => !isNaN(n));
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    return `CO-${maxNum + 1}`;
  })();

  const resetForm = () => {
    setDescription("");
    setLineItems([]);
    setExpandedItems(new Set());
    cleanupPendingAttachments(pendingAttachments);
    setPendingAttachments([]);
    setCustomerRepName("");
    setCustomerRepTitle("");
    setCustomerRepEmail("");
    setRequireApproval(false);
    setProductComboboxOpen({});
    setProductSearch({});
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const addLineItem = () => {
    const newId = crypto.randomUUID();
    setLineItems([
      ...lineItems,
      {
        id: newId,
        productId: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        markup: 0,
        total: 0,
      },
    ]);
    // Auto-expand newly added items
    setExpandedItems(prev => new Set(prev).add(newId));
  };

  const updateLineItem = (id: string, updates: Partial<LineItem>) => {
    setLineItems(items =>
      items.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        // Calculate total: (unitPrice * quantity) * (1 + markup/100)
        const baseTotal = updated.unitPrice * updated.quantity;
        updated.total = baseTotal * (1 + updated.markup / 100);
        return updated;
      })
    );
  };

  const removeLineItem = (id: string) => {
    setLineItems(items => items.filter(item => item.id !== id));
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectProduct = (lineItemId: string, productId: string) => {
    const product = products?.find(p => p.id === productId);
    if (product) {
      updateLineItem(lineItemId, {
        productId,
        description: product.description || product.name,
        unitPrice: product.cost || 0,
        markup: product.markup || 0,
      });
    }
    setProductComboboxOpen(prev => ({ ...prev, [lineItemId]: false }));
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalMarkup = lineItems.reduce((sum, item) => {
    const base = item.unitPrice * item.quantity;
    return sum + (base * item.markup / 100);
  }, 0);
  const total = subtotal + totalMarkup;

  const handleSubmit = async (sendForApproval = false) => {
    if (!description.trim() || lineItems.length === 0) return;
    
    // Validate approval fields if sending for approval
    if (sendForApproval && (!customerRepName.trim() || !customerRepEmail.trim())) {
      return;
    }

    const lineItemsData = lineItems.map((item, index) => ({
      productId: item.productId || null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      markup: item.markup,
      total: item.total,
      sortOrder: index,
    }));

    let addendumId: string;

    if (isEditMode && editAddendum) {
      await updateAddendum.mutateAsync({
        id: editAddendum.id,
        purchaseOrderId,
        description: description.trim(),
        subtotal,
        amount: total,
        lineItems: lineItemsData,
        customerRepName: customerRepName.trim() || undefined,
        customerRepTitle: customerRepTitle.trim() || undefined,
        customerRepEmail: customerRepEmail.trim() || undefined,
        sendForApproval,
      });
      addendumId = editAddendum.id;
    } else {
      const result = await addAddendum.mutateAsync({
        purchaseOrderId,
        number: nextNumber,
        description: description.trim(),
        subtotal,
        amount: total,
        lineItems: lineItemsData,
        customerRepName: customerRepName.trim() || undefined,
        customerRepTitle: customerRepTitle.trim() || undefined,
        customerRepEmail: customerRepEmail.trim() || undefined,
        sendForApproval,
      });
      addendumId = result.id;
    }

    // Finalize pending attachments
    if (pendingAttachments.length > 0 && user) {
      const attachResult = await finalizeAttachments(
        pendingAttachments,
        addendumId,
        "po_addendum",
        user.id
      );
      if (!attachResult.success) {
        toast.error(`Addendum saved but attachments failed: ${attachResult.error}`);
      }
    }

    handleClose();
  };

  const isValid = description.trim() && lineItems.length > 0 && lineItems.every(item => item.description.trim());
  const canSendForApproval = isValid && customerRepName.trim() && customerRepEmail.trim();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            {isEditMode ? "Edit" : "Add"} Addendum / Change Order
            <span className="text-primary font-mono">{isEditMode ? editAddendum?.number : nextNumber}</span>
          </DialogTitle>
          <DialogDescription>
            {isEditMode ? "Edit" : "Add"} a change order to {purchaseOrderNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description / Reason *</Label>
              <Input
                id="description"
                placeholder="e.g., Additional materials requested"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Line Items Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line Items *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>

              {lineItems.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center text-muted-foreground">
                  <p>No line items added</p>
                  <p className="text-sm">Click "Add Item" to add products or services</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Header row */}
                  <div className="grid grid-cols-[24px_1fr_60px_80px_80px_32px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
                    <div></div>
                    <div>Description</div>
                    <div className="text-right">Qty</div>
                    <div className="text-right">Price</div>
                    <div className="text-right">Total</div>
                    <div></div>
                  </div>

                  {lineItems.map((item) => {
                    const isExpanded = expandedItems.has(item.id);
                    return (
                      <Collapsible
                        key={item.id}
                        open={isExpanded}
                        onOpenChange={() => toggleExpanded(item.id)}
                      >
                        <div className="border border-border/50 rounded-lg bg-secondary/20 overflow-hidden">
                          {/* Collapsed row - always visible */}
                          <div className="grid grid-cols-[24px_1fr_60px_80px_80px_32px] gap-2 items-center px-3 py-2.5">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                <ChevronDown className={cn(
                                  "h-4 w-4 transition-transform duration-200",
                                  isExpanded && "rotate-180"
                                )} />
                              </Button>
                            </CollapsibleTrigger>
                            <span className="truncate text-sm">
                              {item.description || <span className="text-muted-foreground italic">New Item</span>}
                            </span>
                            <span className="text-right text-sm tabular-nums">{item.quantity}</span>
                            <span className="text-right text-sm tabular-nums">${item.unitPrice.toFixed(2)}</span>
                            <span className="text-right text-sm font-medium tabular-nums">${item.total.toFixed(2)}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeLineItem(item.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>

                          {/* Expanded content */}
                          <CollapsibleContent>
                            <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/30">
                              {/* Searchable Product Combobox */}
                              <div>
                                <Label className="text-xs">Product (Optional)</Label>
                                <Popover
                                  open={productComboboxOpen[item.id] || false}
                                  onOpenChange={(open) => setProductComboboxOpen(prev => ({ ...prev, [item.id]: open }))}
                                >
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      className={cn(
                                        "w-full justify-between mt-1",
                                        !item.productId && "text-muted-foreground"
                                      )}
                                    >
                                      {item.productId
                                        ? products?.find(p => p.id === item.productId)?.name || "Select product..."
                                        : "Select product..."}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[350px] p-0 z-[100]" align="start">
                                    <Command>
                                      <CommandInput
                                        placeholder="Search products..."
                                        value={productSearch[item.id] || ""}
                                        onValueChange={(value) => setProductSearch(prev => ({ ...prev, [item.id]: value }))}
                                      />
                                      <CommandList>
                                        <CommandEmpty>No products found.</CommandEmpty>
                                        
                                        {/* Custom Item Option */}
                                        <CommandGroup>
                                          <CommandItem
                                            value="__custom__"
                                            onSelect={() => {
                                              updateLineItem(item.id, { productId: "" });
                                              setProductComboboxOpen(prev => ({ ...prev, [item.id]: false }));
                                            }}
                                          >
                                            <Check className={cn("mr-2 h-4 w-4", !item.productId ? "opacity-100" : "opacity-0")} />
                                            -- Custom Item --
                                          </CommandItem>
                                        </CommandGroup>
                                        
                                        {getProductsByType('product').length > 0 && (
                                          <CommandGroup heading={<span className="flex items-center gap-1"><Package className="h-3 w-3" /> Products</span>}>
                                            {getProductsByType('product').map((product) => (
                                              <CommandItem
                                                key={product.id}
                                                value={`${product.name} ${product.sku || ''} ${product.category || ''}`}
                                                onSelect={() => selectProduct(item.id, product.id)}
                                              >
                                                <Check className={cn("mr-2 h-4 w-4", item.productId === product.id ? "opacity-100" : "opacity-0")} />
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
                                                <Check className={cn("mr-2 h-4 w-4", item.productId === product.id ? "opacity-100" : "opacity-0")} />
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
                                                <Check className={cn("mr-2 h-4 w-4", item.productId === product.id ? "opacity-100" : "opacity-0")} />
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

                              <div>
                                <Label className="text-xs">Description *</Label>
                                <Input
                                  className="mt-1"
                                  placeholder="Item description"
                                  value={item.description}
                                  onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                                />
                              </div>

                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <Label className="text-xs">Quantity</Label>
                                  <Input
                                    className="mt-1"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.quantity}
                                    onChange={(e) => updateLineItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                                  />
                                </div>

                                <div>
                                  <Label className="text-xs">Unit Price ($)</Label>
                                  <CalculatorInput
                                    className="mt-1"
                                    value={item.unitPrice}
                                    onValueChange={(value) => updateLineItem(item.id, { unitPrice: value })}
                                  />
                                </div>

                                <div>
                                  <Label className="text-xs">Markup (%)</Label>
                                  <CalculatorInput
                                    className="mt-1"
                                    value={item.markup}
                                    onValueChange={(value) => updateLineItem(item.id, { markup: value })}
                                    decimalPlaces={1}
                                  />
                                </div>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Totals */}
            {lineItems.length > 0 && (
              <div className="border border-border rounded-lg p-3 bg-secondary/30 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Markup</span>
                  <span>${totalMarkup.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-primary">${total.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* E-Signature Approval Section */}
            <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Require E-Signature Approval</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Send this change order to the customer for approval
                  </p>
                </div>
                <Switch
                  checked={requireApproval}
                  onCheckedChange={setRequireApproval}
                  disabled={isApproved}
                />
              </div>

              {requireApproval && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Representative Name *</Label>
                      <Input
                        placeholder="John Smith"
                        value={customerRepName}
                        onChange={(e) => setCustomerRepName(e.target.value)}
                        disabled={isApproved}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Title</Label>
                      <Input
                        placeholder="Project Manager"
                        value={customerRepTitle}
                        onChange={(e) => setCustomerRepTitle(e.target.value)}
                        disabled={isApproved}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email Address *</Label>
                    <Input
                      type="email"
                      placeholder="john@company.com"
                      value={customerRepEmail}
                      onChange={(e) => setCustomerRepEmail(e.target.value)}
                      disabled={isApproved}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>Supporting Documents (Optional)</Label>
              <PendingAttachmentsUpload
                entityType="po_addendum"
                pendingFiles={pendingAttachments}
                onFilesChange={setPendingAttachments}
                compact
              />
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 px-6 py-4 border-t border-border gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleSubmit(false)}
            disabled={!isValid || addAddendum.isPending || updateAddendum.isPending}
          >
            {(addAddendum.isPending || updateAddendum.isPending) ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Draft
          </Button>
          {requireApproval && (
            <Button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={!canSendForApproval || addAddendum.isPending || updateAddendum.isPending}
            >
              {(addAddendum.isPending || updateAddendum.isPending) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send for Approval
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
