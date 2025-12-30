import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useReopenPurchaseOrder } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { LockOpen } from "lucide-react";

interface ReopenPODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
}

export function ReopenPODialog({
  open,
  onOpenChange,
  purchaseOrderId,
  purchaseOrderNumber,
}: ReopenPODialogProps) {
  const reopenPO = useReopenPurchaseOrder();

  const handleReopen = async () => {
    try {
      await reopenPO.mutateAsync(purchaseOrderId);
      onOpenChange(false);
    } catch (error) {
      console.error("Error reopening PO:", error);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <LockOpen className="h-5 w-5 text-primary" />
            Reopen Purchase Order {purchaseOrderNumber}?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Reopening this purchase order will allow new vendor bills to be
              created against it again.
            </p>
            <p>
              The PO status will be set back to "in-progress".
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleReopen}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {reopenPO.isPending ? "Reopening..." : "Reopen PO"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
