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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Trash2, Send, Save, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useAddTMTicket, useUpdateTMTicket, TMTicketWithLineItems, TMTicketLineItem, ChangeType } from "@/integrations/supabase/hooks/useTMTickets";
import { useProducts } from "@/integrations/supabase/hooks/useProducts";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import { usePurchaseOrders } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";

interface LineItem {
  id: string;
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  markup: number;
  total: number;
  isTaxable: boolean;
}

interface AddTMTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  customerId?: string;
  projectName?: string;
  editTicket?: TMTicketWithLineItems | null;
}

export function AddTMTicketDialog({
  open,
  onOpenChange,
  projectId,
  customerId,
  projectName,
  editTicket,
}: AddTMTicketDialogProps) {
  const [description, setDescription] = useState("");
  const [workDate, setWorkDate] = useState(new Date().toISOString().split("T")[0]);
  const [vendorId, setVendorId] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [createdInField, setCreatedInField] = useState(false);
  const [notes, setNotes] = useState("");
  const [changeType, setChangeType] = useState<ChangeType>("additive");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  
  // Customer representative fields
  const [customerRepName, setCustomerRepName] = useState("");
  const [customerRepTitle, setCustomerRepTitle] = useState("");
  const [customerRepEmail, setCustomerRepEmail] = useState("");
  const [requireSignature, setRequireSignature] = useState(false);

  const addTMTicket = useAddTMTicket();
  const updateTMTicket = useUpdateTMTicket();
  const { data: products } = useProducts();
  const { data: vendors } = useVendors();
  const { data: allPurchaseOrders } = usePurchaseOrders();
  const purchaseOrders = allPurchaseOrders?.filter(po => po.project_id === projectId);
  const { data: companySettings } = useCompanySettings();

  const isEditMode = !!editTicket;
  const defaultTaxRate = companySettings?.default_tax_rate || 8.25;

  // Populate form when editing
  useEffect(() => {
    if (editTicket && open) {
      setDescription(editTicket.description || "");
      setWorkDate(editTicket.work_date);
      setVendorId(editTicket.vendor_id || "");
      setPurchaseOrderId(editTicket.purchase_order_id || "");
      setCreatedInField(editTicket.created_in_field || false);
      setNotes(editTicket.notes || "");
      setChangeType(editTicket.change_type || "additive");
      setCustomerRepName(editTicket.customer_rep_name || "");
      setCustomerRepTitle(editTicket.customer_rep_title || "");
      setCustomerRepEmail(editTicket.customer_rep_email || "");
      setRequireSignature(!!editTicket.customer_rep_email);
      
      if (editTicket.line_items && editTicket.line_items.length > 0) {
        const items: LineItem[] = editTicket.line_items.map((item: TMTicketLineItem) => ({
          id: crypto.randomUUID(),
          productId: item.product_id || "",
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          markup: item.markup,
          total: item.total,
          isTaxable: item.is_taxable,
        }));
        setLineItems(items);
        setExpandedItems(new Set());
      }
    }
  }, [editTicket, open]);

  const resetForm = () => {
    setDescription("");
    setWorkDate(new Date().toISOString().split("T")[0]);
    setVendorId("");
    setPurchaseOrderId("");
    setCreatedInField(false);
    setNotes("");
    setChangeType("additive");
    setLineItems([]);
    setExpandedItems(new Set());
    setCustomerRepName("");
    setCustomerRepTitle("");
    setCustomerRepEmail("");
    setRequireSignature(false);
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
        isTaxable: true,
      },
    ]);
    setExpandedItems(prev => new Set(prev).add(newId));
  };

  const updateLineItem = (id: string, updates: Partial<LineItem>) => {
    setLineItems(items =>
      items.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
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

  const handleProductSelect = (lineItemId: string, productId: string) => {
    if (productId === "none") {
      updateLineItem(lineItemId, { productId: "" });
      return;
    }
    const product = products?.find(p => p.id === productId);
    if (product) {
      updateLineItem(lineItemId, {
        productId,
        description: product.description || product.name,
        unitPrice: product.cost || 0,
        markup: product.markup || 0,
        isTaxable: product.item_type !== 'service' && product.item_type !== 'labor',
      });
    }
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const taxableSubtotal = lineItems.filter(i => i.isTaxable).reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const taxAmount = taxableSubtotal * (defaultTaxRate / 100);
  const totalMarkup = lineItems.reduce((sum, item) => {
    const base = item.unitPrice * item.quantity;
    return sum + (base * item.markup / 100);
  }, 0);
  const total = subtotal + totalMarkup + taxAmount;

  const handleSubmit = async (sendForSignature = false) => {
    if (lineItems.length === 0) return;
    
    if (sendForSignature && (!customerRepName.trim() || !customerRepEmail.trim())) {
      return;
    }

    const lineItemsData = lineItems.map((item, index) => ({
      product_id: item.productId || undefined,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      markup: item.markup,
      total: item.total,
      is_taxable: item.isTaxable,
      sort_order: index,
    }));

    if (isEditMode && editTicket) {
      await updateTMTicket.mutateAsync({
        id: editTicket.id,
        updates: {
          description: description.trim() || undefined,
          work_date: workDate,
          vendor_id: vendorId || null,
          purchase_order_id: purchaseOrderId || null,
          customer_rep_name: customerRepName.trim() || undefined,
          customer_rep_title: customerRepTitle.trim() || undefined,
          customer_rep_email: customerRepEmail.trim() || undefined,
          tax_rate: defaultTaxRate,
          notes: notes.trim() || undefined,
        },
        lineItems: lineItemsData,
        sendForSignature,
      });
    } else {
      await addTMTicket.mutateAsync({
        project_id: projectId,
        customer_id: customerId,
        vendor_id: vendorId || undefined,
        purchase_order_id: purchaseOrderId || undefined,
        description: description.trim() || undefined,
        work_date: workDate,
        created_in_field: createdInField,
        customer_rep_name: customerRepName.trim() || undefined,
        customer_rep_title: customerRepTitle.trim() || undefined,
        customer_rep_email: customerRepEmail.trim() || undefined,
        tax_rate: defaultTaxRate,
        notes: notes.trim() || undefined,
        change_type: changeType,
        lineItems: lineItemsData,
        sendForSignature,
      });
    }

    handleClose();
  };

  const isValid = lineItems.length > 0 && lineItems.every(item => item.description.trim());
  const canSendForSignature = isValid && customerRepName.trim() && customerRepEmail.trim();
  const isPending = addTMTicket.isPending || updateTMTicket.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
          <DialogTitle>
            {isEditMode ? "Edit" : "New"} T&M Ticket
            {projectName && <span className="text-primary ml-2">- {projectName}</span>}
          </DialogTitle>
          <DialogDescription>
            {isEditMode ? "Edit the" : "Create a"} time & materials ticket for extra work performed on-site.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-4 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="workDate">Work Date *</Label>
                <Input
                  id="workDate"
                  type="date"
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Created in Field</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch
                    checked={createdInField}
                    onCheckedChange={setCreatedInField}
                    disabled={isEditMode}
                  />
                  <span className="text-sm text-muted-foreground">
                    {createdInField ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the extra work..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vendor (Optional)</Label>
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- No Vendor --</SelectItem>
                    {vendors?.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Link to PO (Optional)</Label>
                <Select value={purchaseOrderId} onValueChange={setPurchaseOrderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select PO..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- No PO --</SelectItem>
                    {purchaseOrders?.map((po) => (
                      <SelectItem key={po.id} value={po.id}>
                        {po.number} - {po.vendor_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Change Type</Label>
                <Select value={changeType} onValueChange={(v) => setChangeType(v as ChangeType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="additive">Additive (Add to Contract)</SelectItem>
                    <SelectItem value="deductive">Deductive (Credit)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Line Items */}
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
                  {lineItems.map((item) => {
                    const isExpanded = expandedItems.has(item.id);
                    return (
                      <Collapsible
                        key={item.id}
                        open={isExpanded}
                        onOpenChange={() => toggleExpanded(item.id)}
                      >
                        <div className="border border-border/50 rounded-lg bg-secondary/20 overflow-hidden">
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

                          <CollapsibleContent>
                            <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/30">
                              <div>
                                <Label className="text-xs">Product (Optional)</Label>
                                <Select
                                  value={item.productId || "none"}
                                  onValueChange={(v) => handleProductSelect(item.id, v)}
                                >
                                  <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Select product..." />
                                  </SelectTrigger>
                                  <SelectContent className="z-[100]">
                                    <SelectItem value="none">-- Custom Item --</SelectItem>
                                    {products?.map((product) => (
                                      <SelectItem key={product.id} value={product.id}>
                                        {product.name} {product.cost ? `($${product.cost.toFixed(2)})` : ""}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
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

                              <div className="grid grid-cols-4 gap-3">
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
                                  <Input
                                    className="mt-1"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.unitPrice}
                                    onChange={(e) => updateLineItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                                  />
                                </div>

                                <div>
                                  <Label className="text-xs">Markup (%)</Label>
                                  <Input
                                    className="mt-1"
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={item.markup}
                                    onChange={(e) => updateLineItem(item.id, { markup: parseFloat(e.target.value) || 0 })}
                                  />
                                </div>

                                <div>
                                  <Label className="text-xs">Taxable</Label>
                                  <div className="flex items-center h-10 mt-1">
                                    <Switch
                                      checked={item.isTaxable}
                                      onCheckedChange={(checked) => updateLineItem(item.id, { isTaxable: checked })}
                                    />
                                  </div>
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
                {totalMarkup > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Markup</span>
                    <span>${totalMarkup.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({defaultTaxRate}%)</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-primary">${total.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Customer Signature Section */}
            <Separator />
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Request Customer Signature</Label>
                <Switch
                  checked={requireSignature}
                  onCheckedChange={setRequireSignature}
                />
              </div>

              {requireSignature && (
                <div className="space-y-4 p-4 border border-border rounded-lg bg-secondary/20">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="repName">Customer Rep Name *</Label>
                      <Input
                        id="repName"
                        placeholder="John Smith"
                        value={customerRepName}
                        onChange={(e) => setCustomerRepName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="repTitle">Title</Label>
                      <Input
                        id="repTitle"
                        placeholder="Project Manager"
                        value={customerRepTitle}
                        onChange={(e) => setCustomerRepTitle(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="repEmail">Email *</Label>
                    <Input
                      id="repEmail"
                      type="email"
                      placeholder="john@customer.com"
                      value={customerRepEmail}
                      onChange={(e) => setCustomerRepEmail(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 px-6 py-4 border-t border-border bg-background">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSubmit(false)}
            disabled={!isValid || isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save as Draft
          </Button>
          {requireSignature && (
            <Button
              onClick={() => handleSubmit(true)}
              disabled={!canSendForSignature || isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send for Signature
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
