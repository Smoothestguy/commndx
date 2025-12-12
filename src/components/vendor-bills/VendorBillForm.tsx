import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalculatorInput } from "@/components/ui/calculator-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Save, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useVendors, Vendor } from "@/integrations/supabase/hooks/useVendors";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useExpenseCategories } from "@/integrations/supabase/hooks/useExpenseCategories";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import { 
  VendorBill, 
  VendorBillLineItem, 
  VendorBillStatus,
  useAddVendorBill,
  useUpdateVendorBill,
} from "@/integrations/supabase/hooks/useVendorBills";
import { useQuickBooksConfig, useSyncVendorBillToQB } from "@/integrations/supabase/hooks/useQuickBooks";
import { format } from "date-fns";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { PendingAttachmentsUpload, PendingFile } from "@/components/shared/PendingAttachmentsUpload";
import { finalizeAttachments, cleanupPendingAttachments } from "@/utils/attachmentUtils";

interface VendorBillFormProps {
  bill?: VendorBill;
  isEditing?: boolean;
}

interface LineItem {
  id: string;
  project_id: string | null;
  category_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
  total: number;
}

export function VendorBillForm({ bill, isEditing = false }: VendorBillFormProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: vendors } = useVendors();
  const { data: projects } = useProjects();
  const { data: categories } = useExpenseCategories("vendor");
  const { data: companySettings } = useCompanySettings();
  const { data: qbConfig } = useQuickBooksConfig();
  const addBill = useAddVendorBill();
  const updateBill = useUpdateVendorBill();
  const syncToQB = useSyncVendorBillToQB();

  const [isSyncing, setIsSyncing] = useState(false);
  const [vendorOpen, setVendorOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [billDate, setBillDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
  const [status, setStatus] = useState<VendorBillStatus>("draft");
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), project_id: null, category_id: null, description: "", quantity: 1, unit_cost: 0, total: 0 }
  ]);

  // Pending attachments state (for new bills)
  const [pendingAttachments, setPendingAttachments] = useState<PendingFile[]>([]);

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
          description: li.description,
          quantity: Number(li.quantity),
          unit_cost: Number(li.unit_cost),
          total: Number(li.total),
        })));
      }
    }
  }, [bill, isEditing, vendors]);

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

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const handleSubmit = async () => {
    if (!selectedVendor) {
      toast.error("Please select a vendor");
      return;
    }

    if (lineItems.every(li => !li.description.trim())) {
      toast.error("Please add at least one line item with a description");
      return;
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
        description: li.description,
        quantity: li.quantity,
        unit_cost: li.unit_cost,
        total: li.total,
      }));

    try {
      let savedBillId: string;
      
      if (isEditing && bill) {
        await updateBill.mutateAsync({
          id: bill.id,
          bill: { ...billData, paid_amount: bill.paid_amount },
          lineItems: lineItemsData,
        });
        savedBillId = bill.id;
      } else {
        const result = await addBill.mutateAsync({
          bill: billData,
          lineItems: lineItemsData,
        });
        savedBillId = result.id;
      }

      // Finalize pending attachments for new bills
      if (!isEditing && pendingAttachments.length > 0 && user) {
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

      // Sync to QuickBooks if connected and not a draft
      if (qbConfig?.is_connected && status !== 'draft') {
        setIsSyncing(true);
        try {
          await syncToQB.mutateAsync(savedBillId);
          toast.success("Bill saved and synced to QuickBooks");
        } catch (qbError) {
          console.error('QuickBooks sync error:', qbError);
          toast.warning("Bill saved locally, but QuickBooks sync failed. You can sync later.");
        } finally {
          setIsSyncing(false);
        }
      } else {
        toast.success(isEditing ? "Bill updated" : "Bill created");
      }

      navigate("/vendor-bills");
    } catch (error) {
      // Error handled by mutation
    }
  };

  const autoExpandTextarea = (ref: React.RefObject<HTMLTextAreaElement>) => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${Math.max(80, ref.current.scrollHeight)}px`;
    }
  };

  return (
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
              <Label>Bill Date *</Label>
              <Input
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
              />
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
                      <Input
                        type="number"
                        min="0"
                        step="1"
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
          
          <Button variant="outline" className="w-full mt-4" onClick={addLineItem}>
            <Plus className="h-4 w-4 mr-2" />
            Add Line
          </Button>

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

      {/* Attachments Section - Only for new bills */}
      {!isEditing && (
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
  );
}
