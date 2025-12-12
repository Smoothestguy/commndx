import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, ArrowRight, Truck } from "lucide-react";
import { useChangeOrdersByProject, useChangeOrder } from "@/integrations/supabase/hooks/useChangeOrders";
import { usePurchaseOrders } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { useAddPOAddendum } from "@/integrations/supabase/hooks/usePOAddendums";
import { formatCurrency } from "@/lib/utils";

interface ImportToAddendumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  changeOrderId?: string; // Pre-selected CO
  purchaseOrderId?: string; // Pre-selected PO
}

export function ImportToAddendumDialog({
  open,
  onOpenChange,
  projectId,
  changeOrderId: preSelectedCO,
  purchaseOrderId: preSelectedPO,
}: ImportToAddendumDialogProps) {
  const [selectedCO, setSelectedCO] = useState(preSelectedCO || "");
  const [selectedPO, setSelectedPO] = useState(preSelectedPO || "");
  
  const { data: changeOrders, isLoading: loadingCOs } = useChangeOrdersByProject(projectId);
  const { data: selectedCOData } = useChangeOrder(selectedCO || undefined);
  const { data: allPurchaseOrders, isLoading: loadingPOs } = usePurchaseOrders();
  const addAddendum = useAddPOAddendum();

  const purchaseOrders = allPurchaseOrders?.filter(po => po.project_id === projectId);

  // Filter to only approved change orders that haven't been linked yet
  const availableCOs = changeOrders?.filter(
    co => co.status === 'approved'
  ) || [];

  const selectedChangeOrder = availableCOs.find(co => co.id === selectedCO);
  const selectedPurchaseOrder = purchaseOrders?.find(po => po.id === selectedPO);

  const handleImport = async () => {
    if (!selectedCO || !selectedPO || !selectedCOData) return;

    // Create addendum from change order line items using vendor costs
    const lineItemsData = selectedCOData.line_items?.map((item, index) => {
      const vendorCost = item.vendor_cost || 0;
      return {
        productId: item.product_id || null,
        description: item.description,
        quantity: item.quantity,
        unitPrice: vendorCost, // Use vendor cost for PO addendum
        markup: 0,
        total: item.quantity * vendorCost,
        sortOrder: index,
      };
    }) || [];

    const subtotal = lineItemsData.reduce((sum, item) => sum + item.total, 0);

    await addAddendum.mutateAsync({
      purchaseOrderId: selectedPO,
      number: `ADD-${selectedCOData.number}`,
      description: `Imported from ${selectedCOData.number}: ${selectedCOData.reason}`,
      subtotal: subtotal,
      amount: subtotal,
      lineItems: lineItemsData,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Import Change Order to PO
          </DialogTitle>
          <DialogDescription>
            Add an approved change order as a PO addendum to assign the work to a vendor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Change Order Selection */}
          <div className="space-y-2">
            <Label>Select Change Order</Label>
            {loadingCOs ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : availableCOs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No approved change orders available to import.
              </p>
            ) : (
              <Select 
                value={selectedCO} 
                onValueChange={setSelectedCO}
                disabled={!!preSelectedCO}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a change order..." />
                </SelectTrigger>
                <SelectContent>
                  {availableCOs.map((co) => (
                    <SelectItem key={co.id} value={co.id}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{co.number} - {co.reason}</span>
                        <span className="text-primary font-medium">
                          {formatCurrency(co.total)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Arrow */}
          {selectedCO && (
            <div className="flex justify-center">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>
          )}

          {/* Purchase Order Selection */}
          <div className="space-y-2">
            <Label>Select Purchase Order</Label>
            {loadingPOs ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : !purchaseOrders || purchaseOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No purchase orders for this project. Create a PO first.
              </p>
            ) : (
              <Select 
                value={selectedPO} 
                onValueChange={setSelectedPO}
                disabled={!!preSelectedPO}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a purchase order..." />
                </SelectTrigger>
                <SelectContent>
                  {purchaseOrders.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        <span>{po.number} - {po.vendor_name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Preview */}
          {selectedChangeOrder && selectedPurchaseOrder && selectedCOData && (
            <div className="p-4 rounded-lg border border-border bg-secondary/20 space-y-2">
              <p className="text-sm font-medium">Import Preview:</p>
              <p className="text-sm text-muted-foreground">
                <strong>{selectedChangeOrder.number}</strong> will be added as an addendum to <strong>{selectedPurchaseOrder.number}</strong> ({selectedPurchaseOrder.vendor_name})
              </p>
              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border mt-2">
                <p>{selectedCOData.line_items?.length || 0} line items will be imported</p>
                <p>Client Total: {formatCurrency(selectedChangeOrder.total)}</p>
                <p>Vendor Cost (PO Amount): {formatCurrency(
                  selectedCOData.line_items?.reduce((sum, item) => sum + (item.quantity * (item.vendor_cost || 0)), 0) || 0
                )}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!selectedCO || !selectedPO || addAddendum.isPending}
          >
            {addAddendum.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Import as Addendum
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
