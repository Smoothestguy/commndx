import { useMemo } from "react";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ClipboardList, FileText, Receipt, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectBillableItems, BillableItem } from "@/integrations/supabase/hooks/useProjectBillableItems";

interface BillableItemsSelectorProps {
  projectId: string | undefined;
  selectedItems: string[];
  onSelectionChange: (newSelection: string[]) => void;
  preSelectedJobOrderId?: string;
}

export const BillableItemsSelector = ({
  projectId,
  selectedItems,
  onSelectionChange,
  preSelectedJobOrderId,
}: BillableItemsSelectorProps) => {
  const { data: billableItems, isLoading } = useProjectBillableItems(projectId);

  const allItems = useMemo(() => {
    if (!billableItems) return [];
    return [
      ...billableItems.jobOrders,
      ...billableItems.changeOrders,
      ...billableItems.tmTickets,
    ];
  }, [billableItems]);

  const toggleItem = (itemId: string) => {
    if (selectedItems.includes(itemId)) {
      onSelectionChange(selectedItems.filter(id => id !== itemId));
    } else {
      onSelectionChange([...selectedItems, itemId]);
    }
  };

  const selectAll = () => {
    if (selectedItems.length === allItems.length) {
      // Keep at least the pre-selected job order if one exists
      if (preSelectedJobOrderId) {
        onSelectionChange([preSelectedJobOrderId]);
      } else {
        onSelectionChange([]);
      }
    } else {
      onSelectionChange(allItems.map(item => item.id));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (!projectId) {
    return null;
  }

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">Select Items to Invoice</Label>
          {allItems.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
              {selectedItems.length === allItems.length ? "Deselect All" : "Select All"}
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : allItems.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No uninvoiced items found for this project.
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto border rounded-lg p-2">
            {/* Job Orders */}
            {billableItems?.jobOrders.map((jo) => (
              <div
                key={jo.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  selectedItems.includes(jo.id) ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
                )}
                onClick={() => toggleItem(jo.id)}
              >
                <Checkbox 
                  checked={selectedItems.includes(jo.id)} 
                  onClick={(e) => e.stopPropagation()}
                  onCheckedChange={() => toggleItem(jo.id)}
                />
                <ClipboardList className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{jo.number}</span>
                    <Badge variant="outline" className="text-xs">Job Order</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">Remaining balance</p>
                </div>
                <span className="font-medium text-green-600">
                  +{formatCurrency(jo.remaining_amount)}
                </span>
              </div>
            ))}

            {/* Change Orders */}
            {billableItems?.changeOrders.map((co) => (
              <div
                key={co.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  selectedItems.includes(co.id) ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
                )}
                onClick={() => toggleItem(co.id)}
              >
                <Checkbox 
                  checked={selectedItems.includes(co.id)} 
                  onClick={(e) => e.stopPropagation()}
                  onCheckedChange={() => toggleItem(co.id)}
                />
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{co.number}</span>
                    <Badge variant={co.change_type === 'additive' ? 'default' : 'secondary'} className="text-xs">
                      {co.change_type === 'additive' ? '+' : '-'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{co.reason}</p>
                </div>
                <span className={cn(
                  "font-medium",
                  co.change_type === 'deductive' ? "text-destructive" : "text-green-600"
                )}>
                  {co.change_type === 'deductive' ? '-' : '+'}{formatCurrency(co.total)}
                </span>
              </div>
            ))}

            {/* T&M Tickets */}
            {billableItems?.tmTickets.map((tm) => (
              <div
                key={tm.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  selectedItems.includes(tm.id) ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
                )}
                onClick={() => toggleItem(tm.id)}
              >
                <Checkbox 
                  checked={selectedItems.includes(tm.id)} 
                  onClick={(e) => e.stopPropagation()}
                  onCheckedChange={() => toggleItem(tm.id)}
                />
                <Receipt className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{tm.ticket_number}</span>
                    <Badge variant={tm.change_type === 'additive' ? 'default' : 'secondary'} className="text-xs">
                      {tm.change_type === 'additive' ? '+' : '-'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {tm.description || `Work date: ${format(new Date(tm.work_date), "MMM d, yyyy")}`}
                  </p>
                </div>
                <span className={cn(
                  "font-medium",
                  tm.change_type === 'deductive' ? "text-destructive" : "text-green-600"
                )}>
                  {tm.change_type === 'deductive' ? '-' : '+'}{formatCurrency(tm.total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

const EMPTY_RESULT = { 
  subtotal: 0, 
  taxAmount: 0, 
  total: 0, 
  lineItems: [] as any[],
  jobOrderIds: [] as string[],
  changeOrderIds: [] as string[],
  tmTicketIds: [] as string[],
  selectedCount: 0,
};

interface JobOrderLineItem {
  id?: string;
  product_id?: string;
  product_name?: string;
  description: string;
  quantity: number;
  unit_price: number;
  markup: number;
  total: number;
  invoiced_quantity?: number;
  is_taxable?: boolean;
}

interface JobOrderWithLineItems {
  id: string;
  number: string;
  line_items?: JobOrderLineItem[];
}

export const useSelectedBillableItemsTotals = (
  projectId: string | undefined,
  selectedItems: string[],
  taxRate: number,
  jobOrderBillingMode: "summary" | "detailed" = "detailed",
  jobOrderWithLineItems?: JobOrderWithLineItems | null
) => {
  const { data: billableItems } = useProjectBillableItems(projectId);

  return useMemo(() => {
    if (!billableItems || selectedItems.length === 0) return EMPTY_RESULT;

    const allItems = [
      ...billableItems.jobOrders,
      ...billableItems.changeOrders,
      ...billableItems.tmTickets,
    ];

    const selectedItemsData = allItems.filter(item => selectedItems.includes(item.id));
    
    // Separate JOs from other items
    const selectedJobOrders = selectedItemsData.filter(item => item.type === 'job_order');
    const selectedOtherItems = selectedItemsData.filter(item => item.type !== 'job_order');

    // Build line items based on billing mode
    let lineItems: any[] = [];
    let displayOrderCounter = 0;
    
    // Handle Job Orders based on billing mode
    for (const jo of selectedJobOrders) {
      if (jobOrderBillingMode === 'detailed' && 
          jobOrderWithLineItems && 
          jobOrderWithLineItems.id === jo.id && 
          jobOrderWithLineItems.line_items && 
          jobOrderWithLineItems.line_items.length > 0) {
        // Use detailed line items from the job order
        for (const lineItem of jobOrderWithLineItems.line_items) {
          lineItems.push({
            product_id: lineItem.product_id,
            product_name: lineItem.product_name || lineItem.description,
            description: lineItem.description,
            quantity: lineItem.quantity,
            unit_price: lineItem.unit_price,
            markup: lineItem.markup,
            total: lineItem.total,
            is_taxable: lineItem.is_taxable ?? true,
            display_order: displayOrderCounter++,
          });
        }
      } else {
        // Summary mode: single line per JO
        lineItems.push({
          product_id: null,
          product_name: `Job Order ${jo.number}`,
          description: 'Remaining balance',
          quantity: 1,
          unit_price: jo.remaining_amount,
          markup: 0,
          total: jo.remaining_amount,
          is_taxable: true,
          display_order: displayOrderCounter++,
        });
      }
    }

    // Handle Change Orders and T&M Tickets (always summary)
    for (const item of selectedOtherItems) {
      if (item.type === 'change_order') {
        const amount = item.change_type === 'deductive' ? -item.total : item.total;
        lineItems.push({
          product_id: null,
          product_name: `Change Order ${item.number}`,
          description: item.reason,
          quantity: 1,
          unit_price: amount,
          markup: 0,
          total: amount,
          is_taxable: true,
          display_order: displayOrderCounter++,
        });
      } else if (item.type === 'tm_ticket') {
        const amount = item.change_type === 'deductive' ? -item.total : item.total;
        lineItems.push({
          product_id: null,
          product_name: `T&M Ticket ${item.ticket_number}`,
          description: item.description || 'Time & Materials',
          quantity: 1,
          unit_price: amount,
          markup: 0,
          total: amount,
          is_taxable: true,
          display_order: displayOrderCounter++,
        });
      }
    }

    // Calculate subtotal from line items
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    
    // Calculate tax only on taxable items
    const taxableSubtotal = lineItems
      .filter(item => item.is_taxable !== false)
      .reduce((sum, item) => sum + item.total, 0);
    const taxAmount = Math.round(taxableSubtotal * (taxRate / 100) * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    // Extract IDs by type for submission
    const jobOrderIds = selectedItemsData
      .filter(item => item.type === 'job_order')
      .map(item => item.id);

    const changeOrderIds = selectedItemsData
      .filter(item => item.type === 'change_order')
      .map(item => item.id);
    
    const tmTicketIds = selectedItemsData
      .filter(item => item.type === 'tm_ticket')
      .map(item => item.id);

    return { 
      subtotal, 
      taxAmount, 
      total, 
      lineItems,
      jobOrderIds,
      changeOrderIds,
      tmTicketIds,
      selectedCount: selectedItemsData.length,
    };
  }, [billableItems, selectedItems, taxRate, jobOrderBillingMode, jobOrderWithLineItems]);
};
