import { useState, useMemo } from "react";
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
import { Loader2, Receipt, Check, AlertTriangle, Edit } from "lucide-react";
import { format, nextFriday } from "date-fns";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { TimeEntryWithDetails } from "@/integrations/supabase/hooks/useTimeEntries";
import { useAddInvoice } from "@/integrations/supabase/hooks/useInvoices";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PersonnelSummary {
  personnelId: string;
  personnelName: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  totalBillable: number; // Customer-facing billable amount
  billRate: number; // Customer billing rate (NOT shown in UI)
  entryIds: string[];
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
  const [customerId, setCustomerId] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(format(nextFriday(new Date()), "yyyy-MM-dd"));
  const [selectedPersonnel, setSelectedPersonnel] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: customers = [] } = useCustomers();
  const { data: companySettings } = useCompanySettings();
  const addInvoice = useAddInvoice();

  const overtimeMultiplier = companySettings?.overtime_multiplier ?? 1.5;
  const weeklyOvertimeThreshold = companySettings?.weekly_overtime_threshold ?? 40;
  const defaultTaxRate = companySettings?.default_tax_rate ?? 0;

  // Check for already invoiced entries
  const alreadyInvoicedEntries = selectedEntries.filter(e => e.invoice_id);
  const hasAlreadyInvoiced = alreadyInvoicedEntries.length > 0;

  // Group entries by personnel and calculate summaries
  const personnelSummaries = useMemo(() => {
    const groups = new Map<string, PersonnelSummary>();

    // Only process non-invoiced entries
    const entriesToProcess = selectedEntries.filter(e => !e.invoice_id);

    entriesToProcess.forEach((entry) => {
      const personnelId = entry.personnel_id || entry.user_id;
      const personnelName = entry.personnel 
        ? `${entry.personnel.first_name} ${entry.personnel.last_name}`
        : entry.profiles?.first_name && entry.profiles?.last_name
          ? `${entry.profiles.first_name} ${entry.profiles.last_name}`
          : entry.profiles?.email || "Unknown";
      // Use bill_rate for customer invoices (customer-facing rate)
      const billRate = (entry.personnel as any)?.bill_rate || 0;

      if (!groups.has(personnelId)) {
        groups.set(personnelId, {
          personnelId,
          personnelName,
          totalHours: 0,
          regularHours: 0,
          overtimeHours: 0,
          totalBillable: 0,
          billRate,
          entryIds: [],
        });
      }

      const summary = groups.get(personnelId)!;
      summary.totalHours += Number(entry.hours);
      summary.entryIds.push(entry.id);
    });

    // Calculate overtime and billable amounts for each personnel
    groups.forEach((summary) => {
      summary.regularHours = Math.min(summary.totalHours, weeklyOvertimeThreshold);
      summary.overtimeHours = Math.max(0, summary.totalHours - weeklyOvertimeThreshold);
      
      // Use bill_rate for customer invoicing
      const regularBillable = summary.regularHours * summary.billRate;
      const overtimeBillable = summary.overtimeHours * summary.billRate * overtimeMultiplier;
      summary.totalBillable = regularBillable + overtimeBillable;
    });

    return Array.from(groups.values());
  }, [selectedEntries, weeklyOvertimeThreshold, overtimeMultiplier]);

  // Initialize selected personnel when dialog opens
  useMemo(() => {
    if (open && selectedPersonnel.size === 0 && personnelSummaries.length > 0) {
      setSelectedPersonnel(new Set(personnelSummaries.map(p => p.personnelId)));
      // Auto-select customer from project if available
      const projectCustomerId = selectedEntries[0]?.projects?.customer_id;
      if (projectCustomerId && !customerId) {
        setCustomerId(projectCustomerId);
      }
    }
  }, [open, personnelSummaries, selectedEntries, customerId, selectedPersonnel.size]);

  const selectedSummaries = useMemo(() =>
    personnelSummaries.filter(p => selectedPersonnel.has(p.personnelId)),
    [personnelSummaries, selectedPersonnel]
  );

  const subtotal = useMemo(() =>
    selectedSummaries.reduce((sum, p) => sum + p.totalBillable, 0),
    [selectedSummaries]
  );

  const taxAmount = subtotal * (defaultTaxRate / 100);
  const totalAmount = subtotal + taxAmount;

  const totalHours = useMemo(() =>
    selectedSummaries.reduce((sum, p) => sum + p.totalHours, 0),
    [selectedSummaries]
  );

  // Get project info from first entry
  const projectInfo = selectedEntries[0]?.projects;

  const togglePersonnel = (personnelId: string) => {
    const newSelected = new Set(selectedPersonnel);
    if (newSelected.has(personnelId)) {
      newSelected.delete(personnelId);
    } else {
      newSelected.add(personnelId);
    }
    setSelectedPersonnel(newSelected);
  };

  const toggleAll = () => {
    if (selectedPersonnel.size === personnelSummaries.length) {
      setSelectedPersonnel(new Set());
    } else {
      setSelectedPersonnel(new Set(personnelSummaries.map(p => p.personnelId)));
    }
  };

  const selectedCustomer = customers.find(c => c.id === customerId);

  const handleCreate = async () => {
    if (!customerId || selectedSummaries.length === 0) {
      toast.error("Please select a customer and at least one personnel");
      return;
    }

    // Validate that all selected personnel have bill rates
    const missingBillRates = selectedSummaries.filter(s => !s.billRate || s.billRate <= 0);
    if (missingBillRates.length > 0) {
      toast.error(`Missing bill rate for: ${missingBillRates.map(s => s.personnelName).join(', ')}`);
      return;
    }

    setIsSubmitting(true);

    try {
      // Create line items - shows hours and amount (NOT rate) to customer
      const lineItems = selectedSummaries.map((summary) => ({
        description: `Labor - ${summary.personnelName} (${summary.regularHours.toFixed(1)}h${summary.overtimeHours > 0 ? ` + ${summary.overtimeHours.toFixed(1)}h OT` : ''})`,
        quantity: 1,
        unit_price: summary.totalBillable,
        markup: 0,
        total: summary.totalBillable,
      }));

      // Collect all entry IDs to update
      const entryIdsToUpdate = selectedSummaries.flatMap(s => s.entryIds);

      const result = await addInvoice.mutateAsync({
        number: '', // Auto-generated by database trigger
        customer_id: customerId,
        customer_name: selectedCustomer?.name || "Unknown",
        project_name: projectInfo?.name || null,
        due_date: dueDate,
        subtotal: subtotal,
        tax_rate: defaultTaxRate,
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
      
      // Navigate to the created invoice
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
    setCustomerId("");
    setSelectedPersonnel(new Set());
    onOpenChange(false);
  };

  // Navigate to existing invoice
  const navigateToExistingInvoice = (invoiceId: string) => {
    onOpenChange(false);
    navigate(`/invoices/${invoiceId}`);
  };

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

          {/* Customer Selection */}
          <div>
            <Label htmlFor="customer">Customer *</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select customer..." />
              </SelectTrigger>
              <SelectContent>
                {customers.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No customers found
                  </div>
                ) : (
                  customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} {customer.company && `(${customer.company})`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Project Info */}
          {projectInfo && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <Label className="text-sm">Project</Label>
              <p className="text-sm font-medium mt-1">{projectInfo.name}</p>
              {projectInfo.customers?.name && (
                <p className="text-xs text-muted-foreground">{projectInfo.customers.name}</p>
              )}
            </div>
          )}

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

          {/* Personnel Selection */}
          {personnelSummaries.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Select Personnel to Invoice</Label>
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {selectedPersonnel.size === personnelSummaries.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedPersonnel.size === personnelSummaries.length && personnelSummaries.length > 0}
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead>Personnel</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      {/* Rate column intentionally omitted - customer should not see rates */}
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {personnelSummaries.map((summary) => {
                      const hasMissingRate = !summary.billRate || summary.billRate <= 0;
                      return (
                        <TableRow
                          key={summary.personnelId}
                          className={!selectedPersonnel.has(summary.personnelId) ? 'opacity-50' : hasMissingRate ? 'bg-destructive/10' : ''}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedPersonnel.has(summary.personnelId)}
                              onCheckedChange={() => togglePersonnel(summary.personnelId)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {summary.personnelName}
                            {hasMissingRate && (
                              <Badge variant="destructive" className="ml-2 text-xs">
                                No Bill Rate
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {summary.regularHours.toFixed(1)}h
                            {summary.overtimeHours > 0 && (
                              <span className="text-orange-500 ml-1">+ {summary.overtimeHours.toFixed(1)}h OT</span>
                            )}
                          </TableCell>
                          {/* Rate column intentionally omitted - customer should not see rates */}
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
                : "No personnel data available"}
            </div>
          )}

          {/* Invoice Summary */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Selected Personnel</span>
              <span>{selectedSummaries.length} of {personnelSummaries.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Hours</span>
              <span>{totalHours.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {defaultTaxRate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({defaultTaxRate}%)</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium pt-2 border-t">
              <span>Invoice Total</span>
              <span className="text-lg">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {/* Warning if no customer selected */}
          {!customerId && customers.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">No customers found. Please create a customer first.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isSubmitting || !customerId || selectedSummaries.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Create Invoice ({formatCurrency(totalAmount)})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
