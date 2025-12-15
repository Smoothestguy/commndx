import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import { FileText, Building2, DollarSign, Receipt } from "lucide-react";

interface POData {
  id: string;
  number: string;
  project_name: string;
  status: string;
  subtotal: number;
  total: number;
  total_addendum_amount: number;
  billed_amount: number | null;
}

interface POPreviewDialogProps {
  po: POData | null;
  open: boolean;
  onClose: () => void;
}

export function POPreviewDialog({ po, open, onClose }: POPreviewDialogProps) {
  if (!po) return null;

  const revisedTotal = (po.total || 0) + (po.total_addendum_amount || 0);
  const billedAmount = po.billed_amount || 0;
  const remainingAmount = revisedTotal - billedAmount;
  const billingProgress = revisedTotal > 0 ? (billedAmount / revisedTotal) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {po.number}
          </DialogTitle>
          <DialogDescription>
            Purchase order details
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={po.status as any} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground">Project:</span>{" "}
                <span className="font-medium">{po.project_name}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground">Original Total:</span>{" "}
                <span className="font-medium">{formatCurrency(po.total)}</span>
              </div>
            </div>

            {po.total_addendum_amount > 0 && (
              <div className="flex items-center gap-3 text-sm">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">Addendums:</span>{" "}
                  <span className="font-medium text-primary">+{formatCurrency(po.total_addendum_amount)}</span>
                </div>
              </div>
            )}

            <div className="pt-2 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Revised Total</span>
                <span className="font-semibold">{formatCurrency(revisedTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Billed to Date</span>
                <span className="font-medium text-green-600">{formatCurrency(billedAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-medium">{formatCurrency(remainingAmount)}</span>
              </div>
            </div>

            <div className="pt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Billing Progress</span>
                <span>{billingProgress.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(billingProgress, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
