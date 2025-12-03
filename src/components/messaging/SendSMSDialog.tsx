import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSendSMS } from "@/integrations/supabase/hooks/useMessages";
import { Loader2, MessageSquare, Phone } from "lucide-react";

interface SendSMSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientType: 'customer' | 'personnel';
  recipientId: string;
  recipientName: string;
  recipientPhone: string;
}

const MAX_SMS_LENGTH = 160;

export function SendSMSDialog({
  open,
  onOpenChange,
  recipientType,
  recipientId,
  recipientName,
  recipientPhone,
}: SendSMSDialogProps) {
  const [phone, setPhone] = useState(recipientPhone);
  const [content, setContent] = useState("");
  const sendSMS = useSendSMS();

  const handleSend = async () => {
    if (!content.trim() || !phone.trim()) return;

    await sendSMS.mutateAsync({
      recipientType,
      recipientId,
      recipientName,
      recipientPhone: phone,
      content: content.trim(),
    });

    setContent("");
    onOpenChange(false);
  };

  const charactersRemaining = MAX_SMS_LENGTH - content.length;
  const isOverLimit = charactersRemaining < 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Send SMS
          </DialogTitle>
          <DialogDescription>
            Send a text message to {recipientName}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="recipient">Recipient</Label>
            <Input
              id="recipient"
              value={recipientName}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone Number
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="message">Message</Label>
              <span
                className={`text-xs ${
                  isOverLimit
                    ? "text-destructive"
                    : charactersRemaining <= 20
                    ? "text-yellow-500"
                    : "text-muted-foreground"
                }`}
              >
                {charactersRemaining} characters remaining
              </span>
            </div>
            <Textarea
              id="message"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type your message here..."
              className="min-h-[120px] resize-none"
            />
            {isOverLimit && (
              <p className="text-xs text-destructive">
                Message exceeds 160 characters and may be split into multiple SMS
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sendSMS.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!content.trim() || !phone.trim() || sendSMS.isPending}
          >
            {sendSMS.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send SMS"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
