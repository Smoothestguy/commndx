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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useIncompleteOnboardingPersonnel } from "@/integrations/supabase/hooks/useIncompleteOnboardingPersonnel";
import { useSendBulkSMS } from "@/integrations/supabase/hooks/useBulkSMS";
import { Send, AlertTriangle, Users, Phone, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_MESSAGE = `Hi! This is a reminder to complete your onboarding paperwork. Please visit the portal link we sent you to finish your documents. If you need a new link, please let us know. Thank you!`;

export function OnboardingReminderDialog({
  open,
  onOpenChange,
}: OnboardingReminderDialogProps) {
  const { data: personnel, isLoading } = useIncompleteOnboardingPersonnel();
  const sendBulkSMS = useSendBulkSMS();

  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Filter personnel with phone numbers
  const personnelWithPhone = personnel?.filter((p) => p.phone) || [];
  const personnelWithoutPhone = personnel?.filter((p) => !p.phone) || [];

  // Initialize selection when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && personnelWithPhone.length > 0) {
      setSelectedIds(new Set(personnelWithPhone.map((p) => p.id)));
    }
    if (!newOpen) {
      setShowConfirmation(false);
      setMessage(DEFAULT_MESSAGE);
    }
    onOpenChange(newOpen);
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === personnelWithPhone.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(personnelWithPhone.map((p) => p.id)));
    }
  };

  const handleSend = async () => {
    if (selectedIds.size === 0) return;

    try {
      await sendBulkSMS.mutateAsync({
        content: message,
        recipientIds: Array.from(selectedIds),
        messageContext: "onboarding_reminder",
      });
      onOpenChange(false);
      setShowConfirmation(false);
      setMessage(DEFAULT_MESSAGE);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  if (showConfirmation) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Send</DialogTitle>
            <DialogDescription>
              You are about to send an SMS to {selectedIds.size} personnel.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-2">Message:</p>
            <div className="p-3 bg-muted rounded-md text-sm">{message}</div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmation(false)}
            >
              Back
            </Button>
            <Button
              onClick={handleSend}
              disabled={sendBulkSMS.isPending}
            >
              {sendBulkSMS.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send {selectedIds.size} Messages
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Onboarding Reminders
          </DialogTitle>
          <DialogDescription>
            Send SMS reminders to personnel who haven't completed their
            onboarding.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden space-y-4">
            {/* Stats */}
            <div className="flex gap-4 flex-wrap">
              <Badge variant="secondary" className="gap-1">
                <Phone className="h-3 w-3" />
                {personnelWithPhone.length} with phone
              </Badge>
              {personnelWithoutPhone.length > 0 && (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <AlertTriangle className="h-3 w-3" />
                  {personnelWithoutPhone.length} without phone
                </Badge>
              )}
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your message..."
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                {message.length} characters
              </p>
            </div>

            {/* Recipients */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Recipients ({selectedIds.size} selected)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="h-auto py-1 px-2 text-xs"
                >
                  {selectedIds.size === personnelWithPhone.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              </div>

              {personnelWithPhone.length === 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No personnel with incomplete onboarding have phone numbers.
                  </AlertDescription>
                </Alert>
              ) : (
                <ScrollArea className="h-[200px] border rounded-md">
                  <div className="p-2 space-y-1">
                    {personnelWithPhone.map((person) => (
                      <label
                        key={person.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors",
                          selectedIds.has(person.id) && "bg-muted"
                        )}
                      >
                        <Checkbox
                          checked={selectedIds.has(person.id)}
                          onCheckedChange={() => toggleSelection(person.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {person.first_name} {person.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {person.phone}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs shrink-0",
                            person.onboarding_status === "pending" &&
                              "border-yellow-500/50 text-yellow-600",
                            person.onboarding_status === "revoked" &&
                              "border-red-500/50 text-red-600",
                            !person.onboarding_status &&
                              "border-muted-foreground/50"
                          )}
                        >
                          {person.onboarding_status || "Not Started"}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* No phone warning */}
            {personnelWithoutPhone.length > 0 && (
              <Alert variant="default" className="bg-muted/50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {personnelWithoutPhone.length} personnel cannot receive SMS
                  (no phone number):{" "}
                  {personnelWithoutPhone
                    .slice(0, 3)
                    .map((p) => `${p.first_name} ${p.last_name}`)
                    .join(", ")}
                  {personnelWithoutPhone.length > 3 &&
                    ` and ${personnelWithoutPhone.length - 3} more`}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => setShowConfirmation(true)}
            disabled={selectedIds.size === 0 || !message.trim()}
          >
            <Send className="h-4 w-4 mr-2" />
            Review & Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
