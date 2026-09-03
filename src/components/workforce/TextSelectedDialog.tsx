import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  useSendWorkforceInvites,
  type WorkforceApplicant,
} from "@/integrations/supabase/hooks/useWorkforce";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicants: WorkforceApplicant[];
}

export function TextSelectedDialog({ open, onOpenChange, applicants }: Props) {
  const send = useSendWorkforceInvites();
  const [text, setText] = useState("");
  const [consentOnly, setConsentOnly] = useState(true);
  const [excludeDnr, setExcludeDnr] = useState(true);
  const [results, setResults] = useState<Array<Record<string, any>> | null>(null);

  useEffect(() => {
    if (!open) return;
    setResults(null);
    setText("Fairfield Response Group: Hi {first_name}, ");
  }, [open]);

  const noConsent = applicants.filter((a) => !a.has_sms_consent).length;
  const optedOut = applicants.filter((a) => a.sms_opted_out).length;
  const preview = text.replace(
    /\{first_name\}/g,
    applicants[0]?.first_name ?? "there"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Text selected</DialogTitle>
          <DialogDescription>
            Free-text SMS to {applicants.length} selected applicant
            {applicants.length === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <>
            <ScrollArea className="h-[45vh] rounded border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60">
                  <tr>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">SMS</th>
                    <th className="p-2 text-left">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.applicant_id} className="border-t">
                      <td className="p-2">{r.name}</td>
                      <td className="p-2">{r.sms}</td>
                      <td className="p-2 text-muted-foreground">{r.reason ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Message (use {"{first_name}"})</Label>
              <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <div className="rounded border bg-muted/30 p-3 text-xs whitespace-pre-wrap text-muted-foreground">
              {preview}
            </div>
            <div className="space-y-2 rounded border p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={consentOnly} onCheckedChange={(v) => setConsentOnly(!!v)} />
                SMS consent only ({noConsent} would be skipped)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={excludeDnr} onCheckedChange={(v) => setExcludeDnr(!!v)} />
                Skip do-not-rehire
              </label>
              {optedOut > 0 && (
                <p className="text-xs text-muted-foreground">
                  {optedOut} recipient(s) previously opted out and are always skipped.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={send.isPending}>
                Cancel
              </Button>
              <Button
                disabled={send.isPending || !text.trim()}
                onClick={async () => {
                  const res = await send.mutateAsync({
                    job_posting_id: null,
                    applicant_ids: applicants.map((a) => a.id),
                    channel: "sms",
                    sms_text: text,
                    options: {
                      sms_consent_only: consentOnly,
                      exclude_do_not_rehire: excludeDnr,
                      exclude_applied: false,
                      exclude_recently_invited: false,
                    },
                  });
                  setResults(res.results ?? []);
                  toast.success(`Sent ${res.sent ?? 0} · Skipped ${res.skipped ?? 0}`);
                }}
              >
                {send.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send {applicants.length}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
