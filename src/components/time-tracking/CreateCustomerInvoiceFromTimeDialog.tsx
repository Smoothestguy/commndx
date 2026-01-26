import { useState, useMemo, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Receipt, AlertTriangle, Edit, Info } from "lucide-react";
import { format, nextFriday, startOfWeek, endOfWeek } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { TimeEntryWithDetails } from "@/integrations/supabase/hooks/useTimeEntries";
import { useAddInvoice } from "@/integrations/supabase/hooks/useInvoices";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getNextInvoiceNumber } from "@/utils/invoiceNumberGenerator";

interface RateBracketSummary {
  rateBracketId: string;
  rateBracketName: string;
  billRate: number;
  overtimeMultiplier: number;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  regularBillable: number;
  overtimeBillable: number;
  totalBillable: number;
  entryIds: string[];
}

interface PersonnelRateBracketMap {
  [personnelId: string]: {
    rateBracketId: string;
    rateBracketName: string;
    billRate: number;
    overtimeMultiplier: number;
  } | null;
}

interface LineItemDescription {
  bracketId: string;
  type: 'regular' | 'overtime';
  productName: string;
  description: string;
  selected: boolean;
  hours: number;
  rate: number;
  total: number;
}

interface CreateCustomerInvoiceFromTimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEntries: TimeEntryWithDetails[];
  onSuccess?: () => void;
}

export function CreateCustomerInvoiceFromTimeDialog({
  open,
  onOpenChange,
  selectedEntries,
  onSuccess,
}: CreateCustomerInvoiceFromTimeDialogProps) {
  const navigate = useNavigate();
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(format(nextFriday(new Date()), "yyyy-MM-dd"));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [personnelRateBrackets, setPersonnelRateBrackets] = useState<PersonnelRateBracketMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lineItemDescriptions, setLineItemDescriptions] = useState<LineItemDescription[]>([]);

  const { data: companySettings } = useCompanySettings();
  const addInvoice = useAddInvoice();

  const weeklyOvertimeThreshold = companySettings?.weekly_overtime_threshold ?? 40;

  // Get project and customer info from first entry
  const projectInfo = selectedEntries[0]?.projects;
  const projectId = selectedEntries[0]?.project_id;
  const customerId = projectInfo?.customer_id;
  const customerName = projectInfo?.customers?.name || "Unknown Customer";

  // Check for already invoiced entries
  const alreadyInvoicedEntries = selectedEntries.filter(e => e.invoice_id);
  const hasAlreadyInvoiced = alreadyInvoicedEntries.length > 0;

  // Calculate week labels for invoice description - shows actual selected weeks, not expanded range
  const weekLabels = useMemo(() => {
    const dates = selectedEntries.filter(e => !e.invoice_id).map(e => new Date(e.entry_date + 'T12:00:00'));
    if (dates.length === 0) return null;
    
    // Get unique weeks (keyed by week start date)
    const weekMap = new Map<string, { start: Date; end: Date }>();
    dates.forEach(date => {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      const key = format(weekStart, "yyyy-MM-dd");
      if (!weekMap.has(key)) {
        weekMap.set(key, { start: weekStart, end: weekEnd });
      }
    });
    
    // Sort weeks chronologically
    const sortedWeeks = Array.from(weekMap.values())
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    
    if (sortedWeeks.length === 1) {
      // Single week: "Week of Dec 22 – Dec 28, 2025"
      return `Week of ${format(sortedWeeks[0].start, "MMM d")} – ${format(sortedWeeks[0].end, "MMM d, yyyy")}`;
    } else if (sortedWeeks.length === 2) {
      // Two weeks: "Weeks of Dec 22-28 & Dec 29 - Jan 4, 2026"
      const w1 = `${format(sortedWeeks[0].start, "MMM d")}-${format(sortedWeeks[0].end, "d")}`;
      const w2 = `${format(sortedWeeks[1].start, "MMM d")} – ${format(sortedWeeks[1].end, "MMM d, yyyy")}`;
      return `Weeks of ${w1} & ${w2}`;
    } else {
      // Multiple weeks: "Dec 22, 2025 – Jan 11, 2026 (3 weeks)"
      const first = sortedWeeks[0];
      const last = sortedWeeks[sortedWeeks.length - 1];
      return `${format(first.start, "MMM d, yyyy")} – ${format(last.end, "MMM d, yyyy")} (${sortedWeeks.length} weeks)`;
    }
  }, [selectedEntries]);

  // Fetch personnel rate bracket assignments for this project
  useEffect(() => {
    const fetchRateBrackets = async () => {
      if (!projectId || selectedEntries.length === 0) return;

      setIsLoading(true);
      const personnelIds = [...new Set(selectedEntries.map(e => e.personnel_id).filter(Boolean))];
      
      if (personnelIds.length === 0) {
        setIsLoading(false);
        return;
      }

      // Fetch assignments with rate bracket details
      const { data, error } = await supabase
        .from('personnel_project_assignments')
        .select(`
          personnel_id,
          rate_bracket_id,
          project_rate_brackets:rate_bracket_id(
            id,
            name,
            bill_rate,
            overtime_multiplier,
            is_billable
          )
        `)
        .eq('project_id', projectId)
        .in('personnel_id', personnelIds)
        .eq('status', 'active');

      if (!error && data) {
        const rateMap: PersonnelRateBracketMap = {};
        data.forEach(a => {
          const bracket = a.project_rate_brackets as any;
          // Skip non-billable brackets - they won't be included in invoices
          if (bracket && a.personnel_id && bracket.is_billable !== false) {
            rateMap[a.personnel_id] = {
              rateBracketId: bracket.id,
              rateBracketName: bracket.name,
              billRate: bracket.bill_rate || 0,
              overtimeMultiplier: bracket.overtime_multiplier || 1.5,
            };
          } else if (a.personnel_id) {
            // Either no bracket or non-billable - treat as no bracket for invoicing
            rateMap[a.personnel_id] = null;
          }
        });
        setPersonnelRateBrackets(rateMap);
      }
      setIsLoading(false);
    };

    if (open) {
      fetchRateBrackets();
    }
  }, [open, projectId, selectedEntries]);

  // Find personnel without rate brackets
  const personnelWithoutRateBrackets = useMemo(() => {
    const entriesToProcess = selectedEntries.filter(e => !e.invoice_id && e.personnel_id);
    const uniquePersonnel = new Map<string, string>();
    
    entriesToProcess.forEach(entry => {
      if (entry.personnel_id && !personnelRateBrackets[entry.personnel_id]) {
        const name = entry.personnel 
          ? `${entry.personnel.first_name} ${entry.personnel.last_name}`
          : "Unknown";
        uniquePersonnel.set(entry.personnel_id, name);
      }
    });
    
    return Array.from(uniquePersonnel.entries()).map(([id, name]) => ({ id, name }));
  }, [selectedEntries, personnelRateBrackets]);

  // Group entries by rate bracket and calculate summaries
  const rateBracketSummaries = useMemo(() => {
    const groups = new Map<string, RateBracketSummary>();

    // Only process non-invoiced entries that have personnel with rate brackets
    const entriesToProcess = selectedEntries.filter(e => !e.invoice_id && e.personnel_id);

    // First, calculate total hours per personnel (for OT calculation)
    const personnelHours = new Map<string, number>();
    entriesToProcess.forEach(entry => {
      if (entry.personnel_id) {
        const current = personnelHours.get(entry.personnel_id) || 0;
        personnelHours.set(entry.personnel_id, current + Number(entry.hours));
      }
    });

    // Now group by rate bracket, tracking regular vs OT hours
    entriesToProcess.forEach((entry) => {
      if (!entry.personnel_id) return;
      
      const bracketInfo = personnelRateBrackets[entry.personnel_id];
      if (!bracketInfo) return; // Skip if no rate bracket assigned

      const totalPersonnelHours = personnelHours.get(entry.personnel_id) || 0;
      const entryHours = Number(entry.hours);
      
      if (!groups.has(bracketInfo.rateBracketId)) {
        groups.set(bracketInfo.rateBracketId, {
          rateBracketId: bracketInfo.rateBracketId,
          rateBracketName: bracketInfo.rateBracketName,
          billRate: bracketInfo.billRate,
          overtimeMultiplier: bracketInfo.overtimeMultiplier,
          totalHours: 0,
          regularHours: 0,
          overtimeHours: 0,
          regularBillable: 0,
          overtimeBillable: 0,
          totalBillable: 0,
          entryIds: [],
        });
      }

      const summary = groups.get(bracketInfo.rateBracketId)!;
      summary.totalHours += entryHours;
      summary.entryIds.push(entry.id);
    });

    // Calculate overtime per bracket based on personnel overtime
    // (aggregate overtime from each personnel into their bracket)
    const personnelBracketHours = new Map<string, Map<string, { regular: number; ot: number }>>();
    
    personnelHours.forEach((totalHours, personnelId) => {
      const bracketInfo = personnelRateBrackets[personnelId];
      if (!bracketInfo) return;
      
      const regularHours = Math.min(totalHours, weeklyOvertimeThreshold);
      const overtimeHours = Math.max(0, totalHours - weeklyOvertimeThreshold);
      
      if (!personnelBracketHours.has(bracketInfo.rateBracketId)) {
        personnelBracketHours.set(bracketInfo.rateBracketId, new Map());
      }
      personnelBracketHours.get(bracketInfo.rateBracketId)!.set(personnelId, {
        regular: regularHours,
        ot: overtimeHours,
      });
    });

    // Aggregate regular/OT hours per bracket
    groups.forEach((summary, bracketId) => {
      const bracketPersonnelHours = personnelBracketHours.get(bracketId);
      if (bracketPersonnelHours) {
        bracketPersonnelHours.forEach(({ regular, ot }) => {
          summary.regularHours += regular;
          summary.overtimeHours += ot;
        });
      }
      
      summary.regularBillable = summary.regularHours * summary.billRate;
      summary.overtimeBillable = summary.overtimeHours * summary.billRate * summary.overtimeMultiplier;
      summary.totalBillable = summary.regularBillable + summary.overtimeBillable;
    });

    return Array.from(groups.values());
  }, [selectedEntries, personnelRateBrackets, weeklyOvertimeThreshold]);

  // Generate line item descriptions when summaries change
  useEffect(() => {
    if (open && rateBracketSummaries.length > 0 && weekLabels) {
      const descriptions: LineItemDescription[] = [];
      
      rateBracketSummaries.forEach((summary) => {
        // Regular time line item
        if (summary.regularHours > 0) {
          descriptions.push({
            bracketId: summary.rateBracketId,
            type: 'regular',
            productName: `${summary.rateBracketName} - Regular Time`,
            description: `${summary.rateBracketName} - Regular Time, ${weekLabels}\n${summary.regularHours.toFixed(1)} hours @ $${summary.billRate.toFixed(2)}/hr`,
            selected: true,
            hours: summary.regularHours,
            rate: summary.billRate,
            total: summary.regularBillable,
          });
        }
        
        // Overtime line item
        if (summary.overtimeHours > 0) {
          const otRate = summary.billRate * summary.overtimeMultiplier;
          descriptions.push({
            bracketId: summary.rateBracketId,
            type: 'overtime',
            productName: `${summary.rateBracketName} - Overtime`,
            description: `${summary.rateBracketName} - Overtime, ${weekLabels}\n${summary.overtimeHours.toFixed(1)} hours @ $${otRate.toFixed(2)}/hr (${summary.overtimeMultiplier}x rate)`,
            selected: true,
            hours: summary.overtimeHours,
            rate: otRate,
            total: summary.overtimeBillable,
          });
        }
      });
      
      setLineItemDescriptions(descriptions);
    }
  }, [open, rateBracketSummaries, weekLabels]);

  // Update a line item's description
  const updateLineItemDescription = (bracketId: string, type: 'regular' | 'overtime', newDescription: string) => {
    setLineItemDescriptions(prev => 
      prev.map(item => 
        item.bracketId === bracketId && item.type === type 
          ? { ...item, description: newDescription }
          : item
      )
    );
  };

  // Toggle a line item's selection
  const toggleLineItem = (bracketId: string, type: 'regular' | 'overtime') => {
    setLineItemDescriptions(prev => 
      prev.map(item => 
        item.bracketId === bracketId && item.type === type 
          ? { ...item, selected: !item.selected }
          : item
      )
    );
  };

  // Toggle all line items
  const toggleAllLineItems = () => {
    const allSelected = lineItemDescriptions.every(item => item.selected);
    setLineItemDescriptions(prev => 
      prev.map(item => ({ ...item, selected: !allSelected }))
    );
  };

  const selectedLineItems = useMemo(() => 
    lineItemDescriptions.filter(item => item.selected),
    [lineItemDescriptions]
  );

  const subtotal = useMemo(() =>
    selectedLineItems.reduce((sum, item) => sum + item.total, 0),
    [selectedLineItems]
  );

  const taxRate = 0;
  const taxAmount = subtotal * (taxRate / 100);
  const totalAmount = subtotal + taxAmount;

  const totalHours = useMemo(() =>
    selectedLineItems.reduce((sum, item) => sum + item.hours, 0),
    [selectedLineItems]
  );

  const handleCreate = async () => {
    if (!customerId || selectedLineItems.length === 0) {
      toast.error("No customer assigned to this project or no line items selected");
      return;
    }

    if (personnelWithoutRateBrackets.length > 0) {
      toast.error("Cannot invoice: Some personnel have no rate bracket assigned");
      return;
    }

    // Validate that all selected items have rates
    const missingRates = selectedLineItems.filter(item => !item.rate || item.rate <= 0);
    if (missingRates.length > 0) {
      toast.error(`Missing bill rate for: ${missingRates.map(item => item.productName).join(', ')}`);
      return;
    }

    setIsSubmitting(true);

    try {
      // Get fresh invoice number from QuickBooks (or local fallback)
      const { number: invoiceNumber, source } = await getNextInvoiceNumber();
      console.log(`Generated invoice number ${invoiceNumber} from ${source}`);

      // Build line items from editable descriptions
      const lineItems = selectedLineItems.map(item => ({
        product_name: item.productName,
        description: item.description,
        quantity: item.hours,
        unit_price: item.rate,
        markup: 0,
        total: item.total,
      }));

      // Collect all entry IDs to update (from selected brackets)
      const selectedBracketIds = new Set(selectedLineItems.map(item => item.bracketId));
      const entryIdsToUpdate = rateBracketSummaries
        .filter(s => selectedBracketIds.has(s.rateBracketId))
        .flatMap(s => s.entryIds);

      const result = await addInvoice.mutateAsync({
        number: invoiceNumber,
        customer_id: customerId,
        customer_name: customerName,
        project_name: projectInfo?.name || null,
        due_date: dueDate,
        subtotal: subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total: totalAmount,
        status: "draft",
        line_items: lineItems.map(item => ({
          ...item,
          id: '',
          invoice_id: '',
        })),
      });

      // Update time entries with invoice_id and invoiced_at
      if (result?.id) {
        const { error: updateError } = await supabase
          .from('time_entries')
          .update({ 
            invoice_id: result.id, 
            invoiced_at: new Date().toISOString() 
          })
          .in('id', entryIdsToUpdate);

        if (updateError) {
          console.error("Error linking time entries to invoice:", updateError);
          toast.error("Invoice created but failed to link time entries");
        }
      }

      toast.success("Customer invoice created successfully");
      onOpenChange(false);
      onSuccess?.();
      
      if (result?.id) {
        navigate(`/invoices/${result.id}`);
      }
    } catch (error) {
      console.error("Error creating customer invoice:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setLineItemDescriptions([]);
    onOpenChange(false);
  };

  const navigateToExistingInvoice = (invoiceId: string) => {
    onOpenChange(false);
    navigate(`/invoices/${invoiceId}`);
  };

  const hasValidEntries = lineItemDescriptions.length > 0;
  const canCreateInvoice = hasValidEntries && selectedLineItems.length > 0 && customerId && personnelWithoutRateBrackets.length === 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Create Customer Invoice from Time Entries
          </DialogTitle>
          <DialogDescription>
            Create an invoice for the selected labor hours ({selectedEntries.length} entries)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning for already invoiced entries */}
          {hasAlreadyInvoiced && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg border border-amber-500/20">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <span className="text-sm font-medium">
                  {alreadyInvoicedEntries.length} entries already invoiced
                </span>
                <p className="text-xs">
                  These entries will be skipped. Only un-invoiced entries will be included.
                </p>
                {alreadyInvoicedEntries[0]?.invoice_id && (
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-auto p-0 text-xs"
                    onClick={() => navigateToExistingInvoice(alreadyInvoicedEntries[0].invoice_id!)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit Existing Invoice
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Warning for personnel without rate brackets */}
          {personnelWithoutRateBrackets.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <span className="text-sm font-medium">
                  {personnelWithoutRateBrackets.length} personnel without rate bracket
                </span>
                <p className="text-xs">
                  The following personnel must be assigned a rate bracket before invoicing:
                </p>
                <ul className="text-xs list-disc pl-4">
                  {personnelWithoutRateBrackets.slice(0, 5).map(p => (
                    <li key={p.id}>{p.name}</li>
                  ))}
                  {personnelWithoutRateBrackets.length > 5 && (
                    <li>...and {personnelWithoutRateBrackets.length - 5} more</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Customer Info - Auto-filled from project */}
          <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 mb-1">
              <Info className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium">Customer (from Project)</Label>
            </div>
            <p className="text-sm font-medium">{customerName}</p>
            {projectInfo?.name && (
              <p className="text-xs text-muted-foreground">Project: {projectInfo.name}</p>
            )}
          </div>

          {/* Date Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="invoiceDate">Invoice Date</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Invoice Line Items Preview */}
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : lineItemDescriptions.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Invoice Line Items Preview</Label>
                <Button variant="ghost" size="sm" onClick={toggleAllLineItems}>
                  {lineItemDescriptions.every(item => item.selected) ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <div className="space-y-3">
                {lineItemDescriptions.map((item) => {
                  const hasMissingRate = !item.rate || item.rate <= 0;
                  
                  return (
                    <div
                      key={`${item.bracketId}-${item.type}`}
                      className={`border rounded-lg p-3 transition-opacity ${!item.selected ? 'opacity-50' : ''} ${hasMissingRate ? 'border-destructive bg-destructive/5' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={item.selected}
                          onCheckedChange={() => toggleLineItem(item.bracketId, item.type)}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.productName}</span>
                              {item.type === 'overtime' && (
                                <Badge variant="outline" className="text-orange-600 border-orange-300">
                                  Overtime
                                </Badge>
                              )}
                              {hasMissingRate && (
                                <Badge variant="destructive" className="text-xs">
                                  No Bill Rate
                                </Badge>
                              )}
                            </div>
                            <span className="font-medium text-right">
                              {hasMissingRate ? (
                                <span className="text-destructive">$0.00</span>
                              ) : (
                                formatCurrency(item.total)
                              )}
                            </span>
                          </div>
                          <Textarea
                            value={item.description}
                            onChange={(e) => updateLineItemDescription(item.bracketId, item.type, e.target.value)}
                            placeholder="Enter line item description..."
                            className="min-h-[80px] text-sm"
                            disabled={!item.selected}
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{item.hours.toFixed(1)} hours @ {formatCurrency(item.rate)}/hr</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground border rounded-lg">
              {hasAlreadyInvoiced && alreadyInvoicedEntries.length === selectedEntries.length
                ? "All selected entries have already been invoiced"
                : personnelWithoutRateBrackets.length > 0
                  ? "No entries can be invoiced - assign rate brackets to personnel first"
                  : "No billable entries found"}
            </div>
          )}

          {/* Invoice Summary */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Selected Line Items</span>
              <span>{selectedLineItems.length} of {lineItemDescriptions.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Hours</span>
              <span>{totalHours.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {taxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium pt-2 border-t">
              <span>Invoice Total</span>
              <span className="text-lg">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {/* Missing customer warning */}
          {!customerId && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">
                No customer assigned to this project. Please assign a customer first.
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isSubmitting || !canCreateInvoice}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Invoice"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
