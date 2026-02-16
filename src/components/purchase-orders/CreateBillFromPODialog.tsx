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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddVendorBill } from "@/integrations/supabase/hooks/useVendorBills";
import { PurchaseOrderWithLineItems } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { usePOAddendums, POAddendumLineItem } from "@/integrations/supabase/hooks/usePOAddendums";
import { useExpenseCategories } from "@/integrations/supabase/hooks/useExpenseCategories";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { AlertTriangle, Receipt, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PendingAttachmentsUpload, PendingFile } from "@/components/shared/PendingAttachmentsUpload";
import { finalizeAttachments, cleanupPendingAttachments } from "@/utils/attachmentUtils";
import { toast } from "sonner";

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
  source: 'po' | 'addendum';
  sourceId?: string; // Addendum ID for addendum items
  addendumNumber?: string; // Display number for addendum items
}

export function CreateBillFromPODialog({
  open,
  onOpenChange,
  purchaseOrder,
}: CreateBillFromPODialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const addVendorBill = useAddVendorBill();
  
  // Fetch addendums for this PO
  const { data: addendums } = usePOAddendums(purchaseOrder.id);
  const { data: categories } = useExpenseCategories("vendor");
  
  const [addendumLineItems, setAddendumLineItems] = useState<(POAddendumLineItem & { addendumNumber: string })[]>([]);
  const [lineItems, setLineItems] = useState<LineItemQuantity[]>([]);
  const [billDate, setBillDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingFile[]>([]);

  // Fetch addendum line items when addendums change
  useEffect(() => {
    const fetchAddendumLineItems = async () => {
      if (!addendums || addendums.length === 0) {
        setAddendumLineItems([]);
        return;
      }

      const addendumIds = addendums.map(a => a.id);
      const { data, error } = await supabase
        .from("po_addendum_line_items")
        .select("*")
        .in("po_addendum_id", addendumIds)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Error fetching addendum line items:", error);
        return;
      }

      // Map addendum numbers to line items
      const itemsWithNumbers = (data || []).map(item => {
        const addendum = addendums.find(a => a.id === item.po_addendum_id);
        return {
          ...item,
          addendumNumber: addendum?.number || 'Addendum',
        };
      });

      setAddendumLineItems(itemsWithNumbers);
    };

    fetchAddendumLineItems();
  }, [addendums]);

  // Combine PO line items and addendum line items
  useEffect(() => {
    // PO line items
    const poItems: LineItemQuantity[] = purchaseOrder.line_items.map((item) => ({
      id: item.id || "",
      description: item.description,
      originalQuantity: Number(item.quantity),
      billedQuantity: Number(item.billed_quantity || 0),
      remainingQuantity: Number(item.quantity) - Number(item.billed_quantity || 0),
      unitPrice: Number(item.unit_price),
      quantityToBill: Math.max(0, Number(item.quantity) - Number(item.billed_quantity || 0)),
      source: 'po' as const,
    }));

    // Addendum line items
    const addendumItems: LineItemQuantity[] = addendumLineItems.map((item) => ({
      id: item.id,
      description: item.description,
      originalQuantity: Number(item.quantity),
      billedQuantity: Number((item as any).billed_quantity || 0),
      remainingQuantity: Number(item.quantity) - Number((item as any).billed_quantity || 0),
      unitPrice: Number(item.unit_price),
      quantityToBill: Math.max(0, Number(item.quantity) - Number((item as any).billed_quantity || 0)),
      source: 'addendum' as const,
      sourceId: item.po_addendum_id,
      addendumNumber: item.addendumNumber,
    }));

    setLineItems([...poItems, ...addendumItems]);
  }, [purchaseOrder.line_items, addendumLineItems]);

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

  // Separate PO items and addendum items for display
  const poLineItems = lineItems.filter(item => item.source === 'po');
  const addendumLineItemsForDisplay = lineItems.filter(item => item.source === 'addendum');

  const handleSubmit = async () => {
    if (!hasValidItems || hasExceededQuantity) return;

    // Resolve jo_line_item_id and qb_product_mapping_id for each line item
    let joLineItems: any[] = [];
    if (purchaseOrder.job_order_id) {
      const { data } = await supabase
        .from("job_order_line_items")
        .select("id, description, product_id")
        .eq("job_order_id", purchaseOrder.job_order_id);
      joLineItems = data || [];
    }

    // Fetch product -> qb_product_mapping_id lookups for matched JO products
    const productIds = joLineItems
      .map((j: any) => j.product_id)
      .filter(Boolean);
    
    let productMappings: Record<string, string | null> = {};
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("id, qb_product_mapping_id")
        .in("id", productIds);
      
      if (products) {
        products.forEach((p: any) => {
          productMappings[p.id] = p.qb_product_mapping_id;
        });
      }
    }

    const findJoLineItemId = (description: string, productId?: string | null): string | null => {
      if (!joLineItems.length) return null;
      if (productId) {
        const match = joLineItems.find((j: any) => j.product_id === productId);
        if (match) return match.id;
      }
      const descLower = description.toLowerCase().trim();
      const match = joLineItems.find((j: any) => j.description.toLowerCase().trim() === descLower);
      return match?.id || null;
    };

    const findQbProductMappingId = (description: string): string | null => {
      if (!joLineItems.length) return null;
      const descLower = description.toLowerCase().trim();
      const joMatch = joLineItems.find((j: any) => j.description.toLowerCase().trim() === descLower);
      if (joMatch?.product_id && productMappings[joMatch.product_id]) {
        return productMappings[joMatch.product_id];
      }
      return null;
    };

    const billLineItems = lineItems
      .filter((item) => item.quantityToBill > 0)
      .map((item) => ({
        po_line_item_id: item.source === 'po' ? item.id : null,
        po_addendum_line_item_id: item.source === 'addendum' ? item.id : null,
        jo_line_item_id: item.source === 'po' ? findJoLineItemId(item.description) : null,
        qb_product_mapping_id: findQbProductMappingId(item.description),
        project_id: purchaseOrder.project_id,
        category_id: categoryId,
        description: item.source === 'addendum' 
          ? `[${item.addendumNumber}] ${item.description}`
          : item.description,
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
          notes: `Created from Purchase Order ${purchaseOrder.number}${addendumLineItemsForDisplay.length > 0 ? ' (includes addendum items)' : ''}`,
          purchase_order_id: purchaseOrder.id,
          purchase_order_number: purchaseOrder.number,
        },
        lineItems: billLineItems,
      });

      // Finalize any pending attachments FIRST - must complete before QB sync
      console.log(`[CreateBillFromPO] Bill created: ${result.id}, finalizing ${pendingAttachments.length} attachments...`);
      
      if (pendingAttachments.length > 0 && user) {
        const attachResult = await finalizeAttachments(
          pendingAttachments,
          result.id,
          "vendor_bill",
          user.id
        );
        console.log(`[CreateBillFromPO] Attachments finalized:`, attachResult);
        
        if (!attachResult.success) {
          toast.warning("Bill created but some attachments failed to upload");
        }
        
        // Small delay to ensure DB writes are committed before QB sync
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`[CreateBillFromPO] Post-attachment delay complete, proceeding to QB sync`);
      }

      // Sync to QuickBooks AFTER attachments are finalized
      try {
        const { data: qbConfig } = await supabase
          .from("quickbooks_config")
          .select("is_connected")
          .single();

        if (qbConfig?.is_connected) {
          console.log(`[CreateBillFromPO] Starting QuickBooks sync for bill: ${result.id}`);
          const syncResult = await supabase.functions.invoke("quickbooks-create-bill", {
            body: { billId: result.id },
          });
          console.log(`[CreateBillFromPO] QuickBooks sync complete:`, syncResult.data);
          toast.success("Bill created and synced to QuickBooks");
        }
      } catch (qbError) {
        console.warn("[CreateBillFromPO] QuickBooks sync failed:", qbError);
        toast.warning("Bill created, but QuickBooks sync failed. You can retry later.");
      }

      onOpenChange(false);
      navigate(`/vendor-bills/${result.id}`);
    } catch (error) {
      console.error("Error creating vendor bill:", error);
    }
  };

  const handleDialogClose = async (newOpen: boolean) => {
    if (!newOpen && pendingAttachments.length > 0) {
      // Clean up pending attachments if dialog is closed without creating the bill
      await cleanupPendingAttachments(pendingAttachments);
      setPendingAttachments([]);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Create Vendor Bill from PO {purchaseOrder.number}
          </DialogTitle>
          <DialogDescription>
            Enter the quantities to bill. You can create partial bills by billing less than the remaining quantity.
            {addendumLineItemsForDisplay.length > 0 && (
              <span className="block mt-1 text-primary">
                This PO has {addendumLineItemsForDisplay.length} addendum item(s) that can be included in this bill.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 py-4">
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
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={categoryId || "none"}
              onValueChange={(v) => setCategoryId(v === "none" ? null : v)}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Category</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              {/* PO Line Items */}
              {poLineItems.length > 0 && (
                <>
                  <TableRow className="bg-muted/20">
                    <TableCell colSpan={7} className="py-2 font-medium text-muted-foreground text-sm">
                      Original PO Items
                    </TableCell>
                  </TableRow>
                  {poLineItems.map((item) => (
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
                          step="any"
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
                </>
              )}
              
              {/* Addendum Line Items */}
              {addendumLineItemsForDisplay.length > 0 && (
                <>
                  <TableRow className="bg-amber-500/10 border-t-2 border-amber-500/30">
                    <TableCell colSpan={7} className="py-2 font-medium text-amber-600 dark:text-amber-400 text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Addendum Items
                      </div>
                    </TableCell>
                  </TableRow>
                  {addendumLineItemsForDisplay.map((item) => (
                    <TableRow key={item.id} className="bg-amber-500/5">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600 dark:text-amber-400">
                            {item.addendumNumber}
                          </Badge>
                          {item.description}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.originalQuantity}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {item.billedQuantity}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={item.remainingQuantity === 0 ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400 font-medium"}>
                          {item.remainingQuantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          max={item.remainingQuantity}
                          step="any"
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
                </>
              )}
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

        {/* Attachments Section */}
        <div className="pt-4 border-t">
          <PendingAttachmentsUpload
            entityType="vendor_bill"
            pendingFiles={pendingAttachments}
            onFilesChange={setPendingAttachments}
            compact={true}
          />
        </div>

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
