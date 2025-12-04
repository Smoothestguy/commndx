import { useState } from "react";
import { useSendPortalInvitation } from "@/integrations/supabase/hooks/usePortal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Mail, UserPlus, Check } from "lucide-react";

interface InviteToPortalDialogProps {
  personnelId: string;
  personnelName: string;
  personnelEmail: string;
  hasExistingInvitation?: boolean;
  isLinked?: boolean;
}

export function InviteToPortalDialog({ 
  personnelId, 
  personnelName, 
  personnelEmail,
  hasExistingInvitation,
  isLinked 
}: InviteToPortalDialogProps) {
  const [open, setOpen] = useState(false);
  const sendInvitation = useSendPortalInvitation();

  const handleSendInvitation = async () => {
    try {
      await sendInvitation.mutateAsync({
        personnelId,
        email: personnelEmail,
        personnelName,
      });
      
      setTimeout(() => {
        setOpen(false);
      }, 1500);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  if (isLinked) {
    return (
      <Button variant="outline" disabled>
        <Check className="h-4 w-4 mr-2" />
        Already Linked
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="h-4 w-4 mr-2" />
          {hasExistingInvitation ? "Resend Invitation" : "Invite to Portal"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to Personnel Portal</DialogTitle>
          <DialogDescription>
            Send an email invitation to {personnelName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{personnelName}</p>
                <p className="text-sm text-muted-foreground">{personnelEmail}</p>
              </div>
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>This will send an email with:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>A secure invitation link</li>
              <li>Instructions to create their portal account</li>
              <li>Overview of portal features</li>
            </ul>
          </div>
          
          {hasExistingInvitation && (
            <div className="text-sm text-orange-600 bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg">
              Note: This will replace any existing pending invitation.
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendInvitation} 
              disabled={sendInvitation.isPending || sendInvitation.isSuccess}
            >
              {sendInvitation.isSuccess ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Invitation Sent!
                </>
              ) : sendInvitation.isPending ? (
                "Sending..."
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
