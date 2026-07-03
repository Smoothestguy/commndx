import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { useJobPostings } from "@/integrations/supabase/hooks/useStaffingApplications";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicantIds: string[];
}

export const InviteToJobDialog = ({ open, onOpenChange, applicantIds }: Props) => {
  const { data: postings, isLoading: postingsLoading } = useJobPostings();
  const openPostings = useMemo(
    () => (postings ?? []).filter((p: any) => p.is_open),
    [postings]
  );
  const [postingId, setPostingId] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [sending, setSending] = useState(false);

  const selectedPosting: any = useMemo(
    () => openPostings.find((p: any) => p.id === postingId),
    [openPostings, postingId]
  );

  useEffect(() => {
    if (!open) return;
    setPostingId("");
    setMessage("");
  }, [open]);

  useEffect(() => {
    if (!selectedPosting) return;
    const title =
      selectedPosting.project_task_orders?.title ??
      selectedPosting.project_task_orders?.projects?.name ??
      "our new opening";
    setMessage(
      `Hi {first_name}, Fairfield Response Group has a new opening: ${title}. Your info is already on file — apply in one tap: {link}`
    );
  }, [selectedPosting]);

  const handleSend = async () => {
    if (!postingId) { toast.error("Pick a job posting"); return; }
    if (!message.trim()) { toast.error("Message can't be empty"); return; }
    if (!applicantIds.length) { toast.error("No applicants selected"); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-applicants-sms", {
        body: {
          applicantIds,
          message,
          postingId,
          useQuickApply: true,
        },
      });
      if (error) throw error;
      const sent = data?.sent ?? 0;
      const failed = data?.failed ?? 0;
      const skipped = data?.skipped ?? 0;
      toast.success(
        `Invites sent: ${sent}${failed ? ` • Failed: ${failed}` : ""}${skipped ? ` • Skipped: ${skipped}` : ""}`
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to send invites");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Invite to Job</DialogTitle>
          <DialogDescription>
            Send a personalized one-tap apply link to {applicantIds.length} applicant
            {applicantIds.length === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Job posting</Label>
            <Select value={postingId} onValueChange={setPostingId} disabled={postingsLoading}>
              <SelectTrigger>
                <SelectValue placeholder={postingsLoading ? "Loading…" : "Pick an open posting"} />
              </SelectTrigger>
              <SelectContent>
                {openPostings.map((p: any) => {
                  const title =
                    p.project_task_orders?.title ??
                    p.project_task_orders?.projects?.name ??
                    "Untitled posting";
                  const proj = p.project_task_orders?.projects?.name;
                  return (
                    <SelectItem key={p.id} value={p.id}>
                      {title}{proj && title !== proj ? ` — ${proj}` : ""}
                    </SelectItem>
                  );
                })}
                {!openPostings.length && !postingsLoading && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No open postings</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>
              Message (use {"{first_name}"} and {"{link}"} placeholders)
            </Label>
            <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">
              Each recipient gets a unique one-tap link that prefills their info.
              Anyone with an active application for this posting is auto-skipped.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || !postingId}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send to {applicantIds.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
