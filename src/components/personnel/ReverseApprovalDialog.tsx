import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle } from "lucide-react";

interface ReverseApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
  registrantName: string;
  hasPersonnelRecord?: boolean;
  hasVendorRecord?: boolean;
  hasCustomerRecord?: boolean;
  isLoading?: boolean;
}

export const ReverseApprovalDialog = ({
  open,
  onOpenChange,
  onConfirm,
  registrantName,
  hasPersonnelRecord = false,
  hasVendorRecord = false,
  hasCustomerRecord = false,
  isLoading = false,
}: ReverseApprovalDialogProps) => {
  const [reason, setReason] = useState("");

  const handleConfirm = async () => {
    await onConfirm(reason);
    setReason("");
  };

  const affectedRecords = [
    hasPersonnelRecord && "Personnel record will be set to inactive",
    hasVendorRecord && "Vendor record will be set to inactive",
    hasCustomerRecord && "Customer record will be marked as reversed",
  ].filter(Boolean);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Reverse Approval
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to reverse the approval for{" "}
                <span className="font-medium text-foreground">{registrantName}</span>?
                This will set the registration back to pending status.
              </p>
              {affectedRecords.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm">
                  <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">
                    The following changes will be made:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    {affectedRecords.map((record, idx) => (
                      <li key={idx}>{record}</li>
                    ))}
                    <li>Any active onboarding links will be revoked</li>
                    <li>Registration will return to pending for re-approval</li>
                  </ul>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="reverse-reason">Reason for reversal</Label>
          <Textarea
            id="reverse-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason for reversing the approval..."
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-amber-600 text-white hover:bg-amber-700"
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Reverse Approval
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
