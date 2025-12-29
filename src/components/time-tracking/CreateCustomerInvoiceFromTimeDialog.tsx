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
import { Loader2, Receipt, AlertTriangle, Edit, Info } from "lucide-react";
import { format, nextFriday, startOfWeek, endOfWeek } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  const [selectedBrackets, setSelectedBrackets] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [personnelRateBrackets, setPersonnelRateBrackets] = useState<PersonnelRateBracketMap>({});
  const [isLoading, setIsLoading] = useState(false);

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

  // Calculate date range for invoice description
  const dateRange = useMemo(() => {
    const dates = selectedEntries.filter(e => !e.invoice_id).map(e => new Date(e.entry_date));
    if (dates.length === 0) return null;
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    const weekStart = startOfWeek(minDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(maxDate, { weekStartsOn: 1 });
    return {
      start: format(weekStart, "MMM d"),
      end: format(weekEnd, "MMM d, yyyy"),
    };
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
            overtime_multiplier
          )
        `)
        .eq('project_id', projectId)
        .in('personnel_id', personnelIds)
        .eq('status', 'active');

      if (!error && data) {
        const rateMap: PersonnelRateBracketMap = {};
        data.forEach(a => {
          const bracket = a.project_rate_brackets as any;
          if (bracket && a.personnel_id) {
            rateMap[a.personnel_id] = {
              rateBracketId: bracket.id,
              rateBracketName: bracket.name,
              billRate: bracket.bill_rate || 0,
              overtimeMultiplier: bracket.overtime_multiplier || 1.5,
            };
          } else if (a.personnel_id) {
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

  // Initialize selected brackets when dialog opens
  useEffect(() => {
    if (open && rateBracketSummaries.length > 0) {
      setSelectedBrackets(new Set(rateBracketSummaries.map(b => b.rateBracketId)));
    }
  }, [open, rateBracketSummaries.length]);

  const selectedSummaries = useMemo(() =>
    rateBracketSummaries.filter(b => selectedBrackets.has(b.rateBracketId)),
    [rateBracketSummaries, selectedBrackets]
  );

  const subtotal = useMemo(() =>
    selectedSummaries.reduce((sum, b) => sum + b.totalBillable, 0),
    [selectedSummaries]
  );

  const taxRate = 0;
  const taxAmount = subtotal * (taxRate / 100);
  const totalAmount = subtotal + taxAmount;

  const totalHours = useMemo(() =>
    selectedSummaries.reduce((sum, b) => sum + b.totalHours, 0),
    [selectedSummaries]
  );

  const toggleBracket = (bracketId: string) => {
    const newSelected = new Set(selectedBrackets);
    if (newSelected.has(bracketId)) {
      newSelected.delete(bracketId);
    } else {
      newSelected.add(bracketId);
    }
    setSelectedBrackets(newSelected);
  };

  const toggleAll = () => {
    if (selectedBrackets.size === rateBracketSummaries.length) {
      setSelectedBrackets(new Set());
    } else {
      setSelectedBrackets(new Set(rateBracketSummaries.map(b => b.rateBracketId)));
    }
  };

  const handleCreate = async () => {
    if (!customerId || selectedSummaries.length === 0) {
      toast.error("No customer assigned to this project or no roles selected");
      return;
    }

    if (personnelWithoutRateBrackets.length > 0) {
      toast.error("Cannot invoice: Some personnel have no rate bracket assigned");
      return;
    }

    // Validate that all selected brackets have bill rates
    const missingBillRates = selectedSummaries.filter(s => !s.billRate || s.billRate <= 0);
    if (missingBillRates.length > 0) {
      toast.error(`Missing bill rate for: ${missingBillRates.map(s => s.rateBracketName).join(', ')}`);
      return;
    }

    setIsSubmitting(true);

    try {
      // Get fresh invoice number from QuickBooks (or local fallback)
      const { number: invoiceNumber, source } = await getNextInvoiceNumber();
      console.log(`Generated invoice number ${invoiceNumber} from ${source}`);

      const lineItems: Array<{
        description: string;
        quantity: number;
        unit_price: number;
        markup: number;
        total: number;
      }> = [];

      const weekDescription = dateRange ? `, Week of ${dateRange.start} – ${dateRange.end}` : '';

      // Create separate line items for regular and overtime per role
      selectedSummaries.forEach((summary) => {
        // Regular time line item
        if (summary.regularHours > 0) {
          lineItems.push({
            description: `${summary.rateBracketName} – Regular Time${weekDescription}`,
            quantity: summary.regularHours,
            unit_price: summary.billRate,
            markup: 0,
            total: summary.regularBillable,
          });
        }

        // Overtime line item (only if there's overtime)
        if (summary.overtimeHours > 0) {
          const otRate = summary.billRate * summary.overtimeMultiplier;
          lineItems.push({
            description: `${summary.rateBracketName} – Overtime${weekDescription}`,
            quantity: summary.overtimeHours,
            unit_price: otRate,
            markup: 0,
            total: summary.overtimeBillable,
          });
        }
      });

      // Collect all entry IDs to update
      const entryIdsToUpdate = selectedSummaries.flatMap(s => s.entryIds);

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
    setSelectedBrackets(new Set());
    onOpenChange(false);
  };

  const navigateToExistingInvoice = (invoiceId: string) => {
    onOpenChange(false);
    navigate(`/invoices/${invoiceId}`);
  };

  const hasValidEntries = rateBracketSummaries.length > 0;
  const canCreateInvoice = hasValidEntries && selectedSummaries.length > 0 && customerId && personnelWithoutRateBrackets.length === 0;

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

          {/* Rate Bracket Selection */}
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rateBracketSummaries.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Select Roles to Invoice</Label>
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {selectedBrackets.size === rateBracketSummaries.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedBrackets.size === rateBracketSummaries.length && rateBracketSummaries.length > 0}
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead>Role / Rate Bracket</TableHead>
                      <TableHead className="text-right">Regular</TableHead>
                      <TableHead className="text-right">Overtime</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rateBracketSummaries.map((summary) => {
                      const hasMissingRate = !summary.billRate || summary.billRate <= 0;
                      
                      return (
                        <TableRow
                          key={summary.rateBracketId}
                          className={!selectedBrackets.has(summary.rateBracketId) ? 'opacity-50' : hasMissingRate ? 'bg-destructive/10' : ''}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedBrackets.has(summary.rateBracketId)}
                              onCheckedChange={() => toggleBracket(summary.rateBracketId)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {summary.rateBracketName}
                              {hasMissingRate && (
                                <Badge variant="destructive" className="text-xs">
                                  No Bill Rate
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {summary.regularHours.toFixed(1)}h
                          </TableCell>
                          <TableCell className="text-right">
                            {summary.overtimeHours > 0 ? (
                              <span className="text-orange-500">{summary.overtimeHours.toFixed(1)}h</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {hasMissingRate ? (
                              <span className="text-destructive">$0.00</span>
                            ) : (
                              formatCurrency(summary.totalBillable)
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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
              <span className="text-muted-foreground">Selected Roles</span>
              <span>{selectedSummaries.length} of {rateBracketSummaries.length}</span>
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
