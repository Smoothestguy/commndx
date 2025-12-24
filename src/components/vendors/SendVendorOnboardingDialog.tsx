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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSendVendorOnboardingInvitation } from "@/integrations/supabase/hooks/useVendorOnboarding";
import { Loader2, Send, FileText } from "lucide-react";

interface SendVendorOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  vendorName: string;
  vendorEmail: string;
}

export function SendVendorOnboardingDialog({
  open,
  onOpenChange,
  vendorId,
  vendorName,
  vendorEmail,
}: SendVendorOnboardingDialogProps) {
  const [email, setEmail] = useState(vendorEmail);
  const sendInvitation = useSendVendorOnboardingInvitation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await sendInvitation.mutateAsync({
      vendorId,
      vendorName,
      email,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Send Vendor Onboarding
          </DialogTitle>
          <DialogDescription>
            Send an onboarding form to <strong>{vendorName}</strong> to collect company information,
            W-9, insurance documents, and banking details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vendor@company.com"
              required
            />
            <p className="text-xs text-muted-foreground">
              The vendor will receive an email with a link to complete their registration.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium">The vendor will be asked to provide:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Company information & contact details</li>
              <li>Business address</li>
              <li>W-9 tax form with signature</li>
              <li>Banking details for payments</li>
              <li>Insurance certificate & license</li>
              <li>Signed vendor agreement</li>
            </ul>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sendInvitation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={sendInvitation.isPending}>
              {sendInvitation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
