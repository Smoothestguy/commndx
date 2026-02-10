import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatLocalDate, parseLocalDate } from "@/lib/dateUtils";
import { Eye, MoreHorizontal, Edit, Trash2, DollarSign, RefreshCw, CheckCircle2, AlertCircle, Loader2, Pencil } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { IndeterminateCheckbox } from "@/components/ui/indeterminate-checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VendorBill, useDeleteVendorBill, useHardDeleteVendorBill } from "@/integrations/supabase/hooks/useVendorBills";
import { useQuickBooksConfig, useQuickBooksBillMapping, useSyncVendorBillToQB } from "@/integrations/supabase/hooks/useQuickBooks";
import { VendorBillPaymentDialog } from "./VendorBillPaymentDialog";
import { BulkBillPaymentDialog } from "./BulkBillPaymentDialog";
import { VendorBillBulkEditModal } from "./VendorBillBulkEditModal";
import { VendorBillCard } from "./VendorBillCard";
import { VendorBillSyncErrorDialog } from "./VendorBillSyncErrorDialog";
import { useIsMobile, useIsTablet } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface VendorBillTableProps {
  bills: VendorBill[];
}

const statusStyles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  partially_paid: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  void: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  open: "Open",
  partially_paid: "Partial",
  paid: "Paid",
  void: "Void",
};

function BillRow({ 
  bill, 
  isSelected, 
  onSelect, 
  onDelete,
  onHardDelete,
  onRecordPayment,
  onSyncError,
}: { 
  bill: VendorBill; 
  isSelected: boolean; 
  onSelect: (checked: boolean) => void;
  onDelete: (id: string) => void;
  onHardDelete: (id: string) => void;
  onRecordPayment: (id: string) => void;
  onSyncError: (billId: string, errorMessage: string, vendorId?: string, vendorName?: string) => void;
}) {
  const navigate = useNavigate();
  const { data: qbConfig } = useQuickBooksConfig();
  const { data: billMapping, refetch: refetchMapping } = useQuickBooksBillMapping(bill.id);
  const syncToQB = useSyncVendorBillToQB();
  const [isSyncing, setIsSyncing] = useState(false);

  const isOverdue = parseLocalDate(bill.due_date) < new Date() && bill.status !== "paid" && bill.status !== "void";
  const isSynced = billMapping?.sync_status === 'synced';
  const hasSyncError = billMapping?.sync_status === 'error';
  const canSync = qbConfig?.is_connected && bill.status !== 'draft' && !isSynced;
  const errorMessage = billMapping?.error_message;

  const handleSyncToQB = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSyncing(true);
    try {
      const result = await syncToQB.mutateAsync(bill.id);
      if (result.success) {
        toast.success("Bill synced to QuickBooks");
        refetchMapping();
      } else {
        // Show error dialog
        onSyncError(bill.id, result.error || "Unknown error", bill.vendor_id, bill.vendor_name);
        refetchMapping();
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      onSyncError(bill.id, errorMsg, bill.vendor_id, bill.vendor_name);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    const rounded = Math.round(amount * 100) / 100;
    const normalized = rounded === 0 ? 0 : rounded;
    return `$${normalized.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  };

  return (
    <TableRow 
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => navigate(`/vendor-bills/${bill.id}${window.location.search}`)}
    >
      <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
        />
      </TableCell>
      <TableCell className="w-16" onClick={(e) => e.stopPropagation()}>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0"
          onClick={() => navigate(`/vendor-bills/${bill.id}${window.location.search}`)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      </TableCell>
      <TableCell className="font-medium">{bill.number}</TableCell>
      <TableCell>{bill.vendor_name}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Badge className={statusStyles[bill.status]}>{statusLabels[bill.status]}</Badge>
          {isOverdue && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
        </div>
      </TableCell>
      <TableCell>{formatLocalDate(bill.bill_date, "MMM d, yyyy")}</TableCell>
      <TableCell className={isOverdue ? "text-destructive font-medium" : ""}>
        {formatLocalDate(bill.due_date, "MMM d, yyyy")}
      </TableCell>
      <TableCell className="text-right font-medium">{formatCurrency(Number(bill.total))}</TableCell>
      <TableCell className="text-right font-medium text-orange-600 dark:text-orange-400">
        {formatCurrency(Number(bill.remaining_amount))}
      </TableCell>
      {qbConfig?.is_connected && (
        <TableCell>
          {isSynced && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3" />
              Synced
            </Badge>
          )}
          {hasSyncError && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 gap-1 text-xs cursor-help"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSyncError(bill.id, errorMessage || "Sync failed", bill.vendor_id, bill.vendor_name);
                    }}
                  >
                    <AlertCircle className="h-3 w-3" />
                    Error
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">{errorMessage || "QuickBooks sync failed. Click for details."}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </TableCell>
      )}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/vendor-bills/${bill.id}${window.location.search}`)}>
              <Eye className="mr-2 h-4 w-4" />
              View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/vendor-bills/${bill.id}/edit${window.location.search}`)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            {bill.status !== "paid" && bill.status !== "void" && (
              <DropdownMenuItem onClick={() => onRecordPayment(bill.id)}>
                <DollarSign className="mr-2 h-4 w-4" />
                Record Payment
              </DropdownMenuItem>
            )}
            {(canSync || hasSyncError) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSyncToQB} disabled={isSyncing}>
                  {isSyncing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {hasSyncError ? "Retry QuickBooks Sync" : "Sync to QuickBooks"}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete(bill.id)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onHardDelete(bill.id)}
              className="text-destructive font-medium"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Forever
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export function VendorBillTable({ bills }: VendorBillTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [hardDeleteId, setHardDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkPaymentOpen, setBulkPaymentOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [paymentBillId, setPaymentBillId] = useState<string | null>(null);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  
  // Sync error dialog state
  const [syncErrorDialogOpen, setSyncErrorDialogOpen] = useState(false);
  const [syncErrorMessage, setSyncErrorMessage] = useState("");
  const [syncErrorBillId, setSyncErrorBillId] = useState<string | null>(null);
  const [syncErrorVendorId, setSyncErrorVendorId] = useState<string | undefined>();
  const [syncErrorVendorName, setSyncErrorVendorName] = useState<string | undefined>();
  
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: qbConfig } = useQuickBooksConfig();
  const deleteBill = useDeleteVendorBill();
  const hardDeleteBill = useHardDeleteVendorBill();
  const syncToQB = useSyncVendorBillToQB();

  const handleSyncError = (billId: string, errorMessage: string, vendorId?: string, vendorName?: string) => {
    setSyncErrorBillId(billId);
    setSyncErrorMessage(errorMessage);
    setSyncErrorVendorId(vendorId);
    setSyncErrorVendorName(vendorName);
    setSyncErrorDialogOpen(true);
  };

  const handleRetrySyncFromDialog = async () => {
    if (!syncErrorBillId) return;
    const result = await syncToQB.mutateAsync(syncErrorBillId);
    if (!result.success) {
      throw new Error(result.error || "Sync failed");
    }
  };

  const allSelected = bills.length > 0 && selectedIds.size === bills.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < bills.length;

  // Calculate running total for selected bills
  const selectionSummary = useMemo(() => {
    const selectedBills = bills.filter(bill => selectedIds.has(bill.id));
    const total = selectedBills.reduce((sum, bill) => sum + Number(bill.total), 0);
    return {
      count: selectedBills.length,
      total,
    };
  }, [bills, selectedIds]);

  const formatCurrency = (amount: number) => {
    const rounded = Math.round(amount * 100) / 100;
    const normalized = rounded === 0 ? 0 : rounded;
    return `$${normalized.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(bills.map(b => b.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      await deleteBill.mutateAsync(id);
    }
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  };

  const handleBulkSync = async () => {
    if (!qbConfig?.is_connected) return;
    
    setIsBulkSyncing(true);
    let successCount = 0;
    let errorCount = 0;
    
    // Get selected bills to sync
    const billsToSync = bills.filter(b => selectedIds.has(b.id));
    
    for (const bill of billsToSync) {
      try {
        await syncToQB.mutateAsync(bill.id);
        successCount++;
      } catch (error) {
        console.error("Failed to sync bill:", bill.id, error);
        errorCount++;
      }
    }
    
    setIsBulkSyncing(false);
    
    if (successCount > 0 && errorCount === 0) {
      toast.success(`Successfully synced ${successCount} bill${successCount > 1 ? 's' : ''} to QuickBooks`);
    } else if (successCount > 0 && errorCount > 0) {
      toast.warning(`Synced ${successCount} bill${successCount > 1 ? 's' : ''}, ${errorCount} failed`);
    } else if (errorCount > 0) {
      toast.error(`Failed to sync ${errorCount} bill${errorCount > 1 ? 's' : ''}`);
    }
    
    setSelectedIds(new Set());
  };

  const handleBulkEdit = async (updates: Record<string, any>, onProgress: (p: { current: number; total: number; phase: "updating" | "syncing" }) => void): Promise<{ success: number; failed: number }> => {
    const ids = Array.from(selectedIds);
    const billUpdates: Record<string, any> = {};
    
    // Bill-level fields
    if (updates.vendor_id) billUpdates.vendor_id = updates.vendor_id;
    if (updates.vendor_name) billUpdates.vendor_name = updates.vendor_name;
    if (updates.account !== undefined) billUpdates.account = updates.account || null;
    if (updates.class !== undefined) billUpdates.class = updates.class || null;
    if (updates.location !== undefined) billUpdates.location = updates.location || null;
    if (updates.memo !== undefined) billUpdates.memo = updates.memo || null;
    if (updates.notes !== undefined) billUpdates.notes = updates.notes || null;
    if (updates.status) billUpdates.status = updates.status;

    const hasBillUpdates = Object.keys(billUpdates).length > 0;
    const hasCategoryUpdate = updates.category_id !== undefined;
    const categoryValue = hasCategoryUpdate ? (updates.category_id || null) : null;
    const shouldSync = qbConfig?.is_connected;

    let successCount = 0;
    let failCount = 0;

    // Process each bill sequentially
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      onProgress({ current: i + 1, total: ids.length, phase: "updating" });

      try {
        // 1. Update bill-level fields
        if (hasBillUpdates) {
          const { error } = await supabase
            .from("vendor_bills")
            .update(billUpdates)
            .eq("id", id);
          if (error) throw error;
        }

        // 2. Update line item category
        if (hasCategoryUpdate) {
          const { error } = await supabase
            .from("vendor_bill_line_items")
            .update({ category_id: categoryValue })
            .eq("bill_id", id);
          if (error) throw error;
        }

        // 3. Sync to QuickBooks if connected
        if (shouldSync) {
          onProgress({ current: i + 1, total: ids.length, phase: "syncing" });
          try {
            await syncToQB.mutateAsync(id);
          } catch (error) {
            console.error("QB sync failed for bill:", id, error);
            // Don't count as failure - DB update succeeded
          }
        }

        successCount++;
      } catch (error) {
        console.error("Failed to update bill:", id, error);
        failCount++;
      }

      // Yield to UI thread
      await new Promise(r => setTimeout(r, 50));
    }

    // Show summary toast
    if (failCount === 0) {
      toast.success(`Updated ${successCount} bill${successCount !== 1 ? "s" : ""}${shouldSync ? " and synced to QuickBooks" : ""}`);
    } else {
      toast.warning(`${successCount} updated, ${failCount} failed`);
    }

    queryClient.invalidateQueries({ queryKey: ["vendor-bills"] });
    queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
    queryClient.invalidateQueries({ queryKey: ["quickbooks-bill-mappings"] });
    setSelectedIds(new Set());

    return { success: successCount, failed: failCount };
  };

  const selectedBillsList = useMemo(
    () => bills.filter((b) => selectedIds.has(b.id)),
    [bills, selectedIds]
  );

  const paymentBill = bills.find(b => b.id === paymentBillId);

  return (
    <>
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 sm:gap-4 p-3 bg-muted/95 backdrop-blur-sm rounded-lg mb-4 border shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mr-auto">
            <span className="text-sm font-medium">
              {selectionSummary.count} bill{selectionSummary.count !== 1 ? 's' : ''} selected
            </span>
            <span className="text-sm font-bold text-primary">
              Total: {formatCurrency(selectionSummary.total)}
            </span>
          </div>
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => setBulkEditOpen(true)}
          >
            <Pencil className="h-4 w-4 mr-1" />
            Bulk Edit
          </Button>
          <Button 
            variant="default" 
            size="sm"
            onClick={() => setBulkPaymentOpen(true)}
          >
            <DollarSign className="h-4 w-4 mr-1" />
            Record Payments
          </Button>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete Selected
          </Button>
          {qbConfig?.is_connected && (
            <Button 
              variant="secondary" 
              size="sm"
              onClick={handleBulkSync}
              disabled={isBulkSyncing}
            >
              {isBulkSyncing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              {isBulkSyncing ? "Syncing..." : "Sync to QuickBooks"}
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear Selection
          </Button>
        </div>
      )}

      {/* Mobile Card View */}
      {isMobile || isTablet ? (
        <div className="space-y-3">
          {bills.map((bill) => (
            <VendorBillCard
              key={bill.id}
              bill={bill}
              onView={(id) => navigate(`/vendor-bills/${id}${window.location.search}`)}
              onEdit={(id) => navigate(`/vendor-bills/${id}/edit${window.location.search}`)}
              onDelete={setDeleteId}
              onHardDelete={setHardDeleteId}
              onRecordPayment={setPaymentBillId}
            />
          ))}
        </div>
      ) : (
        /* Desktop Table View */
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10">
                  <IndeterminateCheckbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-16">Action</TableHead>
                <TableHead>Bill #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Bill Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                {qbConfig?.is_connected && <TableHead>QB Status</TableHead>}
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((bill) => (
                <BillRow
                  key={bill.id}
                  bill={bill}
                  isSelected={selectedIds.has(bill.id)}
                  onSelect={(checked) => handleSelectOne(bill.id, checked)}
                  onDelete={setDeleteId}
                  onHardDelete={setHardDeleteId}
                  onRecordPayment={setPaymentBillId}
                  onSyncError={handleSyncError}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Single Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bill</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this bill? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) deleteBill.mutate(deleteId);
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hard Delete Forever Dialog */}
      <AlertDialog open={!!hardDeleteId} onOpenChange={() => setHardDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Permanently Delete Bill</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>This will <strong>permanently delete</strong> this bill and all its:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                  <li>Line items</li>
                  <li>Payments and payment attachments</li>
                  <li>Attachments</li>
                  <li>QuickBooks sync data</li>
                </ul>
                <p className="mt-2 font-medium text-destructive">
                  This action cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (hardDeleteId) hardDeleteBill.mutate(hardDeleteId);
                setHardDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Bills</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} bills? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Dialog */}
      {paymentBill && (
        <VendorBillPaymentDialog
          open={!!paymentBillId}
          onOpenChange={() => setPaymentBillId(null)}
          billId={paymentBill.id}
          remainingAmount={Number(paymentBill.remaining_amount)}
        />
      )}

      {/* Bulk Payment Dialog */}
      <BulkBillPaymentDialog
        open={bulkPaymentOpen}
        onOpenChange={setBulkPaymentOpen}
        bills={bills}
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      {/* QuickBooks Sync Error Dialog */}
      <VendorBillSyncErrorDialog
        open={syncErrorDialogOpen}
        onOpenChange={setSyncErrorDialogOpen}
        errorMessage={syncErrorMessage}
        vendorId={syncErrorVendorId}
        vendorName={syncErrorVendorName}
        billId={syncErrorBillId || undefined}
        onRetrySync={handleRetrySyncFromDialog}
      />

      {/* Bulk Edit Modal */}
      <VendorBillBulkEditModal
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        selectedBills={selectedBillsList}
        onApply={handleBulkEdit}
      />
    </>
  );
}
