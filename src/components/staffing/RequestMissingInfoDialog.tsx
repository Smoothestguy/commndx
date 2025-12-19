import { useState, useMemo } from "react";
import { AlertCircle, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Application,
} from "@/integrations/supabase/hooks/useStaffingApplications";
import {
  useApplicationFormTemplate,
  FormField,
} from "@/integrations/supabase/hooks/useApplicationFormTemplates";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RequestMissingInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: Application | null;
  onSuccess?: () => void;
}

export function RequestMissingInfoDialog({
  open,
  onOpenChange,
  application,
  onSuccess,
}: RequestMissingInfoDialogProps) {
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [adminMessage, setAdminMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const formTemplateId = application?.job_postings?.form_template_id;
  const { data: formTemplate } = useApplicationFormTemplate(formTemplateId || "");

  // Build list of form fields (excluding sections)
  const formFields = useMemo(() => {
    if (!formTemplate?.fields) return [];
    return formTemplate.fields.filter(
      (field: FormField) => field.type !== "section"
    );
  }, [formTemplate]);

  // Core fields that can also be marked as missing
  const coreFields = [
    { id: "first_name", label: "First Name" },
    { id: "last_name", label: "Last Name" },
    { id: "email", label: "Email" },
    { id: "phone", label: "Phone" },
    { id: "home_zip", label: "Home ZIP Code" },
    { id: "photo", label: "Profile Photo" },
  ];

  const handleFieldToggle = (fieldId: string, fieldLabel: string) => {
    setSelectedFields((prev) => {
      const labelKey = `${fieldId}:${fieldLabel}`;
      if (prev.includes(labelKey)) {
        return prev.filter((f) => f !== labelKey);
      }
      return [...prev, labelKey];
    });
  };

  const isFieldSelected = (fieldId: string, fieldLabel: string) => {
    return selectedFields.includes(`${fieldId}:${fieldLabel}`);
  };

  const handleSend = async () => {
    if (!application || selectedFields.length === 0) {
      toast.error("Please select at least one field");
      return;
    }

    setIsSending(true);

    try {
      // Extract just the labels for the email
      const missingFieldLabels = selectedFields.map((f) => f.split(":")[1]);

      const { data, error } = await supabase.functions.invoke("send-application-edit-request", {
        body: {
          applicationId: application.id,
          missingFields: missingFieldLabels,
          adminMessage: adminMessage.trim() || undefined,
        },
      });

      if (error) throw error;

      // Check if the response indicates email failure
      if (data && !data.success) {
        if (data.applicationUpdated) {
          toast.warning(
            `Application status updated, but email could not be sent: ${data.emailError || 'Unknown error'}. You may need to contact the applicant manually.`,
            { duration: 8000 }
          );
        } else {
          throw new Error(data.emailError || "Failed to send edit request");
        }
      } else {
        toast.success("Edit request sent to applicant");
      }

      setSelectedFields([]);
      setAdminMessage("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error sending edit request:", error);
      toast.error(error.message || "Failed to send edit request");
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setSelectedFields([]);
    setAdminMessage("");
    onOpenChange(false);
  };

  if (!application) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Request Missing Information
          </DialogTitle>
          <DialogDescription>
            Select the fields that need to be updated. The applicant will receive an
            email with a link to edit their submission.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4" style={{ maxHeight: "calc(85vh - 250px)" }}>
          <div className="space-y-6">
            {/* Core Fields */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-muted-foreground">
                Core Information
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {coreFields.map((field) => (
                  <div
                    key={field.id}
                    className="flex items-center space-x-2 p-2 rounded border hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleFieldToggle(field.id, field.label)}
                  >
                    <Checkbox
                      checked={isFieldSelected(field.id, field.label)}
                      onCheckedChange={() => handleFieldToggle(field.id, field.label)}
                    />
                    <span className="text-sm">{field.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Form Fields */}
            {formFields.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium text-muted-foreground">
                  Form Fields
                </Label>
                <div className="space-y-2">
                  {formFields.map((field: FormField) => (
                    <div
                      key={field.id}
                      className="flex items-center space-x-2 p-2 rounded border hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleFieldToggle(field.id, field.label)}
                    >
                      <Checkbox
                        checked={isFieldSelected(field.id, field.label)}
                        onCheckedChange={() => handleFieldToggle(field.id, field.label)}
                      />
                      <span className="text-sm">{field.label}</span>
                      {field.required && (
                        <span className="text-xs text-muted-foreground">(required)</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Message */}
            <div className="space-y-2">
              <Label htmlFor="admin-message">Message to Applicant (optional)</Label>
              <Textarea
                id="admin-message"
                placeholder="Add any additional instructions or context for the applicant..."
                value={adminMessage}
                onChange={(e) => setAdminMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || selectedFields.length === 0}
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
