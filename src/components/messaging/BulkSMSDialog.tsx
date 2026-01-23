import { useState } from "react";
import { MessageSquare, Users, AlertTriangle, Check, X, Loader2, Phone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSendBulkSMS } from "@/integrations/supabase/hooks/useBulkSMS";

interface Recipient {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
}

interface BulkSMSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  recipients: Recipient[];
}

const MAX_SMS_LENGTH = 160;

export function BulkSMSDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  recipients,
}: BulkSMSDialogProps) {
  const [message, setMessage] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const sendBulkSMS = useSendBulkSMS();

  const validRecipients = recipients.filter((r) => r.phone);
  const invalidRecipients = recipients.filter((r) => !r.phone);

  const handleSend = () => {
    if (!message.trim() || validRecipients.length === 0) return;
    setShowConfirmation(true);
  };

  const confirmSend = async () => {
    setShowConfirmation(false);

    try {
      await sendBulkSMS.mutateAsync({
        projectId,
        projectName,
        content: message.trim(),
        recipientIds: validRecipients.map((r) => r.id),
      });

      setMessage("");
      onOpenChange(false);
    } catch {
      // Error handled in hook
    }
  };

  const handleClose = () => {
    if (!sendBulkSMS.isPending) {
      setMessage("");
      onOpenChange(false);
    }
  };

  const charCount = message.length;
  const isOverLimit = charCount > MAX_SMS_LENGTH;
  const segmentCount = Math.ceil(charCount / MAX_SMS_LENGTH) || 1;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Blast Text to Personnel
            </DialogTitle>
            <DialogDescription>
              Send a custom SMS message to all assigned personnel for {projectName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Recipients Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Recipients
                </span>
                <Badge variant="secondary">
                  {validRecipients.length} with phone
                </Badge>
              </div>

              <ScrollArea className="h-[120px] rounded-md border p-2">
                <div className="space-y-1">
                  {validRecipients.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex items-center justify-between text-sm py-1"
                    >
                      <div className="flex items-center gap-2">
                        <Check className="h-3 w-3 text-green-500" />
                        <span>
                          {recipient.firstName} {recipient.lastName}
                        </span>
                      </div>
                      <span className="text-muted-foreground text-xs flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {recipient.phone}
                      </span>
                    </div>
                  ))}

                  {invalidRecipients.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex items-center justify-between text-sm py-1 text-muted-foreground"
                    >
                      <div className="flex items-center gap-2">
                        <X className="h-3 w-3 text-destructive" />
                        <span>
                          {recipient.firstName} {recipient.lastName}
                        </span>
                      </div>
                      <span className="text-xs text-destructive">No phone</span>
                    </div>
                  ))}

                  {recipients.length === 0 && (
                    <div className="text-center text-muted-foreground py-4">
                      No personnel assigned to this project
                    </div>
                  )}
                </div>
              </ScrollArea>

              {invalidRecipients.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  {invalidRecipients.length} personnel without phone numbers will be skipped
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                placeholder="Type your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                disabled={sendBulkSMS.isPending}
                className={cn(isOverLimit && "border-amber-500 focus-visible:ring-amber-500")}
              />
              <div className="flex items-center justify-between text-xs">
                <span className={cn(
                  "text-muted-foreground",
                  isOverLimit && "text-amber-600"
                )}>
                  {isOverLimit
                    ? `${segmentCount} SMS segments will be sent`
                    : "Standard SMS (160 chars)"}
                </span>
                <span className={cn(
                  charCount > MAX_SMS_LENGTH * 0.9
                    ? isOverLimit
                      ? "text-amber-600"
                      : "text-amber-500"
                    : "text-muted-foreground"
                )}>
                  {charCount}/{MAX_SMS_LENGTH}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={sendBulkSMS.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={
                !message.trim() ||
                validRecipients.length === 0 ||
                sendBulkSMS.isPending
              }
            >
              {sendBulkSMS.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send to {validRecipients.length}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk SMS</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to send an SMS message to {validRecipients.length} personnel
              assigned to {projectName}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSend}>
              Send {validRecipients.length} Messages
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
