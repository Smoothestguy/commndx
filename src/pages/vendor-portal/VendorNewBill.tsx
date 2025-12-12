import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VendorPortalLayout } from "@/components/vendor-portal/VendorPortalLayout";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { useVendorPurchaseOrders, useVendorPurchaseOrder, useCreateVendorBill } from "@/integrations/supabase/hooks/useVendorPortal";
import { format } from "date-fns";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_cost: number;
  total: number;
  po_line_item_id?: string;
}

export default function VendorNewBill() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPoId = searchParams.get("po");

  const { data: purchaseOrders, isLoading: posLoading } = useVendorPurchaseOrders();
  const [selectedPoId, setSelectedPoId] = useState(preselectedPoId || "");
  const { data: selectedPO, isLoading: poLoading } = useVendorPurchaseOrder(selectedPoId || undefined);
  const createBill = useCreateVendorBill();

  const [billDate, setBillDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: 1, unit_cost: 0, total: 0 },
  ]);

  // Populate line items from PO when selected
  useEffect(() => {
    if (selectedPO?.po_line_items && selectedPO.po_line_items.length > 0) {
      setLineItems(
        selectedPO.po_line_items.map((item: any) => ({
          id: crypto.randomUUID(),
          description: item.description,
          quantity: item.quantity,
          unit_cost: item.unit_cost || item.unit_price || 0,
          total: item.total,
          po_line_item_id: item.id,
        }))
      );
    }
  }, [selectedPO]);

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "unit_cost") {
          updated.total = updated.quantity * updated.unit_cost;
        }
        return updated;
      })
    );
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", quantity: 1, unit_cost: 0, total: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const total = lineItems.reduce((sum, item) => sum + item.total, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPoId) {
      return;
    }

    const validLineItems = lineItems.filter((item) => item.description && item.quantity > 0);
    
    if (validLineItems.length === 0) {
      return;
    }

    await createBill.mutateAsync({
      purchase_order_id: selectedPoId,
      bill_date: billDate,
      due_date: dueDate,
      notes,
      line_items: validLineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total: item.total,
        po_line_item_id: item.po_line_item_id,
      })),
    });

    navigate("/vendor/bills");
  };

  return (
    <>
      <SEO
        title="Submit New Bill"
        description="Submit a new bill for a purchase order"
      />
      <VendorPortalLayout>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => navigate("/vendor/bills")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Submit New Bill</h1>
              <p className="text-muted-foreground">Create a bill against a purchase order</p>
            </div>
          </div>

          {/* PO Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Purchase Order</CardTitle>
            </CardHeader>
            <CardContent>
              {posLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading purchase orders...
                </div>
              ) : (
                <Select value={selectedPoId} onValueChange={setSelectedPoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a purchase order" />
                  </SelectTrigger>
                  <SelectContent>
                    {purchaseOrders?.map((po) => (
                      <SelectItem key={po.id} value={po.id}>
                        {po.number} - {po.project_name} ({formatCurrency(po.remaining_to_bill)} remaining)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {selectedPO && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <div className="grid gap-2 sm:grid-cols-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Value:</span>
                      <p className="font-medium">{formatCurrency(selectedPO.revised_total)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Billed to Date:</span>
                      <p className="font-medium">{formatCurrency(selectedPO.billed_to_date)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Remaining:</span>
                      <p className="font-medium text-primary">{formatCurrency(selectedPO.remaining_to_bill)}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bill Info */}
          <Card>
            <CardHeader>
              <CardTitle>Bill Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="billDate">Bill Date</Label>
                  <Input
                    id="billDate"
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes for this bill..."
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lineItems.map((item, index) => (
                  <div key={item.id} className="grid gap-3 sm:grid-cols-12 items-end p-3 border rounded-lg">
                    <div className="sm:col-span-5 space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                        placeholder="Description"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs">Unit Cost</Label>
                      <Input
                        type="number"
                        value={item.unit_cost}
                        onChange={(e) => updateLineItem(item.id, "unit_cost", parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs">Total</Label>
                      <div className="h-9 flex items-center font-medium">
                        {formatCurrency(item.total)}
                      </div>
                    </div>
                    <div className="sm:col-span-1">
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
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(total)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/vendor/bills")}>
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedPoId || createBill.isPending}>
              {createBill.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Bill
            </Button>
          </div>
        </form>
      </VendorPortalLayout>
    </>
  );
}
