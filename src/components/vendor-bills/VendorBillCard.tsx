import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Eye, Edit, Trash2, DollarSign, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { VendorBill } from "@/integrations/supabase/hooks/useVendorBills";
import { useQuickBooksConfig, useQuickBooksBillMapping, useSyncVendorBillToQB } from "@/integrations/supabase/hooks/useQuickBooks";
import { formatLocalDate, parseLocalDate } from "@/lib/dateUtils";
import { toast } from "sonner";
import { useState } from "react";

interface VendorBillCardProps {
  bill: VendorBill;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onHardDelete?: (id: string) => void;
  onRecordPayment: (id: string) => void;
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

export function VendorBillCard({ bill, onView, onEdit, onDelete, onHardDelete, onRecordPayment }: VendorBillCardProps) {
  const isOverdue = parseLocalDate(bill.due_date) < new Date() && bill.status !== "paid" && bill.status !== "void";
  const { data: qbConfig } = useQuickBooksConfig();
  const { data: billMapping, refetch: refetchMapping } = useQuickBooksBillMapping(bill.id);
  const syncToQB = useSyncVendorBillToQB();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncToQB = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSyncing(true);
    try {
      await syncToQB.mutateAsync(bill.id);
      toast.success("Bill synced to QuickBooks");
      refetchMapping();
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsSyncing(false);
    }
  };

  const isSynced = billMapping?.sync_status === 'synced';
  const hasSyncError = billMapping?.sync_status === 'error';
  const canSync = qbConfig?.is_connected && bill.status !== 'draft' && !isSynced;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onView(bill.id)}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-foreground">{bill.number}</p>
                <p className="text-sm text-muted-foreground">{bill.vendor_name}</p>
              </div>
              <div className="flex items-center gap-2">
                {/* QuickBooks sync status */}
                {qbConfig?.is_connected && (
                  <>
                    {isSynced && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        QB Synced
                      </Badge>
                    )}
                    {hasSyncError && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Sync Error
                      </Badge>
                    )}
                  </>
                )}
                <Badge className={statusStyles[bill.status]}>{statusLabels[bill.status]}</Badge>
                {isOverdue && <Badge variant="destructive">Overdue</Badge>}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(bill.id); }}>
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(bill.id); }}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    {bill.status !== "paid" && bill.status !== "void" && (
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRecordPayment(bill.id); }}>
                        <DollarSign className="mr-2 h-4 w-4" />
                        Record Payment
                      </DropdownMenuItem>
                    )}
                    {canSync && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleSyncToQB} disabled={isSyncing}>
                          {isSyncing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                          )}
                          Sync to QuickBooks
                        </DropdownMenuItem>
                      </>
                    )}
                    {hasSyncError && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleSyncToQB} disabled={isSyncing}>
                          {isSyncing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                          )}
                          Retry QuickBooks Sync
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); onDelete(bill.id); }}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                    {onHardDelete && (
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); onHardDelete(bill.id); }}
                        className="text-destructive font-medium"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Forever
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Bill Date</p>
                <p className="font-medium">{formatLocalDate(bill.bill_date, "MMM d, yyyy")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Due Date</p>
                <p className={`font-medium ${isOverdue ? "text-destructive" : ""}`}>
                  {formatLocalDate(bill.due_date, "MMM d, yyyy")}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-semibold">${((r) => r === 0 ? 0 : r)(Math.round(Number(bill.total) * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Remaining</p>
                <p className="font-semibold text-orange-600 dark:text-orange-400">
                  ${((r) => r === 0 ? 0 : r)(Math.round(Number(bill.remaining_amount) * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => onView(bill.id)}>
          <Eye className="mr-2 h-4 w-4" />
          View
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onEdit(bill.id)}>
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </ContextMenuItem>
        {bill.status !== "paid" && bill.status !== "void" && (
          <ContextMenuItem onClick={() => onRecordPayment(bill.id)}>
            <DollarSign className="mr-2 h-4 w-4" />
            Record Payment
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem 
          onClick={() => onDelete(bill.id)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
        {onHardDelete && (
          <ContextMenuItem 
            onClick={() => onHardDelete(bill.id)}
            className="text-destructive focus:text-destructive font-medium"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Forever
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
