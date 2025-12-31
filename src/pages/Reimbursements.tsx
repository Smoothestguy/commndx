import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAllReimbursements, useUpdateReimbursementStatus } from "@/integrations/supabase/hooks/usePortal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { Check, X, DollarSign, Eye, Receipt, Loader2, Download } from "lucide-react";
import { downloadReceipt, getReceiptFilename } from "@/utils/receiptDownload";
import { toast } from "sonner";
import { TablePagination } from "@/components/shared/TablePagination";
import type { Reimbursement } from "@/types/portal";

type StatusFilter = "all" | "pending" | "approved" | "rejected" | "paid";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  paid: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function Reimbursements() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedReimbursement, setSelectedReimbursement] = useState<Reimbursement | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "pay" | null>(null);
  const [notes, setNotes] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: reimbursements, isLoading } = useAllReimbursements(
    statusFilter === "all" ? undefined : statusFilter
  );
  const updateStatus = useUpdateReimbursementStatus();

  const totalCount = reimbursements?.length || 0;
  const paginatedData = reimbursements?.slice((page - 1) * rowsPerPage, page * rowsPerPage) || [];

  const pendingTotal = reimbursements?.filter(r => r.status === "pending").reduce((sum, r) => sum + r.amount, 0) || 0;
  const approvedTotal = reimbursements?.filter(r => r.status === "approved").reduce((sum, r) => sum + r.amount, 0) || 0;
  const paidTotal = reimbursements?.filter(r => r.status === "paid").reduce((sum, r) => sum + r.amount, 0) || 0;

  const handleAction = async () => {
    if (!selectedReimbursement || !actionType) return;

    const newStatus = actionType === "approve" ? "approved" : actionType === "reject" ? "rejected" : "paid";

    try {
      await updateStatus.mutateAsync({
        id: selectedReimbursement.id,
        status: newStatus,
        notes: notes || undefined,
      });
      toast.success(`Reimbursement ${newStatus}`);
      setSelectedReimbursement(null);
      setActionType(null);
      setNotes("");
    } catch (error) {
      toast.error("Failed to update reimbursement");
    }
  };

  const openActionDialog = (reimbursement: Reimbursement, action: "approve" | "reject" | "pay") => {
    setSelectedReimbursement(reimbursement);
    setActionType(action);
    setNotes(reimbursement.notes || "");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reimbursements</h1>
          <p className="text-muted-foreground">Manage personnel expense reimbursement requests</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Receipt className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${pendingTotal.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {reimbursements?.filter(r => r.status === "pending").length || 0} requests awaiting review
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <Check className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${approvedTotal.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {reimbursements?.filter(r => r.status === "approved").length || 0} awaiting payment
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${paidTotal.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {reimbursements?.filter(r => r.status === "paid").length || 0} completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Reimbursement Requests</CardTitle>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : paginatedData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reimbursement requests found
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Personnel</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((reimbursement) => (
                    <TableRow key={reimbursement.id}>
                      <TableCell className="font-medium">
                        <button
                          onClick={() => navigate(`/personnel/${reimbursement.personnel_id}`)}
                          className="hover:underline text-primary text-left"
                        >
                          {(reimbursement as any).personnel?.first_name} {(reimbursement as any).personnel?.last_name}
                        </button>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {reimbursement.description}
                      </TableCell>
                      <TableCell>{reimbursement.category}</TableCell>
                      <TableCell>{reimbursement.project?.name || "—"}</TableCell>
                      <TableCell className="font-medium">${reimbursement.amount.toFixed(2)}</TableCell>
                      <TableCell>{format(new Date(reimbursement.submitted_at), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[reimbursement.status]}>
                          {reimbursement.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {reimbursement.receipt_url ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewUrl(reimbursement.receipt_url)}
                              title="Preview receipt"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                const filename = getReceiptFilename(
                                  reimbursement.description,
                                  reimbursement.submitted_at,
                                  reimbursement.receipt_url!
                                );
                                const result = await downloadReceipt(reimbursement.receipt_url!, filename);
                                if (!result.success) {
                                  toast.error(result.error || "Receipt file unavailable");
                                }
                              }}
                              title="Download receipt"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {reimbursement.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openActionDialog(reimbursement as Reimbursement, "approve")}
                                className="text-green-600 hover:text-green-700 hover:bg-green-100"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openActionDialog(reimbursement as Reimbursement, "reject")}
                                className="text-red-600 hover:text-red-700 hover:bg-red-100"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {reimbursement.status === "approved" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openActionDialog(reimbursement as Reimbursement, "pay")}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                            >
                              <DollarSign className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={page}
                totalCount={totalCount}
                rowsPerPage={rowsPerPage}
                onPageChange={setPage}
                onRowsPerPageChange={(v) => { setRowsPerPage(v); setPage(1); }}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={!!actionType} onOpenChange={() => { setActionType(null); setSelectedReimbursement(null); setNotes(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" && "Approve Reimbursement"}
              {actionType === "reject" && "Reject Reimbursement"}
              {actionType === "pay" && "Mark as Paid"}
            </DialogTitle>
            <DialogDescription>
              {selectedReimbursement && (
                <span>
                  {selectedReimbursement.description} - ${selectedReimbursement.amount.toFixed(2)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionType(null); setSelectedReimbursement(null); setNotes(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={updateStatus.isPending}
              variant={actionType === "reject" ? "destructive" : "default"}
            >
              {updateStatus.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {actionType === "approve" && "Approve"}
              {actionType === "reject" && "Reject"}
              {actionType === "pay" && "Mark Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Receipt Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-center max-h-[70vh] overflow-auto">
                {previewUrl.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[70vh] border-0"
                    title="Receipt PDF"
                  />
                ) : (
                  <img src={previewUrl} alt="Receipt" className="max-w-full h-auto" />
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
