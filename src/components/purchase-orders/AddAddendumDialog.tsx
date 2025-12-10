import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, FileText, X, Plus, Trash2, Send, Save } from "lucide-react";
import { useAddPOAddendum, usePOAddendums } from "@/integrations/supabase/hooks/usePOAddendums";
import { useProducts } from "@/integrations/supabase/hooks/useProducts";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

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
}

export function AddAddendumDialog({
  open,
  onOpenChange,
  purchaseOrderId,
  purchaseOrderNumber,
}: AddAddendumDialogProps) {
  const [description, setDescription] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  
  // Customer representative fields
  const [customerRepName, setCustomerRepName] = useState("");
  const [customerRepTitle, setCustomerRepTitle] = useState("");
  const [customerRepEmail, setCustomerRepEmail] = useState("");
  const [requireApproval, setRequireApproval] = useState(false);
  
  const addAddendum = useAddPOAddendum();
  const { data: products } = useProducts();
  const { data: existingAddendums } = usePOAddendums(purchaseOrderId);

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
    setFile(null);
    setCustomerRepName("");
    setCustomerRepTitle("");
    setCustomerRepEmail("");
    setRequireApproval(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: crypto.randomUUID(),
        productId: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        markup: 0,
        total: 0,
      },
    ]);
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
      });
    }
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalMarkup = lineItems.reduce((sum, item) => {
    const base = item.unitPrice * item.quantity;
    return sum + (base * item.markup / 100);
  }, 0);
  const total = subtotal + totalMarkup;

  const handleSubmit = async (e: React.FormEvent, sendForApproval = false) => {
    e.preventDefault();
    if (!description.trim() || lineItems.length === 0) return;
    
    // Validate approval fields if sending for approval
    if (sendForApproval && (!customerRepName.trim() || !customerRepEmail.trim())) {
      return;
    }

    await addAddendum.mutateAsync({
      purchaseOrderId,
      number: nextNumber,
      description: description.trim(),
      subtotal,
      amount: total,
      lineItems: lineItems.map((item, index) => ({
        productId: item.productId || null,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        markup: item.markup,
        total: item.total,
        sortOrder: index,
      })),
      file: file || undefined,
      customerRepName: customerRepName.trim() || undefined,
      customerRepTitle: customerRepTitle.trim() || undefined,
      customerRepEmail: customerRepEmail.trim() || undefined,
      sendForApproval,
    });

    handleClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(selectedFile.type)) {
        return;
      }
      setFile(selectedFile);
    }
  };

  const isValid = description.trim() && lineItems.length > 0 && lineItems.every(item => item.description.trim());
  const canSendForApproval = isValid && customerRepName.trim() && customerRepEmail.trim();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            Add Addendum / Change Order
            <span className="text-primary font-mono">{nextNumber}</span>
          </DialogTitle>
          <DialogDescription>
            Add a change order to {purchaseOrderNumber}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-4 -mr-4">
          <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description / Reason *</Label>
              <Input
                id="description"
                placeholder="e.g., Additional materials requested"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
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
                <div className="space-y-3">
                  {lineItems.map((item, index) => (
                    <div key={item.id} className="p-3 border border-border/50 rounded-lg bg-secondary/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeLineItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
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

                        <div className="sm:col-span-2">
                          <Label className="text-xs">Description *</Label>
                          <Input
                            className="mt-1"
                            placeholder="Item description"
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                          />
                        </div>

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
                          <Label className="text-xs">Line Total</Label>
                          <div className="mt-1 h-10 flex items-center px-3 bg-secondary/50 rounded-md border border-border font-medium">
                            ${item.total.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
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
                <div className="flex justify-between font-bold border-t border-border pt-2">
                  <span>Total</span>
                  <span className="text-primary">${total.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Optional Document Upload */}
            <div className="space-y-2">
              <Label>Document (Optional)</Label>
              {file ? (
                <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-secondary/30">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => setFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-colors">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Click to upload PDF or image (optional)
                  </span>
                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <Separator className="my-4" />

            {/* Customer Approval Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Customer Approval</Label>
                  <p className="text-sm text-muted-foreground">
                    Require e-signature approval for this change order
                  </p>
                </div>
                <Switch
                  checked={requireApproval}
                  onCheckedChange={setRequireApproval}
                />
              </div>

              {requireApproval && (
                <div className="space-y-3 p-4 border border-border rounded-lg bg-secondary/20">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Customer Representative Name *</Label>
                      <Input
                        className="mt-1"
                        placeholder="e.g., John Smith"
                        value={customerRepName}
                        onChange={(e) => setCustomerRepName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Title</Label>
                      <Input
                        className="mt-1"
                        placeholder="e.g., Project Manager"
                        value={customerRepTitle}
                        onChange={(e) => setCustomerRepTitle(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Email *</Label>
                      <Input
                        className="mt-1"
                        type="email"
                        placeholder="email@company.com"
                        value={customerRepEmail}
                        onChange={(e) => setCustomerRepEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    An email will be sent to the customer representative with a link to review and e-sign this change order.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              {requireApproval ? (
                <>
                  <Button 
                    type="button" 
                    variant="secondary"
                    disabled={!isValid || addAddendum.isPending}
                    onClick={(e) => handleSubmit(e as any, false)}
                  >
                    {addAddendum.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" />
                    Save Draft
                  </Button>
                  <Button 
                    type="button" 
                    disabled={!canSendForApproval || addAddendum.isPending}
                    onClick={(e) => handleSubmit(e as any, true)}
                  >
                    {addAddendum.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Send className="mr-2 h-4 w-4" />
                    Save & Send for Approval
                  </Button>
                </>
              ) : (
                <Button type="submit" disabled={!isValid || addAddendum.isPending}>
                  {addAddendum.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add {nextNumber}
                </Button>
              )}
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}