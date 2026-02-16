import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus, Send } from "lucide-react";

interface AddVendorChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onManualEntry: () => void;
  onSendInvite: () => void;
}

export function AddVendorChoiceDialog({
  open,
  onOpenChange,
  onManualEntry,
  onSendInvite,
}: AddVendorChoiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Vendor</DialogTitle>
          <DialogDescription>
            Choose how you'd like to add a new vendor.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Button
            variant="outline"
            className="h-auto p-4 flex flex-col items-start gap-1 text-left"
            onClick={() => {
              onOpenChange(false);
              onManualEntry();
            }}
          >
            <div className="flex items-center gap-2 font-semibold">
              <UserPlus className="h-4 w-4" />
              Enter Vendor Manually
            </div>
            <p className="text-xs text-muted-foreground font-normal">
              Fill out vendor details yourself and create the record immediately.
            </p>
          </Button>

          <Button
            variant="outline"
            className="h-auto p-4 flex flex-col items-start gap-1 text-left"
            onClick={() => {
              onOpenChange(false);
              onSendInvite();
            }}
          >
            <div className="flex items-center gap-2 font-semibold">
              <Send className="h-4 w-4" />
              Send Onboarding Link
            </div>
            <p className="text-xs text-muted-foreground font-normal">
              Send an invitation link so the vendor can fill out their own information.
            </p>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
