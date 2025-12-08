import { useState } from "react";
import { useSendPortalInvitation, useRevokePortalAccess } from "@/integrations/supabase/hooks/usePortal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Mail, UserPlus, Check, RefreshCw, ShieldOff, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

interface InviteToPortalDialogProps {
  personnelId: string;
  personnelName: string;
  personnelEmail: string;
  hasExistingInvitation?: boolean;
  existingInvitationDate?: string;
  isLinked?: boolean;
}

export function InviteToPortalDialog({ 
  personnelId, 
  personnelName, 
  personnelEmail,
  hasExistingInvitation,
  existingInvitationDate,
  isLinked 
}: InviteToPortalDialogProps) {
  const [open, setOpen] = useState(false);
  const sendInvitation = useSendPortalInvitation();
  const revokeAccess = useRevokePortalAccess();

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

  const handleRevokeAccess = async () => {
    await revokeAccess.mutateAsync(personnelId);
  };

  // Personnel has portal access - show access status and revoke option
  if (isLinked) {
    return (
      <div className="flex gap-2">
        <Button variant="outline" disabled className="gap-2">
          <ShieldCheck className="h-4 w-4 text-green-600" />
          Portal Access
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
              <ShieldOff className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke Portal Access</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove {personnelName}'s access to the personnel portal. 
                They will no longer be able to view their hours, projects, or submit reimbursements.
                You can re-invite them later if needed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleRevokeAccess}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={revokeAccess.isPending}
              >
                {revokeAccess.isPending ? "Revoking..." : "Revoke Access"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          {hasExistingInvitation ? (
            <>
              <RefreshCw className="h-4 w-4" />
              Resend Invitation
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              Invite to Portal
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {hasExistingInvitation ? "Resend Portal Invitation" : "Invite to Personnel Portal"}
          </DialogTitle>
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
          
          {hasExistingInvitation && existingInvitationDate && (
            <div className="text-sm text-orange-600 bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg">
              Previous invitation sent on {format(new Date(existingInvitationDate), "MMM dd, yyyy 'at' h:mm a")}.
              Sending a new invitation will replace the existing one.
            </div>
          )}
          
          <div className="text-sm text-muted-foreground">
            <p>This will send an email with:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>A secure invitation link</li>
              <li>Instructions to create their portal account</li>
              <li>Overview of portal features</li>
            </ul>
          </div>
          
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
                  {hasExistingInvitation ? "Resend Invitation" : "Send Invitation"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
