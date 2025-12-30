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
import { useClosePurchaseOrder } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { Lock } from "lucide-react";

interface ClosePODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  remainingAmount: number;
}

export function ClosePODialog({
  open,
  onOpenChange,
  purchaseOrderId,
  purchaseOrderNumber,
  remainingAmount,
}: ClosePODialogProps) {
  const closePO = useClosePurchaseOrder();

  const handleClose = async () => {
    try {
      await closePO.mutateAsync(purchaseOrderId);
      onOpenChange(false);
    } catch (error) {
      console.error("Error closing PO:", error);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-warning" />
            Close Purchase Order {purchaseOrderNumber}?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Closing this purchase order will prevent any new vendor bills from being
              created against it.
            </p>
            {remainingAmount > 0 && (
              <p className="text-warning font-medium">
                Warning: This PO still has ${remainingAmount.toFixed(2)} unbilled.
              </p>
            )}
            <p className="text-muted-foreground text-sm">An administrator can reopen this PO if needed.</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleClose}
            className="bg-warning text-warning-foreground hover:bg-warning/90"
          >
            {closePO.isPending ? "Closing..." : "Close PO"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
