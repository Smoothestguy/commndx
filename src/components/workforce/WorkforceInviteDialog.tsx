import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useJobPostings } from "@/integrations/supabase/hooks/useStaffingApplications";
import { useMessageTemplates } from "@/integrations/supabase/hooks/useMessageTemplates";
import {
  useSendWorkforceInvites,
  type WorkforceApplicant,
} from "@/integrations/supabase/hooks/useWorkforce";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicants: WorkforceApplicant[];
  defaultPostingId?: string | null;
}

export function WorkforceInviteDialog({ open, onOpenChange, applicants, defaultPostingId }: Props) {
  const { data: postings = [], isLoading: postingsLoading } = useJobPostings();
  const { data: templates = [] } = useMessageTemplates();
  const send = useSendWorkforceInvites();

  const openPostings = useMemo(() => (postings ?? []).filter((p: any) => p.is_open), [postings]);
  const [postingId, setPostingId] = useState<string>("");
  const [postingSearch, setPostingSearch] = useState("");
  const [channel, setChannel] = useState<"sms" | "email" | "both">("sms");
  const [smsText, setSmsText] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [excludeApplied, setExcludeApplied] = useState(true);
  const [excludeDnr, setExcludeDnr] = useState(true);
  const [excludeRecent, setExcludeRecent] = useState(true);
  const [consentOnly, setConsentOnly] = useState(true);
  const [results, setResults] = useState<Array<Record<string, any>> | null>(null);

  const defaults = useMemo(() => {
    const byName = new Map(
      templates.filter((t) => t.category === "workforce_invite").map((t) => [t.name, t])
    );
    return {
      sms: byName.get("sms")?.content_en ?? "",
      smsEs: byName.get("sms")?.content_es ?? "",
      subject: byName.get("email_subject")?.content_en ?? "",
      body: byName.get("email_body")?.content_en ?? "",
      bodyEs: byName.get("email_body")?.content_es ?? "",
    };
  }, [templates]);

  useEffect(() => {
    if (!open) return;
    setResults(null);
    setPostingId(defaultPostingId ?? "");
    setSmsText([defaults.sms, defaults.smsEs].filter(Boolean).join("\n\n"));
    setEmailSubject(defaults.subject);
    setEmailBody([defaults.body, defaults.bodyEs].filter(Boolean).join("\n\n---\n\n"));
  }, [open, defaultPostingId, defaults]);

  const posting: any = openPostings.find((p: any) => p.id === postingId);
  const taskOrder = posting?.project_task_orders;
  const rates = (taskOrder?.task_order_positions ?? [])
    .filter((p: any) => p.show_pay_publicly !== false && p.advertised_pay_rate)
    .map((p: any) => Number(p.advertised_pay_rate));
  const payLabel = rates.length
    ? Math.min(...rates) === Math.max(...rates)
      ? `$${Math.min(...rates)}/hr`
      : `$${Math.min(...rates)}–$${Math.max(...rates)}/hr`
    : "";
  const startLabel = taskOrder?.start_at
    ? format(new Date(taskOrder.start_at), "MMM d")
    : "";
  const locationLabel = taskOrder?.location_address ?? "";
  const headcount = (taskOrder?.task_order_positions ?? []).reduce(
    (s: number, p: any) => s + (p.headcount ?? 0),
    0
  );

  const alreadyApplied = postingId
    ? applicants.filter((a) => a.applied_posting_ids.includes(postingId)).length
    : 0;
  const dnrCount = applicants.filter((a) => a.do_not_rehire).length;
  const noConsent = applicants.filter((a) => !a.has_sms_consent).length;

  const fill = (t: string, a?: WorkforceApplicant) => {
    const map: Record<string, string> = {
      "{first_name}": a?.first_name ?? "there",
      "{title}": taskOrder?.title ?? "",
      "{pay}": payLabel,
      "{start}": startLabel,
      "{location}": locationLabel,
      "{link}": "https://fairfieldrg.com/apply/…",
    };
    return (t ?? "").replace(/\{(first_name|title|pay|start|location|link)\}/g, (m) => map[m] ?? m);
  };

  const handleSend = async () => {
    if (!postingId) { toast.error("Pick an open posting"); return; }
    const res = await send.mutateAsync({
      job_posting_id: postingId,
      applicant_ids: applicants.map((a) => a.id),
      channel,
      sms_text: smsText,
      email_subject: emailSubject,
      email_body: emailBody,
      options: {
        exclude_applied: excludeApplied,
        exclude_do_not_rehire: excludeDnr,
        exclude_recently_invited: excludeRecent,
        sms_consent_only: consentOnly,
      },
    });
    setResults(res.results ?? []);
    toast.success(`Sent ${res.sent ?? 0} · Skipped ${res.skipped ?? 0} · Failed ${res.failed ?? 0}`);
  };

  const filteredPostings = openPostings.filter((p: any) => {
    if (!postingSearch.trim()) return true;
    const t = p.project_task_orders?.title ?? "";
    return t.toLowerCase().includes(postingSearch.trim().toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite to posting</DialogTitle>
          <DialogDescription>
            {applicants.length} selected from the workforce pool.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="space-y-3">
            <ScrollArea className="h-[50vh] rounded border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60">
                  <tr>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">SMS</th>
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2 text-left">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.applicant_id} className="border-t">
                      <td className="p-2">{r.name}</td>
                      <td className="p-2">{r.sms}</td>
                      <td className="p-2">{r.email_status}</td>
                      <td className="p-2 text-muted-foreground">{r.reason ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Job posting</Label>
              <Input
                value={postingSearch}
                onChange={(e) => setPostingSearch(e.target.value)}
                placeholder="Search postings by title"
                className="mb-2"
              />
              <Select value={postingId} onValueChange={setPostingId} disabled={postingsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={postingsLoading ? "Loading…" : "Pick an open posting"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredPostings.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.project_task_orders?.title ?? "Untitled posting"}
                    </SelectItem>
                  ))}
                  {!filteredPostings.length && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No open postings</div>
                  )}
                </SelectContent>
              </Select>
              {posting && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {payLabel && <Badge variant="outline">{payLabel}</Badge>}
                  {startLabel && <Badge variant="outline">Starts {startLabel}</Badge>}
                  {locationLabel && <Badge variant="outline">{locationLabel}</Badge>}
                  {headcount > 0 && <Badge variant="outline">{headcount} needed</Badge>}
                  <Badge variant="outline">{alreadyApplied} of selection already applied</Badge>
                </div>
              )}
            </div>

            <div>
              <Label>Channel</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="both">SMS + Email</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(channel === "sms" || channel === "both") && (
              <div>
                <Label>SMS message</Label>
                <Textarea rows={5} value={smsText} onChange={(e) => setSmsText(e.target.value)} />
              </div>
            )}
            {(channel === "email" || channel === "both") && (
              <>
                <div>
                  <Label>Email subject</Label>
                  <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
                </div>
                <div>
                  <Label>Email body</Label>
                  <Textarea rows={6} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
                </div>
              </>
            )}

            <div className="rounded border bg-muted/30 p-3 text-xs">
              <div className="mb-1 font-medium">Preview — {applicants[0]?.first_name ?? "—"}</div>
              <div className="whitespace-pre-wrap text-muted-foreground">
                {fill(channel === "email" ? emailBody : smsText, applicants[0])}
              </div>
            </div>

            <div className="space-y-2 rounded border p-3">
              <div className="text-sm font-medium">Guards</div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={excludeApplied} onCheckedChange={(v) => setExcludeApplied(!!v)} />
                Skip people who already applied to this posting ({alreadyApplied})
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={excludeDnr} onCheckedChange={(v) => setExcludeDnr(!!v)} />
                Skip do-not-rehire ({dnrCount})
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={excludeRecent} onCheckedChange={(v) => setExcludeRecent(!!v)} />
                Skip anyone invited to this posting in the last 7 days
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={consentOnly} onCheckedChange={(v) => setConsentOnly(!!v)} />
                SMS consent only ({noConsent} would be skipped for no consent)
              </label>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={send.isPending}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={send.isPending || !postingId}>
                {send.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send to {applicants.length}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
