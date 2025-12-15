import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { FileText, Calendar, Receipt } from "lucide-react";

interface BillData {
  id: string;
  number: string;
  status: string;
  total: number;
  bill_date: string;
  submitted_at: string | null;
  po_number: string;
}

interface BillPreviewDialogProps {
  bill: BillData | null;
  open: boolean;
  onClose: () => void;
}

export function BillPreviewDialog({ bill, open, onClose }: BillPreviewDialogProps) {
  if (!bill) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {bill.number}
          </DialogTitle>
          <DialogDescription>
            Vendor bill details
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={bill.status as any} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground">PO #:</span>{" "}
                <span className="font-medium">{bill.po_number}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground">Bill Date:</span>{" "}
                <span className="font-medium">{format(parseISO(bill.bill_date), "MMM d, yyyy")}</span>
              </div>
            </div>

            {bill.submitted_at && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">Submitted:</span>{" "}
                  <span className="font-medium">{format(parseISO(bill.submitted_at), "MMM d, yyyy 'at' h:mm a")}</span>
                </div>
              </div>
            )}

            <div className="pt-3 border-t">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Amount</span>
                <span className="text-xl font-bold">{formatCurrency(bill.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
