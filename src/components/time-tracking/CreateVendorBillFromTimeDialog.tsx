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
import { Loader2, FileText, AlertTriangle, Edit, User } from "lucide-react";
import { format, nextFriday, startOfWeek, endOfWeek } from "date-fns";
import { parseLocalDate } from "@/lib/dateUtils";
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
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import { useExpenseCategories } from "@/integrations/supabase/hooks/useExpenseCategories";
import { useAddVendorBill } from "@/integrations/supabase/hooks/useVendorBills";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { useQuickBooksConfig } from "@/integrations/supabase/hooks/useQuickBooks";
import { TimeEntryWithDetails } from "@/integrations/supabase/hooks/useTimeEntries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PersonnelSummary {
  personnelId: string;
  personnelName: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  totalCost: number;
  payRate: number;
  vendorId: string | null; // Staffing agency vendor
  linkedVendorId: string | null; // Self-vendor
  entryIds: string[];
}

interface CreateVendorBillFromTimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEntries: TimeEntryWithDetails[];
  onSuccess?: () => void;
}

export function CreateVendorBillFromTimeDialog({
  open,
  onOpenChange,
  selectedEntries,
  onSuccess,
}: CreateVendorBillFromTimeDialogProps) {
  const navigate = useNavigate();
  const [billDate, setBillDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(format(nextFriday(new Date()), "yyyy-MM-dd"));
  const [categoryId, setCategoryId] = useState<string>("");
  const [selectedPersonnel, setSelectedPersonnel] = useState<Set<string>>(new Set());
  const [vendorOverrides, setVendorOverrides] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customNote, setCustomNote] = useState("");

  const { data: vendors = [] } = useVendors();
  const { data: categories = [] } = useExpenseCategories();
  const { data: companySettings } = useCompanySettings();
  const addBill = useAddVendorBill();
  const { data: qbConfig } = useQuickBooksConfig();

  const overtimeMultiplier = companySettings?.overtime_multiplier ?? 1.5;
  const weeklyOvertimeThreshold = companySettings?.weekly_overtime_threshold ?? 40;

  // Filter to only labor vendors
  const laborVendors = vendors.filter(v => v.vendor_type === "personnel" || v.vendor_type === "contractor");

  // Find "Contract Labor" category as default
  const contractLaborCategory = categories.find(c => c.name === "Contract Labor");

  // Check for already billed entries
  const alreadyBilledEntries = selectedEntries.filter(e => e.vendor_bill_id);
  const hasAlreadyBilled = alreadyBilledEntries.length > 0;

  // Group entries by personnel and calculate summaries
  const personnelSummaries = useMemo(() => {
    const groups = new Map<string, PersonnelSummary>();

    // Only process non-billed entries
    const entriesToProcess = selectedEntries.filter(e => !e.vendor_bill_id);

    entriesToProcess.forEach((entry) => {
      const personnelId = entry.personnel_id || entry.user_id;
      const personnelName = entry.personnel 
        ? `${entry.personnel.first_name} ${entry.personnel.last_name}`
        : entry.profiles?.first_name && entry.profiles?.last_name
          ? `${entry.profiles.first_name} ${entry.profiles.last_name}`
          : entry.profiles?.email || "Unknown";
      // Use hourly_rate for vendor bills
      const payRate = entry.personnel?.hourly_rate || 0;
      // Get vendor IDs
      const vendorId = (entry.personnel as any)?.vendor_id || null;
      const linkedVendorId = (entry.personnel as any)?.linked_vendor_id || null;

      if (!groups.has(personnelId)) {
        groups.set(personnelId, {
          personnelId,
          personnelName,
          totalHours: 0,
          regularHours: 0,
          overtimeHours: 0,
          totalCost: 0,
          payRate,
          vendorId,
          linkedVendorId,
          entryIds: [],
        });
      }

      const summary = groups.get(personnelId)!;
      summary.totalHours += Number(entry.hours);
      summary.entryIds.push(entry.id);
    });

    // Calculate overtime and costs for each personnel
    groups.forEach((summary) => {
      summary.regularHours = Math.min(summary.totalHours, weeklyOvertimeThreshold);
      summary.overtimeHours = Math.max(0, summary.totalHours - weeklyOvertimeThreshold);
      
      const regularCost = summary.regularHours * summary.payRate;
      const overtimeCost = summary.overtimeHours * summary.payRate * overtimeMultiplier;
      summary.totalCost = regularCost + overtimeCost;
    });

    return Array.from(groups.values());
  }, [selectedEntries, weeklyOvertimeThreshold, overtimeMultiplier]);

  // Initialize selected personnel when dialog opens
  useEffect(() => {
    if (open && personnelSummaries.length > 0) {
      setSelectedPersonnel(new Set(personnelSummaries.map(p => p.personnelId)));
      // Set default category
      if (contractLaborCategory && !categoryId) {
        setCategoryId(contractLaborCategory.id);
      }
    }
  }, [open, personnelSummaries.length, contractLaborCategory?.id]);

  // Auto-adjust due date when bill date changes
  useEffect(() => {
    const billDateObj = new Date(billDate + "T12:00:00"); // Parse as local
    const dayOfWeek = billDateObj.getDay(); // 0 = Sunday, 5 = Friday
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    const daysToAdd = daysUntilFriday === 0 ? 0 : daysUntilFriday;
    const newDueDate = new Date(billDateObj);
    newDueDate.setDate(billDateObj.getDate() + daysToAdd);
    setDueDate(format(newDueDate, "yyyy-MM-dd"));
  }, [billDate]);

  const selectedSummaries = useMemo(() =>
    personnelSummaries.filter(p => selectedPersonnel.has(p.personnelId)),
    [personnelSummaries, selectedPersonnel]
  );

  const totalAmount = useMemo(() =>
    selectedSummaries.reduce((sum, p) => sum + p.totalCost, 0),
    [selectedSummaries]
  );

  const totalHours = useMemo(() =>
    selectedSummaries.reduce((sum, p) => sum + p.totalHours, 0),
    [selectedSummaries]
  );

  // Get project info from first entry
  const projectInfo = selectedEntries[0]?.projects;
  const projectId = selectedEntries[0]?.project_id;

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

  // Get effective vendor for a personnel
  const getEffectiveVendor = (summary: PersonnelSummary) => {
    // Check for override first
    if (vendorOverrides[summary.personnelId]) {
      return vendors.find(v => v.id === vendorOverrides[summary.personnelId]);
    }
    // Use staffing agency if set, otherwise use linked self-vendor
    const vendorId = summary.vendorId || summary.linkedVendorId;
    return vendorId ? vendors.find(v => v.id === vendorId) : null;
  };

  // Create or get self-vendor for personnel
  const ensureVendorForPersonnel = async (personnelId: string, personnelName: string) => {
    // Check if personnel already has linked vendor
    const { data: personnel } = await supabase
      .from('personnel')
      .select('linked_vendor_id, vendor_id')
      .eq('id', personnelId)
      .single();

    if (personnel?.vendor_id) {
      return personnel.vendor_id; // Use staffing agency
    }

    if (personnel?.linked_vendor_id) {
      return personnel.linked_vendor_id; // Use existing self-vendor
    }

    // Create self-vendor using the database function
    const { data, error } = await supabase.rpc('create_personnel_vendor', {
      p_personnel_id: personnelId
    });

    if (error) {
      console.error('Error creating vendor for personnel:', error);
      throw new Error(`Failed to create vendor for ${personnelName}`);
    }

    return data as string;
  };

  const handleCreate = async () => {
    if (selectedSummaries.length === 0) {
      toast.error("Please select at least one personnel");
      return;
    }

    setIsSubmitting(true);

    try {
      const createdBillIds: string[] = [];

      // Create individual bills for each personnel
      for (const summary of selectedSummaries) {
        // Get or create vendor for this personnel
        let vendorId = vendorOverrides[summary.personnelId] || summary.vendorId || summary.linkedVendorId;
        
        if (!vendorId) {
          // Auto-create self-vendor
          vendorId = await ensureVendorForPersonnel(summary.personnelId, summary.personnelName);
        }

        const vendor = vendors.find(v => v.id === vendorId);
        const vendorName = vendor?.company || vendor?.name || summary.personnelName;

        // Create line items for this personnel
        const lineItems = [];
        
        if (summary.regularHours > 0) {
          lineItems.push({
            description: `${summary.personnelName} - Regular Hours`,
            quantity: summary.regularHours,
            unit_cost: summary.payRate,
            total: summary.regularHours * summary.payRate,
            project_id: projectId || null,
            category_id: categoryId || null,
          });
        }

        if (summary.overtimeHours > 0) {
          const otRate = summary.payRate * overtimeMultiplier;
          lineItems.push({
            description: `${summary.personnelName} - Overtime Hours`,
            quantity: summary.overtimeHours,
            unit_cost: otRate,
            total: summary.overtimeHours * otRate,
            project_id: projectId || null,
            category_id: categoryId || null,
          });
        }

        const result = await addBill.mutateAsync({
          bill: {
            vendor_id: vendorId,
            vendor_name: vendorName,
            bill_date: billDate,
            due_date: dueDate,
            subtotal: summary.totalCost,
            tax_rate: 0, // No tax on vendor bills
            tax_amount: 0,
            total: summary.totalCost,
            status: "open",
            notes: customNote 
              ? `${customNote}\n\nLabor bill for ${projectInfo?.name || 'project'} - ${summary.personnelName} - ${format(parseLocalDate(billDate), "MMM d, yyyy")}`
              : `Labor bill for ${projectInfo?.name || 'project'} - ${summary.personnelName} - ${format(parseLocalDate(billDate), "MMM d, yyyy")}`,
            purchase_order_id: null,
            purchase_order_number: null,
          },
          lineItems,
        });

        if (result?.id) {
          createdBillIds.push(result.id);

          // Auto-sync to QuickBooks if connected
          if (qbConfig?.is_connected) {
            try {
              const syncResult = await supabase.functions.invoke('quickbooks-create-bill', {
                body: { billId: result.id }
              });
              if (syncResult.error) {
                console.error("QuickBooks sync failed for bill:", result.id, syncResult.error);
              } else {
                console.log("QuickBooks sync successful for bill:", result.id);
              }
            } catch (qbError) {
              console.error("QuickBooks sync failed for bill:", result.id, qbError);
              // Don't fail the whole operation, bill is still created
            }
          }

          // Update time entries with vendor_bill_id
          const { error: updateError } = await supabase
            .from('time_entries')
            .update({ vendor_bill_id: result.id })
            .in('id', summary.entryIds);

          if (updateError) {
            console.error("Error linking time entries to bill:", updateError);
          }

          // Create project_labor_expenses record to track labor costs for job costing
          if (projectId) {
            const weekStart = startOfWeek(parseLocalDate(billDate), { weekStartsOn: 1 });
            const weekEnd = endOfWeek(parseLocalDate(billDate), { weekStartsOn: 1 });
            
            const { error: expenseError } = await supabase
              .from('project_labor_expenses')
              .insert({
                project_id: projectId,
                customer_id: projectInfo?.customer_id || null,
                personnel_id: summary.personnelId,
                personnel_name: summary.personnelName,
                week_start_date: format(weekStart, 'yyyy-MM-dd'),
                week_end_date: format(weekEnd, 'yyyy-MM-dd'),
                regular_hours: summary.regularHours,
                overtime_hours: summary.overtimeHours,
                hourly_rate: summary.payRate,
                overtime_rate: summary.payRate * overtimeMultiplier,
                total_amount: summary.totalCost,
                status: 'billed',
                billable: true,
                vendor_bill_id: result.id,
              });

            if (expenseError) {
              console.error("Error creating project labor expense:", expenseError);
            }
          }
        }
      }

      const syncMessage = qbConfig?.is_connected ? ' and synced to QuickBooks' : '';
      toast.success(`Created ${createdBillIds.length} vendor bill${createdBillIds.length > 1 ? 's' : ''}${syncMessage}`);
      onOpenChange(false);
      onSuccess?.();
      
      // Navigate to first created bill
      if (createdBillIds.length === 1) {
        navigate(`/vendor-bills/${createdBillIds[0]}`);
      } else if (createdBillIds.length > 1) {
        navigate('/vendor-bills');
      }
    } catch (error) {
      console.error("Error creating vendor bills:", error);
      toast.error("Failed to create vendor bills");
    } finally {
      setIsSubmitting(false);
    }
  };

  const navigateToExistingBill = (billId: string) => {
    onOpenChange(false);
    navigate(`/vendor-bills/${billId}`);
  };

  const handleClose = () => {
    setSelectedPersonnel(new Set());
    setCategoryId("");
    setVendorOverrides({});
    setCustomNote("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Vendor Bills from Time Entries
          </DialogTitle>
          <DialogDescription>
            Create individual vendor bills for each personnel ({selectedEntries.length} entries)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning for already billed entries */}
          {hasAlreadyBilled && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg border border-amber-500/20">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <span className="text-sm font-medium">
                  {alreadyBilledEntries.length} entries already billed
                </span>
                <p className="text-xs">
                  These entries will be skipped. Only un-billed entries will be included.
                </p>
                {alreadyBilledEntries[0]?.vendor_bill_id && (
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-auto p-0 text-xs"
                    onClick={() => navigateToExistingBill(alreadyBilledEntries[0].vendor_bill_id!)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit Existing Bill
                  </Button>
                )}
              </div>
            </div>
          )}

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
              <Label htmlFor="billDate">Bill Date</Label>
              <Input
                id="billDate"
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
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

          {/* Category Selection */}
          <div>
            <Label htmlFor="category">Expense Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Note */}
          <div>
            <Label htmlFor="customNote">Note (applies to all bills)</Label>
            <Textarea
              id="customNote"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Enter a note that will be added to each personnel's bill..."
              className="mt-1.5"
              rows={3}
            />
          </div>

          {/* Personnel Selection - Individual Bills */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Create Individual Bills Per Personnel</Label>
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
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personnelSummaries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                        No personnel data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    personnelSummaries.map((summary) => {
                      const effectiveVendor = getEffectiveVendor(summary);
                      const hasNoVendor = !effectiveVendor && !summary.vendorId && !summary.linkedVendorId;
                      
                      return (
                        <TableRow
                          key={summary.personnelId}
                          className={!selectedPersonnel.has(summary.personnelId) ? 'opacity-50' : ''}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedPersonnel.has(summary.personnelId)}
                              onCheckedChange={() => togglePersonnel(summary.personnelId)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{summary.personnelName}</TableCell>
                          <TableCell>
                            <Select
                              value={vendorOverrides[summary.personnelId] || summary.vendorId || summary.linkedVendorId || "auto"}
                              onValueChange={(val) => {
                                if (val === "auto") {
                                  const newOverrides = { ...vendorOverrides };
                                  delete newOverrides[summary.personnelId];
                                  setVendorOverrides(newOverrides);
                                } else {
                                  setVendorOverrides(prev => ({ ...prev, [summary.personnelId]: val }));
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="auto">
                                  <div className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {hasNoVendor ? "Auto-create" : (effectiveVendor?.company || effectiveVendor?.name || "Self")}
                                  </div>
                                </SelectItem>
                                {laborVendors.map((v) => (
                                  <SelectItem key={v.id} value={v.id}>
                                    {v.company || v.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            {summary.regularHours.toFixed(1)}h
                            {summary.overtimeHours > 0 && (
                              <span className="text-orange-500 ml-1">+ {summary.overtimeHours.toFixed(1)}h OT</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(summary.payRate)}/hr
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(summary.totalCost)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Bill Summary */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bills to Create</span>
              <span>{selectedSummaries.length} individual bill{selectedSummaries.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Hours</span>
              <span>{totalHours.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between font-medium pt-2 border-t">
              <span>Combined Total</span>
              <span className="text-lg">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isSubmitting || selectedSummaries.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              `Create ${selectedSummaries.length} Bill${selectedSummaries.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
