import { useState } from "react";
import { useSendPortalInvitation } from "@/integrations/supabase/hooks/usePortal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Mail, UserPlus, Copy, Check } from "lucide-react";
import { toast } from "sonner";

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
  const [copied, setCopied] = useState(false);
  const sendInvitation = useSendPortalInvitation();

  const handleSendInvitation = async () => {
    try {
      const result = await sendInvitation.mutateAsync({
        personnelId,
        email: personnelEmail,
      });
      
      // Generate the invitation link
      const inviteLink = `${window.location.origin}/portal/accept-invite/${result.token}`;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Invitation created and link copied to clipboard!");
      
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 2000);
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
            Send a portal invitation to {personnelName}
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
            <p>This will:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Create a portal invitation link</li>
              <li>Copy the link to your clipboard</li>
              <li>Allow them to create an account and access the portal</li>
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
              disabled={sendInvitation.isPending || copied}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Link Copied!
                </>
              ) : sendInvitation.isPending ? (
                "Creating..."
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Create & Copy Link
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
