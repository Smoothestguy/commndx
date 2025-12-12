import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useRestorePOLineItems } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { formatCurrency } from "@/lib/utils";
import { Loader2, AlertTriangle, Package } from "lucide-react";
import { toast } from "sonner";

interface LineItemToRestore {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  markup: number;
  total: number;
  selected: boolean;
}

interface RestoreLineItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string;
  jobOrderId: string;
  expectedSubtotal: number;
}

export function RestoreLineItemsDialog({
  open,
  onOpenChange,
  purchaseOrderId,
  jobOrderId,
  expectedSubtotal,
}: RestoreLineItemsDialogProps) {
  const [items, setItems] = useState<LineItemToRestore[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"select" | "manual">("select");
  const [manualItem, setManualItem] = useState({
    description: "",
    quantity: 1,
    unit_price: expectedSubtotal,
    markup: 0,
  });

  const restoreLineItems = useRestorePOLineItems();

  useEffect(() => {
    if (open && jobOrderId) {
      fetchJobOrderLineItems();
    }
  }, [open, jobOrderId]);

  const fetchJobOrderLineItems = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("job_order_line_items")
        .select("*")
        .eq("job_order_id", jobOrderId);

      if (error) throw error;

      setItems(
        (data || []).map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          markup: item.markup,
          total: item.total,
          selected: true,
        }))
      );
    } catch (error) {
      console.error("Error fetching job order line items:", error);
      toast.error("Failed to load line items from job order");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const updateItemQuantity = (id: string, quantity: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity, total: quantity * item.unit_price }
          : item
      )
    );
  };

  const selectedTotal = items
    .filter((i) => i.selected)
    .reduce((sum, i) => sum + i.total, 0);

  const handleRestore = async () => {
    const selectedItems = items.filter((i) => i.selected);
    if (selectedItems.length === 0) {
      toast.error("Please select at least one item to restore");
      return;
    }

    try {
      await restoreLineItems.mutateAsync({
        purchaseOrderId,
        lineItems: selectedItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          markup: item.markup,
          total: item.total,
        })),
      });
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleAddManual = async () => {
    if (!manualItem.description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    const total = manualItem.quantity * manualItem.unit_price;

    try {
      await restoreLineItems.mutateAsync({
        purchaseOrderId,
        lineItems: [
          {
            description: manualItem.description,
            quantity: manualItem.quantity,
            unit_price: manualItem.unit_price,
            markup: manualItem.markup,
            total,
          },
        ],
      });
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Restore Line Items
          </DialogTitle>
          <DialogDescription>
            Line items for this purchase order are missing. Choose how to
            restore them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode selector */}
          <div className="flex gap-2">
            <Button
              variant={mode === "select" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("select")}
            >
              Copy from Job Order
            </Button>
            <Button
              variant={mode === "manual" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("manual")}
            >
              Add Manually
            </Button>
          </div>

          {mode === "select" ? (
            <>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-warning" />
                  <p>No line items found in the related job order.</p>
                  <p className="text-sm">Try adding items manually instead.</p>
                </div>
              ) : (
                <>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <div className="flex justify-between">
                      <span>Expected PO Subtotal:</span>
                      <span className="font-medium">
                        {formatCurrency(expectedSubtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span>Selected Items Total:</span>
                      <span
                        className={`font-medium ${
                          Math.abs(selectedTotal - expectedSubtotal) < 0.01
                            ? "text-success"
                            : "text-warning"
                        }`}
                      >
                        {formatCurrency(selectedTotal)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-secondary/20"
                      >
                        <Checkbox
                          checked={item.selected}
                          onCheckedChange={() => toggleItem(item.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {item.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(item.unit_price)} × {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItemQuantity(
                                item.id,
                                Number(e.target.value) || 1
                              )
                            }
                            className="w-20 h-8 text-sm"
                            min={1}
                          />
                          <span className="text-sm font-medium w-24 text-right">
                            {formatCurrency(item.total)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={manualItem.description}
                  onChange={(e) =>
                    setManualItem((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Enter item description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={manualItem.quantity}
                    onChange={(e) =>
                      setManualItem((prev) => ({
                        ...prev,
                        quantity: Number(e.target.value) || 1,
                      }))
                    }
                    min={1}
                  />
                </div>
                <div>
                  <Label htmlFor="unit_price">Unit Price</Label>
                  <Input
                    id="unit_price"
                    type="number"
                    step="0.01"
                    value={manualItem.unit_price}
                    onChange={(e) =>
                      setManualItem((prev) => ({
                        ...prev,
                        unit_price: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span>Total:</span>
                  <span className="font-medium">
                    {formatCurrency(manualItem.quantity * manualItem.unit_price)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {mode === "select" ? (
            <Button
              onClick={handleRestore}
              disabled={
                restoreLineItems.isPending ||
                items.filter((i) => i.selected).length === 0
              }
            >
              {restoreLineItems.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Restore Selected Items
            </Button>
          ) : (
            <Button
              onClick={handleAddManual}
              disabled={restoreLineItems.isPending || !manualItem.description}
            >
              {restoreLineItems.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Add Item
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
