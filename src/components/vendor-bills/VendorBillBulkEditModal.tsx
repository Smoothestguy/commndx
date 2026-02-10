import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Pencil, CheckCircle2, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useVendors } from "@/integrations/supabase/hooks/useVendors";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VendorBill } from "@/integrations/supabase/hooks/useVendorBills";

interface BulkEditUpdates {
  vendor_id?: string;
  vendor_name?: string;
  category_id?: string;
  account?: string;
  class?: string;
  location?: string;
  memo?: string;
  notes?: string;
  status?: string;
}

export interface BulkEditProgress {
  current: number;
  total: number;
  phase: "updating" | "syncing";
}

interface VendorBillBulkEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedBills: VendorBill[];
  onApply: (updates: BulkEditUpdates, onProgress: (p: BulkEditProgress) => void) => Promise<{ success: number; failed: number }>;
}

const CLEAR_VALUE = "__clear__";

export function VendorBillBulkEditModal({
  open,
  onOpenChange,
  selectedBills,
  onApply,
}: VendorBillBulkEditModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [account, setAccount] = useState("");
  const [billClass, setBillClass] = useState("");
  const [location, setLocation] = useState("");
  const [memo, setMemo] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState<BulkEditProgress | null>(null);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  const { data: vendors } = useVendors();
  const { data: categories } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleApply = async () => {
    const updates: BulkEditUpdates = {};
    
    if (vendorId) {
      const vendor = vendors?.find((v) => v.id === vendorId);
      if (vendor) {
        updates.vendor_id = vendor.id;
        updates.vendor_name = vendor.name;
      }
    }
    if (categoryId) {
      updates.category_id = categoryId === CLEAR_VALUE ? "" : categoryId;
    }
    if (account) {
      updates.account = account === CLEAR_VALUE ? "" : account;
    }
    if (billClass) {
      updates.class = billClass === CLEAR_VALUE ? "" : billClass;
    }
    if (location) {
      updates.location = location === CLEAR_VALUE ? "" : location;
    }
    if (memo) {
      updates.memo = memo;
    }
    if (notes) {
      updates.notes = notes;
    }
    if (status) {
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) return;

    setIsLoading(true);
    setProgress({ current: 0, total: selectedBills.length, phase: "updating" });
    setResult(null);

    try {
      const res = await onApply(updates, setProgress);
      setResult(res);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setVendorId("");
    setCategoryId("");
    setAccount("");
    setBillClass("");
    setLocation("");
    setMemo("");
    setNotes("");
    setStatus("");
    setProgress(null);
    setResult(null);
  };

  const handleClose = () => {
    if (isLoading) return;
    resetForm();
    onOpenChange(false);
  };

  const hasChanges = !!(vendorId || categoryId || account || billClass || location || memo || notes || status);

  const progressPercent = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  // Show result summary view
  if (result) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {result.failed === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              )}
              Bulk Edit Complete
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <p className="text-sm">
              <span className="font-medium text-green-700 dark:text-green-400">{result.success}</span> bill{result.success !== 1 ? "s" : ""} updated successfully
            </p>
            {result.failed > 0 && (
              <p className="text-sm">
                <span className="font-medium text-red-700 dark:text-red-400">{result.failed}</span> bill{result.failed !== 1 ? "s" : ""} failed
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Show progress view while processing
  if (isLoading && progress) {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[420px]" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing Bills...
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Progress value={progressPercent} className="h-3" />
            <p className="text-sm text-muted-foreground text-center">
              {progress.phase === "updating" ? "Updating" : "Syncing to QuickBooks"} record {progress.current} of {progress.total}...
            </p>
            <p className="text-xs text-muted-foreground text-center">
              {progressPercent}% complete — please don't close this window
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Normal form view
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Bulk Edit {selectedBills.length} Bill{selectedBills.length !== 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            Only filled fields will be updated. Leave fields empty to keep existing values.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Vendor */}
          <div className="space-y-1.5">
            <Label>Vendor</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger>
                <SelectValue placeholder="Keep existing vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors?.filter(v => v.status === "active").map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category (for line items) */}
          <div className="space-y-1.5">
            <Label>Category (all line items)</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Keep existing category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CLEAR_VALUE}>
                  <span className="text-muted-foreground">Clear category</span>
                </SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Account */}
          <div className="space-y-1.5">
            <Label>Account</Label>
            <Input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="Keep existing account"
            />
          </div>

          {/* Class */}
          <div className="space-y-1.5">
            <Label>Class</Label>
            <Input
              value={billClass}
              onChange={(e) => setBillClass(e.target.value)}
              placeholder="Keep existing class"
            />
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Keep existing location"
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Keep existing status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="void">Void</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Memo */}
          <div className="space-y-1.5">
            <Label>Memo</Label>
            <Textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Keep existing memo"
              rows={2}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Keep existing notes"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!hasChanges || isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Apply to {selectedBills.length} Bill{selectedBills.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
