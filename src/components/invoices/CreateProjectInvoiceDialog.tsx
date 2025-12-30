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
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CalendarIcon, FileText, ClipboardList, Receipt, Loader2, List, FileStack, ChevronDown, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectBillableItems, BillableItem } from "@/integrations/supabase/hooks/useProjectBillableItems";
import { useAddProjectInvoice } from "@/integrations/supabase/hooks/useProjectInvoice";
import { useJobOrder } from "@/integrations/supabase/hooks/useJobOrders";
import { useSelectedBillableItemsTotals } from "@/components/invoices/BillableItemsSelector";
import { getNextInvoiceNumber } from "@/utils/invoiceNumberGenerator";
import { toast } from "@/hooks/use-toast";
import { PendingAttachmentsUpload, PendingFile } from "@/components/shared/PendingAttachmentsUpload";
import { finalizeAttachments, cleanupPendingAttachments } from "@/utils/attachmentUtils";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAYMENT_TERMS = [
  { value: "due_on_receipt", label: "Due on Receipt", days: 0 },
  { value: "net_15", label: "Net 15", days: 15 },
  { value: "net_30", label: "Net 30", days: 30 },
  { value: "net_45", label: "Net 45", days: 45 },
  { value: "net_60", label: "Net 60", days: 60 },
  { value: "custom", label: "Custom Date", days: null },
];

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
  const { user } = useAuth();

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [dueDate, setDueDate] = useState<Date>(addDays(new Date(), 30));
  const [status, setStatus] = useState<"draft" | "sent">("draft");
  const [taxRate, setTaxRate] = useState(8.25);
  const [isLoadingNumber, setIsLoadingNumber] = useState(false);
  const [numberSource, setNumberSource] = useState<'quickbooks' | 'local'>('local');
  const [jobOrderBillingMode, setJobOrderBillingMode] = useState<"summary" | "detailed">("detailed");
  
  // Additional options state
  const [paymentTerms, setPaymentTerms] = useState("net_30");
  const [customerPo, setCustomerPo] = useState("");
  const [notes, setNotes] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingFile[]>([]);
  const [additionalOptionsOpen, setAdditionalOptionsOpen] = useState(false);

  // Update due date when payment terms change
  useEffect(() => {
    const term = PAYMENT_TERMS.find(t => t.value === paymentTerms);
    if (term && term.days !== null) {
      setDueDate(addDays(new Date(), term.days));
    }
  }, [paymentTerms]);

  // Generate invoice number and reset state on open
  useEffect(() => {
    if (open) {
      const fetchInvoiceNumber = async () => {
        setIsLoadingNumber(true);
        try {
          const { number, source } = await getNextInvoiceNumber();
          setInvoiceNumber(number);
          setNumberSource(source);
        } catch (error) {
          console.error('Failed to get invoice number:', error);
          setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
          setNumberSource('local');
        } finally {
          setIsLoadingNumber(false);
        }
      };
      fetchInvoiceNumber();
      setSelectedItems(new Set());
      setPaymentTerms("net_30");
      setCustomerPo("");
      setNotes("");
      setPendingAttachments([]);
      setAdditionalOptionsOpen(false);
    } else {
      // Cleanup pending attachments when dialog closes
      if (pendingAttachments.length > 0) {
        cleanupPendingAttachments(pendingAttachments);
        setPendingAttachments([]);
      }
    }
  }, [open]);

  const allItems = useMemo(() => {
    if (!billableItems) return [];
    return [
      ...billableItems.jobOrders,
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

  // Get the first selected Job Order ID for detailed line items fetching
  const selectedJobOrderId = useMemo(() => {
    const selectedJO = selectedItemsData.find(item => item.type === 'job_order');
    return selectedJO?.id || null;
  }, [selectedItemsData]);

  // Fetch JO line items when in detailed mode
  const { data: jobOrderWithLineItems } = useJobOrder(selectedJobOrderId || '');

  // Use the shared hook for line items and totals calculation
  const billableItemsTotals = useSelectedBillableItemsTotals(
    projectId,
    Array.from(selectedItems),
    taxRate,
    jobOrderBillingMode,
    jobOrderWithLineItems
  );

  const totals = {
    subtotal: billableItemsTotals.subtotal,
    taxAmount: billableItemsTotals.taxAmount,
    total: billableItemsTotals.total,
  };

  const handleSubmit = async () => {
    if (selectedItems.size === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one item to invoice.",
        variant: "destructive",
      });
      return;
    }

    // Use the line items and IDs from the shared hook
    const lineItems = billableItemsTotals.lineItems.map((item, index) => ({
      ...item,
      display_order: index,
    }));

    try {
      const result = await addInvoice.mutateAsync({
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
        job_order_ids: billableItemsTotals.jobOrderIds,
        change_order_ids: billableItemsTotals.changeOrderIds,
        tm_ticket_ids: billableItemsTotals.tmTicketIds,
        notes: notes || undefined,
        customer_po: customerPo || undefined,
      });

      // Finalize attachments if any
      if (pendingAttachments.length > 0 && result?.id && user?.id) {
        await finalizeAttachments(pendingAttachments, result.id, 'invoice', user.id);
        setPendingAttachments([]);
      }

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
              <div className="flex items-center gap-2">
                {/* Job Order Billing Mode Toggle */}
                {billableItems?.jobOrders && billableItems.jobOrders.length > 0 && (
                  <div className="flex items-center border rounded-md overflow-hidden">
                    <Button
                      type="button"
                      variant={jobOrderBillingMode === "detailed" ? "default" : "ghost"}
                      size="sm"
                      className="rounded-none h-8 px-3"
                      onClick={() => setJobOrderBillingMode("detailed")}
                    >
                      <List className="h-3.5 w-3.5 mr-1" />
                      Detailed
                    </Button>
                    <Button
                      type="button"
                      variant={jobOrderBillingMode === "summary" ? "default" : "ghost"}
                      size="sm"
                      className="rounded-none h-8 px-3"
                      onClick={() => setJobOrderBillingMode("summary")}
                    >
                      <FileStack className="h-3.5 w-3.5 mr-1" />
                      Summary
                    </Button>
                  </div>
                )}
                {allItems.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={selectAll}>
                    {selectedItems.size === allItems.length ? "Deselect All" : "Select All"}
                  </Button>
                )}
              </div>
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
                {billableItems?.jobOrders.map((jo) => (
                  <div
                    key={jo.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedItems.has(jo.id) ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
                    )}
                    onClick={() => toggleItem(jo.id)}
                  >
                    <Checkbox 
                      checked={selectedItems.has(jo.id)} 
                      onCheckedChange={() => toggleItem(jo.id)}
                      onClick={(e) => e.stopPropagation()}
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
                      onClick={(e) => e.stopPropagation()}
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
                      onClick={(e) => e.stopPropagation()}
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

          {/* Invoice Line Items Preview */}
          {selectedItems.size > 0 && billableItemsTotals.lineItems.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Invoice Line Items Preview</Label>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[40%]">Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billableItemsTotals.lineItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{item.product_name}</span>
                            {item.description && item.description !== item.product_name && (
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Totals */}
          {selectedItems.size > 0 && (
            <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Subtotal ({billableItemsTotals.lineItems.length} line items)</span>
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
              <div className="flex gap-2 items-center">
                {isLoadingNumber ? (
                  <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50 flex-1">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading...</span>
                  </div>
                ) : (
                  <Input
                    id="invoiceNumber"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="flex-1"
                  />
                )}
                {numberSource === 'quickbooks' && !isLoadingNumber && (
                  <Badge variant="secondary" className="text-xs whitespace-nowrap">
                    QuickBooks
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Terms</Label>
              <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS.map((term) => (
                    <SelectItem key={term.value} value={term.value}>
                      {term.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                    disabled={paymentTerms !== "custom"}
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
            <div className="space-y-2">
              <Label>Customer PO #</Label>
              <Input
                placeholder="Optional"
                value={customerPo}
                onChange={(e) => setCustomerPo(e.target.value)}
              />
            </div>
          </div>

          {/* Additional Options */}
          <Collapsible open={additionalOptionsOpen} onOpenChange={setAdditionalOptionsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Additional Options
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", additionalOptionsOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Notes / Memo</Label>
                <Textarea
                  placeholder="Add notes that will appear on the invoice..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Attachments</Label>
                <PendingAttachmentsUpload
                  entityType="invoice"
                  pendingFiles={pendingAttachments}
                  onFilesChange={setPendingAttachments}
                  compact
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
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
