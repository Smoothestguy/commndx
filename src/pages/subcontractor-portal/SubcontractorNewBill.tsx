import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { SubcontractorPortalLayout } from "@/components/subcontractor-portal/SubcontractorPortalLayout";
import { POBackChargesDisplay } from "@/components/subcontractor-portal/POBackChargesDisplay";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";
import {
  useSubcontractorPurchaseOrders,
  useSubcontractorPurchaseOrder,
  usePOBackCharges,
  useCreateSubcontractorBill,
} from "@/integrations/supabase/hooks/useSubcontractorPortal";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_cost: number;
  total: number;
  po_line_item_id?: string;
}

export default function SubcontractorNewBill() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPO = searchParams.get("po");

  const [selectedPOId, setSelectedPOId] = useState(preselectedPO || "");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: 1, unit_cost: 0, total: 0 },
  ]);

  const { data: purchaseOrders, isLoading: posLoading } = useSubcontractorPurchaseOrders();
  const { data: selectedPO } = useSubcontractorPurchaseOrder(selectedPOId || undefined);
  const { data: backCharges } = usePOBackCharges(selectedPOId || undefined);
  const createBill = useCreateSubcontractorBill();

  // Set default due date to 30 days from bill date
  useEffect(() => {
    if (billDate) {
      const due = new Date(billDate);
      due.setDate(due.getDate() + 30);
      setDueDate(due.toISOString().split("T")[0]);
    }
  }, [billDate]);

  const availablePOs = purchaseOrders?.filter(
    (po) => po.status !== "closed" && po.status !== "cancelled" && po.remaining_to_bill > 0
  ) || [];

  const totalBackCharges = backCharges?.reduce((sum, c) => sum + c.amount, 0) || 0;
  const netRemaining = selectedPO ? (selectedPO.remaining_to_bill || 0) - totalBackCharges : 0;

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: crypto.randomUUID(), description: "", quantity: 1, unit_cost: 0, total: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((item) => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "unit_cost") {
          updated.total = updated.quantity * updated.unit_cost;
        }
        return updated;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPOId) return;
    if (lineItems.some((item) => !item.description)) {
      return;
    }

    await createBill.mutateAsync({
      purchase_order_id: selectedPOId,
      bill_date: billDate,
      due_date: dueDate,
      notes: notes || undefined,
      line_items: lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total: item.total,
        po_line_item_id: item.po_line_item_id,
      })),
    });

    navigate("/subcontractor/bills");
  };

  return (
    <>
      <SEO title="Create New Bill" description="Submit a new bill against a purchase order." />
      <SubcontractorPortalLayout>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => navigate("/subcontractor/bills")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Create New Bill</h1>
              <p className="text-muted-foreground">Submit a bill against one of your purchase orders.</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* PO Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Select Purchase Order</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedPOId} onValueChange={setSelectedPOId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a PO to bill against" />
                    </SelectTrigger>
                    <SelectContent>
                      {posLoading ? (
                        <SelectItem value="__loading__" disabled>Loading...</SelectItem>
                      ) : availablePOs.length === 0 ? (
                        <SelectItem value="__empty__" disabled>No POs available to bill</SelectItem>
                      ) : (
                        availablePOs.map((po) => (
                          <SelectItem key={po.id} value={po.id}>
                            {po.number} - {po.project_name} ({formatCurrency(po.remaining_to_bill)} remaining)
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Bill Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Bill Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes about this bill..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Line Items */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Line Items</CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {lineItems.map((item, index) => (
                    <div key={item.id} className="grid gap-3 sm:grid-cols-12 items-end border-b pb-4 last:border-0">
                      <div className="sm:col-span-5 space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                          placeholder="Work description"
                          required
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-xs">Unit Cost</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(e) => updateLineItem(item.id, "unit_cost", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-xs">Total</Label>
                        <Input value={formatCurrency(item.total)} disabled />
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

                  <div className="pt-4 border-t flex justify-between items-center">
                    <span className="font-medium">Subtotal</span>
                    <span className="text-xl font-bold">{formatCurrency(subtotal)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* PO Summary */}
              {selectedPO && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">PO Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Original Total</span>
                      <span>{formatCurrency(selectedPO.total || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Addendums</span>
                      <span>{formatCurrency(selectedPO.total_addendum_amount || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Billed to Date</span>
                      <span>{formatCurrency(selectedPO.billed_to_date || 0)}</span>
                    </div>
                    {totalBackCharges > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Back Charges</span>
                        <span className="text-destructive">-{formatCurrency(totalBackCharges)}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t flex justify-between">
                      <span className="font-medium">Available to Bill</span>
                      <span className="font-bold text-primary">{formatCurrency(netRemaining)}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Back Charges */}
              {selectedPOId && backCharges && backCharges.length > 0 && (
                <POBackChargesDisplay backCharges={backCharges} showTotal={false} />
              )}

              {/* Submit */}
              <Button
                type="submit"
                className="w-full"
                disabled={!selectedPOId || subtotal <= 0 || createBill.isPending}
              >
                {createBill.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Bill
              </Button>
            </div>
          </div>
        </form>
      </SubcontractorPortalLayout>
    </>
  );
}
