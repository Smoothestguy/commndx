import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Fire-and-report photo request SMS. Never throws — approval must not be blocked. */
export async function requestApplicantPhoto(applicantId: string) {
  try {
    const { data, error } = await supabase.functions.invoke("send-photo-request-sms", { body: { applicant_id: applicantId } });
    if (error || !(data as any)?.sent) throw error ?? new Error((data as any)?.error ?? "not sent");
    toast.success("Photo request texted");
  } catch (e) {
    console.error("photo request failed", e);
    toast.warning("Couldn't text the photo request — approval continued.");
  }
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onApproveAnyway: () => void;
  onApproveAndRequest: () => void;
}

export function PhotoRequestApproveDialog({ open, onOpenChange, onApproveAnyway, onApproveAndRequest }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>No photo on file — request one by text?</AlertDialogTitle>
          <AlertDialogDescription>
            We'll text the applicant a one-time link to upload a badge photo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="outline" onClick={() => { onOpenChange(false); onApproveAnyway(); }}>Approve anyway</Button>
          <AlertDialogAction onClick={onApproveAndRequest}>Approve + request photo</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
