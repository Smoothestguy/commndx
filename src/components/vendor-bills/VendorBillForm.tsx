import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalculatorInput } from "@/components/ui/calculator-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Save, X, Loader2, Lock } from "lucide-react";
import { BulkAddByUmbrellaPopover, BulkLineItem } from "@/components/products/BulkAddByUmbrellaPopover";
import { toast } from "sonner";
import { useVendors, Vendor } from "@/integrations/supabase/hooks/useVendors";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useExpenseCategories } from "@/integrations/supabase/hooks/useExpenseCategories";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { useQBProductMappings } from "@/integrations/supabase/hooks/useQBProductMappings";
import { 
  VendorBill, 
  VendorBillLineItem, 
  VendorBillStatus,
  useAddVendorBill,
  useUpdateVendorBill,
} from "@/integrations/supabase/hooks/useVendorBills";
import { useQuickBooksConfig, useSyncVendorBillToQB } from "@/integrations/supabase/hooks/useQuickBooks";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/dateUtils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { PendingAttachmentsUpload, PendingFile } from "@/components/shared/PendingAttachmentsUpload";
import { finalizeAttachments, cleanupPendingAttachments } from "@/utils/attachmentUtils";
import { VendorBillAttachments } from "@/components/vendor-bills/VendorBillAttachments";
import { VendorBillSyncErrorDialog } from "@/components/vendor-bills/VendorBillSyncErrorDialog";
import { useSyncPendingAttachments } from "@/integrations/supabase/hooks/useVendorBillAttachments";
import { useLockedPeriod } from "@/hooks/useLockedPeriod";

interface VendorBillFormProps {
  bill?: VendorBill;
  isEditing?: boolean;
}

interface LineItem {
  id: string;
  project_id: string | null;
  category_id: string | null;
  qb_product_mapping_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
  total: number;
}

// Helper function to get the next Friday (or today if it's Friday)
const getNextFriday = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 5 = Friday
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  // If today is Friday, use today; otherwise get next Friday
  const daysToAdd = daysUntilFriday === 0 ? 0 : daysUntilFriday;
  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + daysToAdd);
  return nextFriday;
};

export function VendorBillForm({ bill, isEditing = false }: VendorBillFormProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: vendors } = useVendors();
  const { data: projects } = useProjects();
  const { data: categories } = useExpenseCategories("vendor");
  const { data: qbProductMappings } = useQBProductMappings();
  const { data: companySettings } = useCompanySettings();
  const { data: qbConfig } = useQuickBooksConfig();
  const addBill = useAddVendorBill();
  const updateBill = useUpdateVendorBill();
  const syncToQB = useSyncVendorBillToQB();
  const syncPendingAttachments = useSyncPendingAttachments();
  const { isDateLocked, validateDate, minAllowedDate } = useLockedPeriod();
  const [isSyncing, setIsSyncing] = useState(false);
  const [vendorOpen, setVendorOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [billDate, setBillDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(format(getNextFriday(), "yyyy-MM-dd"));
  const [status, setStatus] = useState<VendorBillStatus>("draft");
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), project_id: null, category_id: null, qb_product_mapping_id: null, description: "", quantity: 1, unit_cost: 0, total: 0 }
  ]);

  // Pending attachments state (for new bills)
  const [pendingAttachments, setPendingAttachments] = useState<PendingFile[]>([]);

  // Sync error dialog state
  const [syncErrorDialogOpen, setSyncErrorDialogOpen] = useState(false);
  const [syncErrorMessage, setSyncErrorMessage] = useState("");
  const [syncErrorBillId, setSyncErrorBillId] = useState<string | null>(null);

  // Track initial form data for dirty state detection
  const [initialFormData, setInitialFormData] = useState<string | null>(null);

  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (bill && isEditing) {
      const vendor = vendors?.find(v => v.id === bill.vendor_id);
      setSelectedVendor(vendor || null);
      setBillDate(bill.bill_date);
      setDueDate(bill.due_date);
      setStatus(bill.status);
      setTaxRate(Number(bill.tax_rate));
      setNotes(bill.notes || "");
      if (bill.line_items && bill.line_items.length > 0) {
        setLineItems(bill.line_items.map(li => ({
          id: li.id || crypto.randomUUID(),
          project_id: li.project_id,
          category_id: li.category_id,
          qb_product_mapping_id: (li as any).qb_product_mapping_id || null,
          description: li.description,
          quantity: Number(li.quantity),
          unit_cost: Number(li.unit_cost),
          total: Number(li.total),
        })));
      }
      
      // Set initial form data snapshot for dirty detection
      setInitialFormData(JSON.stringify({
        vendor_id: bill.vendor_id,
        bill_date: bill.bill_date,
        due_date: bill.due_date,
        status: bill.status,
        tax_rate: Number(bill.tax_rate),
        notes: bill.notes || "",
        lineItems: JSON.stringify(bill.line_items?.map(li => ({
          project_id: li.project_id,
          category_id: li.category_id,
          description: li.description,
          quantity: Number(li.quantity),
          unit_cost: Number(li.unit_cost),
        })) || []),
      }));
    }
  }, [bill, isEditing, vendors]);

  // Compute if form has unsaved changes
  const isFormDirty = useMemo(() => {
    if (!initialFormData || !isEditing) return false;
    const currentData = JSON.stringify({
      vendor_id: selectedVendor?.id,
      bill_date: billDate,
      due_date: dueDate,
      status,
      tax_rate: taxRate,
      notes,
      lineItems: JSON.stringify(lineItems.map(li => ({
        project_id: li.project_id,
        category_id: li.category_id,
        description: li.description,
        quantity: li.quantity,
        unit_cost: li.unit_cost,
      }))),
    });
    return currentData !== initialFormData;
  }, [initialFormData, selectedVendor?.id, billDate, dueDate, status, taxRate, notes, lineItems, isEditing]);

  // Handler to save the bill (used by attachments component when dirty)
  const handleSaveForAttachment = async (): Promise<void> => {
    await handleSubmitInternal(false); // Save without navigating
  };

  // Auto-adjust due date when bill date changes (only for new bills)
  useEffect(() => {
    if (!isEditing) {
      const billDateObj = new Date(billDate + "T12:00:00"); // Parse as local
      const dayOfWeek = billDateObj.getDay(); // 0 = Sunday, 5 = Friday
      const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
      const daysToAdd = daysUntilFriday === 0 ? 0 : daysUntilFriday;
      const newDueDate = new Date(billDateObj);
      newDueDate.setDate(billDateObj.getDate() + daysToAdd);
      setDueDate(format(newDueDate, "yyyy-MM-dd"));
    }
  }, [billDate, isEditing]);

  // Tax rate defaults to 0 for vendor bills (no auto-load from company settings)

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === "quantity" || field === "unit_cost") {
        updated.total = Number(updated.quantity) * Number(updated.unit_cost);
      }
      return updated;
    }));
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, {
      id: crypto.randomUUID(),
      project_id: null,
      category_id: null,
      qb_product_mapping_id: null,
      description: "",
      quantity: 1,
      unit_cost: 0,
      total: 0,
    }]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) {
      toast.error("At least one line item is required");
      return;
    }
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  // Round all financial values to 2 decimal places (proper cents)
  const subtotal = Math.round(lineItems.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
  const taxAmount = Math.round((subtotal * (taxRate / 100)) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  // Internal submit handler with optional navigation
  const handleSubmitInternal = async (shouldNavigate: boolean = true) => {
    if (!selectedVendor) {
      toast.error("Please select a vendor");
      throw new Error("Vendor required");
    }

    if (lineItems.every(li => !li.description.trim())) {
      toast.error("Please add at least one line item with a description");
      throw new Error("Line items required");
    }

    if (parseLocalDate(dueDate) < parseLocalDate(billDate)) {
      toast.error("Due date cannot be before bill date");
      throw new Error("Invalid dates");
    }

    // Validate locked period
    const dateValidation = validateDate(billDate, "vendor bill");
    if (!dateValidation.valid) {
      const errorMsg = "message" in dateValidation ? dateValidation.message : "Date is in locked period";
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }

    const billData = {
      vendor_id: selectedVendor.id,
      vendor_name: selectedVendor.name,
      bill_date: billDate,
      due_date: dueDate,
      status,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      notes: notes || null,
      purchase_order_id: null,
      purchase_order_number: null,
    };

    const lineItemsData = lineItems
      .filter(li => li.description.trim())
      .map(li => ({
        project_id: li.project_id,
        category_id: li.category_id,
        qb_product_mapping_id: li.qb_product_mapping_id,
        description: li.description,
        quantity: li.quantity,
        unit_cost: li.unit_cost,
        total: Math.round(li.total * 100) / 100,
      }));

    let savedBillId: string;
    
    if (isEditing && bill) {
      // For edits, the hook now auto-syncs to QuickBooks
      await updateBill.mutateAsync({
        id: bill.id,
        bill: { ...billData, paid_amount: bill.paid_amount },
        lineItems: lineItemsData,
      });
      savedBillId = bill.id;
      
      // Sync any pending attachments to QuickBooks after bill is saved
      try {
        const attachSyncResult = await syncPendingAttachments.mutateAsync({ billId: savedBillId });
        if (attachSyncResult.synced > 0) {
          toast.success(`${attachSyncResult.synced} attachment(s) synced to QuickBooks`);
        }
        if (attachSyncResult.failed > 0) {
          toast.warning(`${attachSyncResult.failed} attachment(s) failed to sync`);
        }
      } catch (attachSyncErr) {
        console.warn("Attachment sync error:", attachSyncErr);
        // Non-blocking - bill was saved successfully
      }
      
      // Reset initial form data after successful save (no longer dirty)
      setInitialFormData(JSON.stringify({
        vendor_id: selectedVendor.id,
        bill_date: billDate,
        due_date: dueDate,
        status,
        tax_rate: taxRate,
        notes,
        lineItems: JSON.stringify(lineItemsData.map(li => ({
          project_id: li.project_id,
          category_id: li.category_id,
          description: li.description,
          quantity: li.quantity,
          unit_cost: li.unit_cost,
        }))),
      }));
    } else {
      const result = await addBill.mutateAsync({
        bill: billData,
        lineItems: lineItemsData,
      });
      savedBillId = result.id;

      // Finalize pending attachments for new bills
      if (pendingAttachments.length > 0 && user) {
        const attachResult = await finalizeAttachments(
          pendingAttachments,
          savedBillId,
          "vendor_bill",
          user.id
        );
        if (!attachResult.success) {
          toast.warning("Bill saved but some attachments failed to upload");
        }
      }

      // Sync to QuickBooks AFTER attachments are finalized (for new bills only)
      // This ensures attachments are in the database when QB sync runs
      if (qbConfig?.is_connected && status !== 'draft') {
        setIsSyncing(true);
        try {
          const syncResult = await syncToQB.mutateAsync(savedBillId);
          if (syncResult.success) {
            toast.success("Bill created and synced to QuickBooks");
          } else {
            // Show error dialog instead of just a toast
            setSyncErrorMessage(syncResult.error || "Unknown error");
            setSyncErrorBillId(savedBillId);
            setSyncErrorDialogOpen(true);
            toast.warning("Bill created locally, but QuickBooks sync failed.");
          }
        } catch (qbError) {
          console.error('QuickBooks sync error:', qbError);
          const errorMsg = qbError instanceof Error ? qbError.message : 'Unknown error';
          setSyncErrorMessage(errorMsg);
          setSyncErrorBillId(savedBillId);
          setSyncErrorDialogOpen(true);
          toast.warning("Bill created locally, but QuickBooks sync failed.");
        } finally {
          setIsSyncing(false);
        }
      }
    }

    if (shouldNavigate) {
      // Preserve filter params when navigating back
      const searchParams = new URLSearchParams(window.location.search);
      // Remove any edit-specific params, keep filter params
      const filterParams = new URLSearchParams();
      ["status", "vendor_id", "project_id", "start_date", "end_date", "activeFilter", "search"].forEach(key => {
        const value = searchParams.get(key);
        if (value) filterParams.set(key, value);
      });
      const queryString = filterParams.toString();
      navigate("/vendor-bills" + (queryString ? `?${queryString}` : ""));
    }
  };

  const handleSubmit = async () => {
    try {
      await handleSubmitInternal(true);
    } catch (error) {
      // Error handled by mutation or validation
    }
  };

  const autoExpandTextarea = (ref: React.RefObject<HTMLTextAreaElement>) => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${Math.max(80, ref.current.scrollHeight)}px`;
    }
  };

  // Handler for retrying sync from error dialog
  const handleRetrySyncFromDialog = async () => {
    if (!syncErrorBillId) return;
    const result = await syncToQB.mutateAsync(syncErrorBillId);
    if (!result.success) {
      throw new Error(result.error || "Sync failed");
    }
  };

  return (
    <>
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bill Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vendor *</Label>
              <Popover open={vendorOpen} onOpenChange={setVendorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={vendorOpen}
                    className="w-full justify-between"
                  >
                    {selectedVendor ? selectedVendor.name : "Select vendor..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search vendors..." />
                    <CommandList>
                      <CommandEmpty>No vendor found.</CommandEmpty>
                      <CommandGroup>
                        {vendors?.map((vendor) => (
                          <CommandItem
                            key={vendor.id}
                            value={vendor.name}
                            onSelect={() => {
                              setSelectedVendor(vendor);
                              setVendorOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedVendor?.id === vendor.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {vendor.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as VendorBillStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Bill Date *
                {isDateLocked(billDate) && <Lock className="h-3 w-3 text-destructive" />}
              </Label>
              <Input
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                min={minAllowedDate ? format(minAllowedDate, "yyyy-MM-dd") : undefined}
                className={isDateLocked(billDate) ? "border-destructive" : ""}
              />
              {isDateLocked(billDate) && (
                <p className="text-xs text-destructive">This date is in a locked accounting period</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Due Date *</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tax Rate (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                 <TableRow>
                   <TableHead className="w-[200px]">Description</TableHead>
                   <TableHead>Project</TableHead>
                   <TableHead>Category</TableHead>
                   <TableHead>QB Product/Service</TableHead>
                   <TableHead className="w-[80px]">Qty</TableHead>
                   <TableHead className="w-[120px]">Unit Cost</TableHead>
                   <TableHead className="w-[120px]">Total</TableHead>
                   <TableHead className="w-[50px]"></TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Textarea
                        value={item.description}
                        onChange={(e) => {
                          updateLineItem(item.id, "description", e.target.value);
                          e.target.style.height = "auto";
                          e.target.style.height = `${Math.max(40, e.target.scrollHeight)}px`;
                        }}
                        placeholder="Description"
                        className="min-h-[40px] resize-none overflow-hidden"
                        ref={(el) => {
                          if (el && item.description) {
                            el.style.height = "auto";
                            el.style.height = `${Math.max(40, el.scrollHeight)}px`;
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.project_id || "none"}
                        onValueChange={(v) => updateLineItem(item.id, "project_id", v === "none" ? null : v)}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Project</SelectItem>
                          {projects?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.category_id || "none"}
                        onValueChange={(v) => updateLineItem(item.id, "category_id", v === "none" ? null : v)}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Category</SelectItem>
                          {categories?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                     </TableCell>
                     <TableCell>
                       <Select
                         value={item.qb_product_mapping_id || "none"}
                         onValueChange={(v) => updateLineItem(item.id, "qb_product_mapping_id", v === "none" ? null : v)}
                       >
                         <SelectTrigger className="w-[180px]">
                           <SelectValue placeholder="Select" />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="none">None</SelectItem>
                           {qbProductMappings?.map((m) => (
                             <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                     </TableCell>
                     <TableCell>
                       <Input
                        type="number"
                        min="0"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, "quantity", Number(e.target.value))}
                        className="w-[80px]"
                       />
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <CalculatorInput
                          value={item.unit_cost}
                          onValueChange={(value) => updateLineItem(item.id, "unit_cost", value)}
                          className="pl-7 w-[120px]"
                          showCalculatorIcon={false}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      ${item.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(item.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={addLineItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Line
            </Button>
            <BulkAddByUmbrellaPopover
              priceField="cost"
              onAddItems={(bulkItems) => {
                const newItems: LineItem[] = bulkItems.map((bi) => ({
                  id: bi.id,
                  project_id: null,
                  category_id: null,
                  qb_product_mapping_id: null,
                  description: bi.description,
                  quantity: bi.quantity,
                  unit_cost: bi.unit_price,
                  total: bi.quantity * bi.unit_price,
                }));
                setLineItems((prev) => [...prev, ...newItems]);
              }}
            />
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>${subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax ({taxRate}%):</span>
                <span>${taxAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg border-t pt-2">
                <span>Total:</span>
                <span>${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            ref={notesRef}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              autoExpandTextarea(notesRef);
            }}
            placeholder="Add any notes or memo..."
            className="min-h-[80px] resize-none overflow-hidden"
          />
        </CardContent>
      </Card>

      {/* Attachments Section */}
      {isEditing && bill ? (
        <VendorBillAttachments 
          billId={bill.id} 
          isEditMode
          isFormDirty={isFormDirty}
          onSaveRequired={handleSaveForAttachment}
        />
      ) : (
        <PendingAttachmentsUpload
          entityType="vendor_bill"
          pendingFiles={pendingAttachments}
          onFilesChange={setPendingAttachments}
        />
      )}

      <div className="flex gap-4 justify-end">
        <Button 
          variant="outline" 
          onClick={async () => {
            // Cleanup pending attachments when canceling
            if (pendingAttachments.length > 0) {
              await cleanupPendingAttachments(pendingAttachments);
            }
            navigate("/vendor-bills");
          }} 
          disabled={isSyncing}
        >
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={addBill.isPending || updateBill.isPending || isSyncing}>
          {isSyncing ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Syncing to QuickBooks...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-1" />
              {isEditing ? "Update Bill" : "Create Bill"}
            </>
          )}
        </Button>
      </div>
    </div>

    {/* QuickBooks Sync Error Dialog */}
    <VendorBillSyncErrorDialog
      open={syncErrorDialogOpen}
      onOpenChange={setSyncErrorDialogOpen}
      errorMessage={syncErrorMessage}
      vendorId={selectedVendor?.id}
      vendorName={selectedVendor?.name}
      billId={syncErrorBillId || undefined}
      onRetrySync={handleRetrySyncFromDialog}
    />
    </>
  );
}
