import { useState, useMemo, useEffect } from "react";
import { format, addDays } from "date-fns";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, FileText, ClipboardList, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectBillableItems, BillableItem } from "@/integrations/supabase/hooks/useProjectBillableItems";
import { useAddProjectInvoice } from "@/integrations/supabase/hooks/useProjectInvoice";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CreateProjectInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  customerId: string;
  customerName: string;
}

export const CreateProjectInvoiceDialog = ({
  open,
  onOpenChange,
  projectId,
  projectName,
  customerId,
  customerName,
}: CreateProjectInvoiceDialogProps) => {
  const { data: billableItems, isLoading } = useProjectBillableItems(projectId);
  const addInvoice = useAddProjectInvoice();

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [dueDate, setDueDate] = useState<Date>(addDays(new Date(), 30));
  const [status, setStatus] = useState<"draft" | "sent">("draft");
  const [taxRate, setTaxRate] = useState(8.25);

  // Generate invoice number on open
  useEffect(() => {
    if (open) {
      const generateInvoiceNumber = async () => {
        const { data } = await supabase
          .from("invoices")
          .select("number")
          .order("created_at", { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          const lastNumber = data[0].number;
          const match = lastNumber.match(/INV-(\d+)/);
          if (match) {
            const nextNum = parseInt(match[1]) + 1;
            setInvoiceNumber(`INV-${nextNum.toString().padStart(4, "0")}`);
          } else {
            setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
          }
        } else {
          setInvoiceNumber("INV-0001");
        }
      };
      generateInvoiceNumber();
      setSelectedItems(new Set());
    }
  }, [open]);

  const allItems = useMemo(() => {
    if (!billableItems) return [];
    return [
      ...billableItems.changeOrders,
      ...billableItems.tmTickets,
    ];
  }, [billableItems]);

  const toggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    if (selectedItems.size === allItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(allItems.map(item => item.id)));
    }
  };

  const selectedItemsData = useMemo(() => {
    return allItems.filter(item => selectedItems.has(item.id));
  }, [allItems, selectedItems]);

  const totals = useMemo(() => {
    const subtotal = selectedItemsData.reduce((sum, item) => {
      const amount = item.change_type === 'deductive' ? -item.total : item.total;
      return sum + amount;
    }, 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  }, [selectedItemsData, taxRate]);

  const handleSubmit = async () => {
    if (selectedItems.size === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one item to invoice.",
        variant: "destructive",
      });
      return;
    }

    const changeOrderIds = selectedItemsData
      .filter(item => item.type === 'change_order')
      .map(item => item.id);
    
    const tmTicketIds = selectedItemsData
      .filter(item => item.type === 'tm_ticket')
      .map(item => item.id);

    // Create line items from selected items
    const lineItems = selectedItemsData.map((item, index) => {
      const isChangeOrder = item.type === 'change_order';
      const description = isChangeOrder 
        ? `Change Order ${(item as any).number}: ${(item as any).reason}`
        : `T&M Ticket ${(item as any).ticket_number}: ${item.description || 'Time & Materials'}`;
      
      const amount = item.change_type === 'deductive' ? -item.total : item.total;
      
      return {
        description,
        quantity: 1,
        unit_price: amount,
        markup: 0,
        total: amount,
        display_order: index,
      };
    });

    try {
      await addInvoice.mutateAsync({
        number: invoiceNumber,
        project_id: projectId,
        project_name: projectName,
        customer_id: customerId,
        customer_name: customerName,
        status,
        subtotal: totals.subtotal,
        tax_rate: taxRate,
        tax_amount: totals.taxAmount,
        total: totals.total,
        due_date: format(dueDate, "yyyy-MM-dd"),
        line_items: lineItems,
        change_order_ids: changeOrderIds,
        tm_ticket_ids: tmTicketIds,
      });

      onOpenChange(false);
    } catch (error) {
      // Error handled in mutation
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Project Invoice</DialogTitle>
          <DialogDescription>
            Select billable items to include in this invoice for {projectName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Project Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <Label className="text-muted-foreground text-xs">Project</Label>
              <p className="font-medium">{projectName}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Customer</Label>
              <p className="font-medium">{customerName}</p>
            </div>
          </div>

          {/* Billable Items Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Select Items to Invoice</Label>
              {allItems.length > 0 && (
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  {selectedItems.size === allItems.length ? "Deselect All" : "Select All"}
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : allItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No uninvoiced items found for this project.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2">
                {billableItems?.changeOrders.map((co) => (
                  <div
                    key={co.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedItems.has(co.id) ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
                    )}
                    onClick={() => toggleItem(co.id)}
                  >
                    <Checkbox 
                      checked={selectedItems.has(co.id)} 
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

                {billableItems?.tmTickets.map((tm) => (
                  <div
                    key={tm.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedItems.has(tm.id) ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
                    )}
                    onClick={() => toggleItem(tm.id)}
                  >
                    <Checkbox 
                      checked={selectedItems.has(tm.id)} 
                      onCheckedChange={() => toggleItem(tm.id)}
                    />
                    <ClipboardList className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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

          {/* Totals */}
          {selectedItems.size > 0 && (
            <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Subtotal ({selectedItems.size} items)</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax ({taxRate}%)</span>
                <span>{formatCurrency(totals.taxAmount)}</span>
              </div>
              <div className="flex justify-between font-medium text-lg border-t pt-2">
                <span>Total</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>
          )}

          {/* Invoice Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={(date) => date && setDueDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Tax Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(val) => setStatus(val as "draft" | "sent")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={selectedItems.size === 0 || addInvoice.isPending}
          >
            {addInvoice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
