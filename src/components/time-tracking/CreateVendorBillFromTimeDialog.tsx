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
import { Loader2, FileText, Check, AlertTriangle, Edit } from "lucide-react";
import { format, nextFriday } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
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
  payRate: number; // Internal pay rate for vendor bills
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
  const [vendorId, setVendorId] = useState<string>("");
  const [billDate, setBillDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(format(nextFriday(new Date()), "yyyy-MM-dd"));
  const [categoryId, setCategoryId] = useState<string>("");
  const [selectedPersonnel, setSelectedPersonnel] = useState<Set<string>>(new Set());

  const { data: vendors = [] } = useVendors();
  const { data: categories = [] } = useExpenseCategories();
  const { data: companySettings } = useCompanySettings();
  const addBill = useAddVendorBill();

  const overtimeMultiplier = companySettings?.overtime_multiplier ?? 1.5;
  const weeklyOvertimeThreshold = companySettings?.weekly_overtime_threshold ?? 40;

  // Filter to only labor vendors (personnel type)
  const laborVendors = vendors.filter(v => v.vendor_type === "personnel" || v.vendor_type === "contractor");

  // Find "Contract Labor" category as default
  const contractLaborCategory = categories.find(c => c.name === "Contract Labor");

  // Check for already billed entries
  const alreadyBilledEntries = selectedEntries.filter(e => e.vendor_bill_id);
  const hasAlreadyBilled = alreadyBilledEntries.length > 0;

  // Group entries by personnel and calculate summaries (only non-billed entries)
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
      // Use pay_rate for vendor bills (internal payroll cost)
      const payRate = (entry.personnel as any)?.pay_rate || entry.personnel?.hourly_rate || 0;

      if (!groups.has(personnelId)) {
        groups.set(personnelId, {
          personnelId,
          personnelName,
          totalHours: 0,
          regularHours: 0,
          overtimeHours: 0,
          totalCost: 0,
          payRate,
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
  useMemo(() => {
    if (open && selectedPersonnel.size === 0 && personnelSummaries.length > 0) {
      setSelectedPersonnel(new Set(personnelSummaries.map(p => p.personnelId)));
      // Set default category
      if (contractLaborCategory && !categoryId) {
        setCategoryId(contractLaborCategory.id);
      }
    }
  }, [open, personnelSummaries, contractLaborCategory, categoryId, selectedPersonnel.size]);

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

  const selectedVendor = laborVendors.find(v => v.id === vendorId);

  const handleCreate = async () => {
    if (!vendorId || selectedSummaries.length === 0) {
      toast.error("Please select a vendor and at least one personnel");
      return;
    }

    try {
      // Create line items from selected personnel summaries
      const lineItems = selectedSummaries.map((summary) => ({
        description: `Labor - ${summary.personnelName} (${summary.regularHours.toFixed(1)}h${summary.overtimeHours > 0 ? ` + ${summary.overtimeHours.toFixed(1)}h OT` : ''})`,
        quantity: 1,
        unit_cost: summary.totalCost,
        total: summary.totalCost,
        project_id: projectId || null,
        category_id: categoryId || null,
      }));

      // Collect all entry IDs to update
      const entryIdsToUpdate = selectedSummaries.flatMap(s => s.entryIds);

      const result = await addBill.mutateAsync({
        bill: {
          vendor_id: vendorId,
          vendor_name: selectedVendor?.company || selectedVendor?.name || "Unknown",
          bill_date: billDate,
          due_date: dueDate,
          subtotal: totalAmount,
          tax_rate: 0,
          tax_amount: 0,
          total: totalAmount,
          status: "open",
          notes: `Labor bill for ${projectInfo?.name || 'project'} - ${format(new Date(billDate), "MMM d, yyyy")}`,
          purchase_order_id: null,
          purchase_order_number: null,
        },
        lineItems,
      });

      // Update time entries with vendor_bill_id
      if (result?.id) {
        const { error: updateError } = await supabase
          .from('time_entries')
          .update({ vendor_bill_id: result.id })
          .in('id', entryIdsToUpdate);

        if (updateError) {
          console.error("Error linking time entries to bill:", updateError);
          toast.error("Bill created but failed to link time entries");
        }
      }

      toast.success("Vendor bill created successfully");
      onOpenChange(false);
      onSuccess?.();
      
      // Navigate to the created bill
      if (result?.id) {
        navigate(`/vendor-bills/${result.id}`);
      }
    } catch (error) {
      console.error("Error creating vendor bill:", error);
    }
  };

  // Navigate to existing bill
  const navigateToExistingBill = (billId: string) => {
    onOpenChange(false);
    navigate(`/vendor-bills/${billId}`);
  };

  const handleClose = () => {
    setVendorId("");
    setSelectedPersonnel(new Set());
    setCategoryId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Vendor Bill from Time Entries
          </DialogTitle>
          <DialogDescription>
            Create a vendor bill for the selected labor hours ({selectedEntries.length} entries)
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

          {/* Vendor Selection */}
          <div>
            <Label htmlFor="vendor">Labor Vendor *</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select labor vendor..." />
              </SelectTrigger>
              <SelectContent>
                {laborVendors.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No labor vendors found
                  </div>
                ) : (
                  laborVendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.company || vendor.name}
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

          {/* Personnel Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Select Personnel to Bill</Label>
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
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personnelSummaries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                        No personnel data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    personnelSummaries.map((summary) => (
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
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Bill Summary */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Selected Personnel</span>
              <span>{selectedSummaries.length} of {personnelSummaries.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Hours</span>
              <span>{totalHours.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between font-medium pt-2 border-t">
              <span>Bill Total</span>
              <span className="text-lg">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {/* Warning if no vendor selected */}
          {!vendorId && laborVendors.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">No labor vendors found. Please create a vendor first.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={addBill.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={addBill.isPending || !vendorId || selectedSummaries.length === 0}
          >
            {addBill.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Create Bill ({formatCurrency(totalAmount)})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
