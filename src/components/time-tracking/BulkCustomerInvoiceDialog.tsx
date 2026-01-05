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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  Receipt,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Building2,
  FolderOpen,
  ExternalLink,
  Users,
} from "lucide-react";
import { format, nextFriday, startOfWeek, endOfWeek } from "date-fns";
import { formatCurrency, cn } from "@/lib/utils";
import { TimeEntryWithDetails } from "@/integrations/supabase/hooks/useTimeEntries";
import { useAddInvoice } from "@/integrations/supabase/hooks/useInvoices";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getNextInvoiceNumber } from "@/utils/invoiceNumberGenerator";
import { useQueryClient } from "@tanstack/react-query";

type Step = "configure" | "review" | "results";

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

interface ProjectGroup {
  projectId: string;
  projectName: string;
  entries: TimeEntryWithDetails[];
  totalHours: number;
}

interface CustomerGroup {
  customerId: string;
  customerName: string;
  projects: ProjectGroup[];
  entries: TimeEntryWithDetails[];
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  totalBillable: number;
  lineItems: LineItemDescription[];
  selected: boolean;
  hasRateBracketIssues: boolean;
  personnelWithoutBrackets: { id: string; name: string }[];
  rateBrackets: Map<string, {
    bracketId: string;
    bracketName: string;
    billRate: number;
    overtimeMultiplier: number;
    personnelIds: Set<string>;
    totalHours: number;
    regularHours: number;
    overtimeHours: number;
  }>;
}

interface InvoiceResult {
  customerId: string;
  customerName: string;
  invoiceId?: string;
  invoiceNumber?: string;
  success: boolean;
  error?: string;
  total: number;
  entriesLinked: number;
}

interface BulkCustomerInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEntries: TimeEntryWithDetails[];
  onSuccess?: () => void;
}

export function BulkCustomerInvoiceDialog({
  open,
  onOpenChange,
  selectedEntries,
  onSuccess,
}: BulkCustomerInvoiceDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("configure");
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(format(nextFriday(new Date()), "yyyy-MM-dd"));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingBrackets, setIsLoadingBrackets] = useState(false);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
  const [results, setResults] = useState<InvoiceResult[]>([]);

  const { data: companySettings } = useCompanySettings();
  const addInvoice = useAddInvoice();
  const weeklyOvertimeThreshold = companySettings?.weekly_overtime_threshold ?? 40;

  // Filter out already invoiced entries and entries without customers
  const validEntries = useMemo(() => {
    return selectedEntries.filter(e => !e.invoice_id && e.projects?.customer_id);
  }, [selectedEntries]);

  const alreadyInvoicedCount = selectedEntries.filter(e => e.invoice_id).length;
  const noCustomerCount = selectedEntries.filter(e => !e.invoice_id && !e.projects?.customer_id).length;

  // Fetch rate brackets and build customer groups
  useEffect(() => {
    const buildCustomerGroups = async () => {
      if (!open || validEntries.length === 0) {
        setCustomerGroups([]);
        return;
      }

      setIsLoadingBrackets(true);

      // Group entries by customer
      const customerMap = new Map<string, CustomerGroup>();

      validEntries.forEach(entry => {
        const customerId = entry.projects?.customer_id!;
        const customerName = entry.projects?.customers?.name || "Unknown Customer";
        const projectId = entry.project_id;
        const projectName = entry.projects?.name || "Unknown Project";

        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            customerId,
            customerName,
            projects: [],
            entries: [],
            totalHours: 0,
            regularHours: 0,
            overtimeHours: 0,
            totalBillable: 0,
            lineItems: [],
            selected: true,
            hasRateBracketIssues: false,
            personnelWithoutBrackets: [],
            rateBrackets: new Map(),
          });
        }

        const customer = customerMap.get(customerId)!;
        customer.entries.push(entry);
        customer.totalHours += Number(entry.hours);

        // Group by project within customer
        let projectGroup = customer.projects.find(p => p.projectId === projectId);
        if (!projectGroup) {
          projectGroup = { projectId, projectName, entries: [], totalHours: 0 };
          customer.projects.push(projectGroup);
        }
        projectGroup.entries.push(entry);
        projectGroup.totalHours += Number(entry.hours);
      });

      // Fetch rate brackets for all personnel/project combinations
      const projectIds = [...new Set(validEntries.map(e => e.project_id))];
      const personnelIds = [...new Set(validEntries.map(e => e.personnel_id).filter(Boolean))] as string[];

      const { data: assignments } = await supabase
        .from('personnel_project_assignments')
        .select(`
          personnel_id,
          project_id,
          rate_bracket_id,
          project_rate_brackets:rate_bracket_id(
            id,
            name,
            bill_rate,
            overtime_multiplier
          )
        `)
        .in('project_id', projectIds)
        .in('personnel_id', personnelIds)
        .eq('status', 'active');

      // Build a lookup map: project_id + personnel_id -> rate bracket
      const bracketLookup = new Map<string, { id: string; name: string; billRate: number; otMultiplier: number }>();
      assignments?.forEach(a => {
        const bracket = a.project_rate_brackets as any;
        if (bracket && a.personnel_id && a.project_id) {
          bracketLookup.set(`${a.project_id}-${a.personnel_id}`, {
            id: bracket.id,
            name: bracket.name,
            billRate: bracket.bill_rate || 0,
            otMultiplier: bracket.overtime_multiplier || 1.5,
          });
        }
      });

      // Process each customer
      customerMap.forEach(customer => {
        // Track personnel hours per bracket
        const personnelHours = new Map<string, number>();
        const personnelBracket = new Map<string, { id: string; name: string; billRate: number; otMultiplier: number } | null>();
        const personnelWithoutBracketsSet = new Map<string, string>();

        customer.entries.forEach(entry => {
          if (entry.personnel_id) {
            const key = `${entry.project_id}-${entry.personnel_id}`;
            const bracket = bracketLookup.get(key);
            personnelBracket.set(entry.personnel_id, bracket || null);

            const currentHours = personnelHours.get(entry.personnel_id) || 0;
            personnelHours.set(entry.personnel_id, currentHours + Number(entry.hours));

            if (!bracket) {
              const name = entry.personnel 
                ? `${entry.personnel.first_name} ${entry.personnel.last_name}`
                : "Unknown";
              personnelWithoutBracketsSet.set(entry.personnel_id, name);
            }
          }
        });

        customer.personnelWithoutBrackets = Array.from(personnelWithoutBracketsSet.entries())
          .map(([id, name]) => ({ id, name }));
        customer.hasRateBracketIssues = customer.personnelWithoutBrackets.length > 0;

        // Calculate billable amounts by rate bracket
        const bracketTotals = new Map<string, {
          bracketId: string;
          bracketName: string;
          billRate: number;
          overtimeMultiplier: number;
          personnelIds: Set<string>;
          totalHours: number;
          regularHours: number;
          overtimeHours: number;
        }>();

        personnelHours.forEach((totalHours, personnelId) => {
          const bracket = personnelBracket.get(personnelId);
          if (!bracket) return;

          const regularHours = Math.min(totalHours, weeklyOvertimeThreshold);
          const overtimeHours = Math.max(0, totalHours - weeklyOvertimeThreshold);

          if (!bracketTotals.has(bracket.id)) {
            bracketTotals.set(bracket.id, {
              bracketId: bracket.id,
              bracketName: bracket.name,
              billRate: bracket.billRate,
              overtimeMultiplier: bracket.otMultiplier,
              personnelIds: new Set(),
              totalHours: 0,
              regularHours: 0,
              overtimeHours: 0,
            });
          }

          const bt = bracketTotals.get(bracket.id)!;
          bt.personnelIds.add(personnelId);
          bt.totalHours += totalHours;
          bt.regularHours += regularHours;
          bt.overtimeHours += overtimeHours;
        });

        customer.rateBrackets = bracketTotals;

        // Calculate totals
        let totalBillable = 0;
        let totalRegular = 0;
        let totalOvertime = 0;

        bracketTotals.forEach(bt => {
          totalRegular += bt.regularHours;
          totalOvertime += bt.overtimeHours;
          totalBillable += bt.regularHours * bt.billRate + bt.overtimeHours * bt.billRate * bt.overtimeMultiplier;
        });

        customer.regularHours = totalRegular;
        customer.overtimeHours = totalOvertime;
        customer.totalBillable = totalBillable;

        // Generate line items
        const dateRange = getDateRange(customer.entries);
        const lineItems: LineItemDescription[] = [];

        bracketTotals.forEach(bt => {
          if (bt.regularHours > 0) {
            lineItems.push({
              bracketId: bt.bracketId,
              type: 'regular',
              productName: `${bt.bracketName} - Regular Time`,
              description: `${bt.bracketName} - Regular Time, ${dateRange}\n${bt.regularHours.toFixed(1)} hours @ $${bt.billRate.toFixed(2)}/hr`,
              selected: true,
              hours: bt.regularHours,
              rate: bt.billRate,
              total: bt.regularHours * bt.billRate,
            });
          }

          if (bt.overtimeHours > 0) {
            const otRate = bt.billRate * bt.overtimeMultiplier;
            lineItems.push({
              bracketId: bt.bracketId,
              type: 'overtime',
              productName: `${bt.bracketName} - Overtime`,
              description: `${bt.bracketName} - Overtime, ${dateRange}\n${bt.overtimeHours.toFixed(1)} hours @ $${otRate.toFixed(2)}/hr (${bt.overtimeMultiplier}x rate)`,
              selected: true,
              hours: bt.overtimeHours,
              rate: otRate,
              total: bt.overtimeHours * otRate,
            });
          }
        });

        customer.lineItems = lineItems;

        // If no billable line items but has entries, deselect
        if (lineItems.length === 0) {
          customer.selected = false;
        }
      });

      setCustomerGroups(Array.from(customerMap.values()).sort((a, b) => 
        a.customerName.localeCompare(b.customerName)
      ));
      setIsLoadingBrackets(false);
    };

    buildCustomerGroups();
  }, [open, validEntries, weeklyOvertimeThreshold]);

  const getDateRange = (entries: TimeEntryWithDetails[]) => {
    const dates = entries.map(e => new Date(e.entry_date));
    if (dates.length === 0) return "";
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    const weekStart = startOfWeek(minDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(maxDate, { weekStartsOn: 1 });
    return `Week of ${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;
  };

  const toggleCustomerSelection = (customerId: string) => {
    setCustomerGroups(prev => prev.map(c => 
      c.customerId === customerId ? { ...c, selected: !c.selected } : c
    ));
  };

  const toggleCustomerExpanded = (customerId: string) => {
    setExpandedCustomers(prev => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  const updateLineItemDescription = (customerId: string, bracketId: string, type: 'regular' | 'overtime', newDescription: string) => {
    setCustomerGroups(prev => prev.map(c => {
      if (c.customerId !== customerId) return c;
      return {
        ...c,
        lineItems: c.lineItems.map(li => 
          li.bracketId === bracketId && li.type === type 
            ? { ...li, description: newDescription }
            : li
        ),
      };
    }));
  };

  const toggleLineItem = (customerId: string, bracketId: string, type: 'regular' | 'overtime') => {
    setCustomerGroups(prev => prev.map(c => {
      if (c.customerId !== customerId) return c;
      const newLineItems = c.lineItems.map(li => 
        li.bracketId === bracketId && li.type === type 
          ? { ...li, selected: !li.selected }
          : li
      );
      const newTotal = newLineItems.filter(li => li.selected).reduce((sum, li) => sum + li.total, 0);
      return { ...c, lineItems: newLineItems, totalBillable: newTotal };
    }));
  };

  const selectedCustomers = customerGroups.filter(c => c.selected && c.lineItems.some(li => li.selected));

  const totals = useMemo(() => {
    let totalHours = 0;
    let totalBillable = 0;
    let customerCount = 0;

    selectedCustomers.forEach(c => {
      const selectedItems = c.lineItems.filter(li => li.selected);
      totalHours += selectedItems.reduce((sum, li) => sum + li.hours, 0);
      totalBillable += selectedItems.reduce((sum, li) => sum + li.total, 0);
      customerCount++;
    });

    return { totalHours, totalBillable, customerCount };
  }, [selectedCustomers]);

  const handleCreateInvoices = async () => {
    setIsSubmitting(true);
    const invoiceResults: InvoiceResult[] = [];

    for (const customer of selectedCustomers) {
      const selectedItems = customer.lineItems.filter(li => li.selected);
      if (selectedItems.length === 0) continue;

      try {
        // Get next invoice number
        const { number: invoiceNumber } = await getNextInvoiceNumber();

        const subtotal = selectedItems.reduce((sum, li) => sum + li.total, 0);
        const lineItems = selectedItems.map(item => ({
          id: '',
          invoice_id: '',
          product_name: item.productName,
          description: item.description,
          quantity: item.hours,
          unit_price: item.rate,
          markup: 0,
          total: item.total,
        }));

        // Get first project for the invoice
        const firstProject = customer.projects[0];

        const result = await addInvoice.mutateAsync({
          number: invoiceNumber,
          customer_id: customer.customerId,
          customer_name: customer.customerName,
          project_id: firstProject?.projectId,
          project_name: customer.projects.map(p => p.projectName).join(", "),
          due_date: dueDate,
          subtotal,
          tax_rate: 0,
          tax_amount: 0,
          total: subtotal,
          status: "draft",
          line_items: lineItems,
        });

        // Get entry IDs from selected brackets
        const selectedBracketIds = new Set(selectedItems.map(li => li.bracketId));
        const entryIdsToUpdate = customer.entries
          .filter(e => {
            if (!e.personnel_id) return false;
            // Check if this entry's personnel has a bracket that was selected
            const key = `${e.project_id}-${e.personnel_id}`;
            const bracket = customer.rateBrackets.get(
              Array.from(customer.rateBrackets.values()).find(b => b.personnelIds.has(e.personnel_id!))?.bracketId || ''
            );
            return bracket && selectedBracketIds.has(bracket.bracketId);
          })
          .map(e => e.id);

        // Link time entries to invoice
        if (result?.id && entryIdsToUpdate.length > 0) {
          await supabase
            .from('time_entries')
            .update({ 
              invoice_id: result.id, 
              invoiced_at: new Date().toISOString() 
            })
            .in('id', entryIdsToUpdate);
        }

        invoiceResults.push({
          customerId: customer.customerId,
          customerName: customer.customerName,
          invoiceId: result?.id,
          invoiceNumber: result?.number || invoiceNumber,
          success: true,
          total: subtotal,
          entriesLinked: entryIdsToUpdate.length,
        });
      } catch (error: any) {
        invoiceResults.push({
          customerId: customer.customerId,
          customerName: customer.customerName,
          success: false,
          error: error.message || "Failed to create invoice",
          total: 0,
          entriesLinked: 0,
        });
      }
    }

    setResults(invoiceResults);
    setStep("results");
    setIsSubmitting(false);
    
    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ["time_entries"] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  };

  const handleClose = () => {
    setStep("configure");
    setResults([]);
    setExpandedCustomers(new Set());
    onOpenChange(false);
  };

  const handleDone = () => {
    onSuccess?.();
    handleClose();
  };

  const successCount = results.filter(r => r.success).length;
  const totalCreated = results.reduce((sum, r) => r.success ? sum + r.total : sum, 0);
  const totalEntriesLinked = results.reduce((sum, r) => sum + r.entriesLinked, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {step === "configure" && "Bulk Create Customer Invoices"}
            {step === "review" && "Review Invoices"}
            {step === "results" && "Invoices Created"}
          </DialogTitle>
          <DialogDescription>
            {step === "configure" && `Create invoices for ${validEntries.length} time entries across ${customerGroups.length} customers`}
            {step === "review" && `Review and confirm ${selectedCustomers.length} invoices`}
            {step === "results" && `${successCount} of ${results.length} invoices created successfully`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === "configure" && (
            <div className="space-y-4">
              {/* Warnings */}
              {(alreadyInvoicedCount > 0 || noCustomerCount > 0) && (
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg border border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="text-sm space-y-1">
                    {alreadyInvoicedCount > 0 && (
                      <p>{alreadyInvoicedCount} entries already invoiced (will be skipped)</p>
                    )}
                    {noCustomerCount > 0 && (
                      <p>{noCustomerCount} entries have no customer assigned (will be skipped)</p>
                    )}
                  </div>
                </div>
              )}

              {/* Global Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Invoice Date</Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              {/* Customer Groups */}
              <div>
                <Label className="text-sm font-medium">Customers to Invoice</Label>
                <ScrollArea className="h-[350px] mt-2 rounded-lg border">
                  {isLoadingBrackets ? (
                    <div className="flex items-center justify-center h-40">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Loading rate brackets...</span>
                    </div>
                  ) : customerGroups.length === 0 ? (
                    <div className="flex items-center justify-center h-40 text-muted-foreground">
                      No valid entries to invoice
                    </div>
                  ) : (
                    <div className="p-2 space-y-2">
                      {customerGroups.map(customer => (
                        <div
                          key={customer.customerId}
                          className={cn(
                            "rounded-lg border p-3 transition-colors",
                            customer.hasRateBracketIssues && "border-amber-500/50 bg-amber-500/5",
                            !customer.hasRateBracketIssues && customer.selected && "border-primary/50 bg-primary/5",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={customer.selected}
                              onCheckedChange={() => toggleCustomerSelection(customer.customerId)}
                              disabled={customer.lineItems.length === 0}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <button
                                type="button"
                                className="flex items-center gap-2 text-left w-full"
                                onClick={() => toggleCustomerExpanded(customer.customerId)}
                              >
                                {expandedCustomers.has(customer.customerId) ? (
                                  <ChevronDown className="h-4 w-4 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 shrink-0" />
                                )}
                                <Building2 className="h-4 w-4 text-primary shrink-0" />
                                <span className="font-medium truncate">{customer.customerName}</span>
                              </button>
                              <div className="flex items-center gap-4 mt-1 ml-8 text-sm text-muted-foreground">
                                <span>{customer.totalHours.toFixed(1)}h</span>
                                <span className="font-medium text-foreground">
                                  {formatCurrency(customer.totalBillable)}
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  {customer.projects.length} project{customer.projects.length !== 1 ? 's' : ''}
                                </Badge>
                              </div>
                              {customer.hasRateBracketIssues && (
                                <div className="flex items-center gap-1 mt-1 ml-8 text-xs text-amber-600">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span>
                                    Missing rate brackets: {customer.personnelWithoutBrackets.map(p => p.name).join(", ")}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {expandedCustomers.has(customer.customerId) && (
                            <div className="mt-3 ml-8 space-y-2">
                              {customer.projects.map(project => (
                                <div key={project.projectId} className="flex items-center gap-2 text-sm">
                                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                  <span>{project.projectName}</span>
                                  <span className="text-muted-foreground">({project.totalHours.toFixed(1)}h)</span>
                                </div>
                              ))}
                              {customer.lineItems.length > 0 && (
                                <div className="mt-2 pt-2 border-t space-y-1">
                                  {customer.lineItems.map(li => (
                                    <div key={`${li.bracketId}-${li.type}`} className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground">{li.productName}</span>
                                      <span className="font-medium">{formatCurrency(li.total)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Summary */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">
                  {totals.customerCount} customer{totals.customerCount !== 1 ? 's' : ''} • {totals.totalHours.toFixed(1)} hours
                </span>
                <span className="font-semibold">{formatCurrency(totals.totalBillable)}</span>
              </div>
            </div>
          )}

          {step === "review" && (
            <ScrollArea className="h-[450px]">
              <div className="space-y-4 p-1">
                {selectedCustomers.map(customer => (
                  <div key={customer.customerId} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        <span className="font-semibold">{customer.customerName}</span>
                      </div>
                      <span className="font-medium">
                        {formatCurrency(customer.lineItems.filter(li => li.selected).reduce((sum, li) => sum + li.total, 0))}
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      {customer.lineItems.map(li => (
                        <div
                          key={`${li.bracketId}-${li.type}`}
                          className={cn(
                            "p-3 rounded-lg border transition-colors",
                            li.selected ? "bg-background" : "bg-muted/30 opacity-60"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={li.selected}
                                onCheckedChange={() => toggleLineItem(customer.customerId, li.bracketId, li.type)}
                              />
                              <span className="font-medium text-sm">{li.productName}</span>
                            </div>
                            <span className="font-medium">{formatCurrency(li.total)}</span>
                          </div>
                          <Textarea
                            value={li.description}
                            onChange={(e) => updateLineItemDescription(customer.customerId, li.bracketId, li.type, e.target.value)}
                            className="text-sm min-h-[60px]"
                            disabled={!li.selected}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {step === "results" && (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 p-1">
                {results.map(result => (
                  <div
                    key={result.customerId}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border",
                      result.success ? "bg-green-500/5 border-green-500/30" : "bg-destructive/5 border-destructive/30"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {result.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      <div>
                        <div className="font-medium">{result.customerName}</div>
                        {result.success ? (
                          <div className="text-sm text-muted-foreground">
                            {result.invoiceNumber} • {result.entriesLinked} entries linked
                          </div>
                        ) : (
                          <div className="text-sm text-destructive">{result.error}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {result.success && (
                        <>
                          <span className="font-medium">{formatCurrency(result.total)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/invoices/${result.invoiceId}`)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          {step === "configure" && (
            <>
              <div className="flex-1 text-sm text-muted-foreground">
                {totals.customerCount} invoice{totals.customerCount !== 1 ? 's' : ''} will be created
              </div>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button 
                onClick={() => setStep("review")}
                disabled={selectedCustomers.length === 0}
              >
                Next: Review
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}

          {step === "review" && (
            <>
              <Button variant="outline" onClick={() => setStep("configure")}>
                Back
              </Button>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button 
                onClick={handleCreateInvoices}
                disabled={isSubmitting || selectedCustomers.length === 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>Create {selectedCustomers.length} Invoice{selectedCustomers.length !== 1 ? 's' : ''}</>
                )}
              </Button>
            </>
          )}

          {step === "results" && (
            <>
              <div className="flex-1 text-sm">
                <span className="font-medium">{successCount} invoice{successCount !== 1 ? 's' : ''}</span>
                <span className="text-muted-foreground"> created • </span>
                <span className="font-medium">{formatCurrency(totalCreated)}</span>
                <span className="text-muted-foreground"> total • </span>
                <span className="font-medium">{totalEntriesLinked} entries</span>
                <span className="text-muted-foreground"> linked</span>
              </div>
              <Button onClick={handleDone}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
