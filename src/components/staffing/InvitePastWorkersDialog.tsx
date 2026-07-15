import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Send, Search, MapPin } from "lucide-react";
import { toast } from "sonner";
import { renderMergeTags, AVAILABLE_MERGE_TAGS } from "@/lib/mergeTags";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posting: any; // job posting with project_task_orders + projects + positions
}

interface Candidate {
  key: string; // dedupe by phone
  name: string;
  phone: string;
  applicantId: string | null;
  personnelId: string | null;
  isPersonnel: boolean;
  distanceMi: number | null;
  lastPosition: string | null;
}

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function normPhone(p: string | null | undefined): string {
  return (p ?? "").replace(/\D/g, "");
}

const MAX_SELECT = 100;

export function InvitePastWorkersDialog({ open, onOpenChange, posting }: Props) {
  const project = posting?.project_task_orders?.projects;
  const taskOrder = posting?.project_task_orders;
  const projLat = project?.site_lat ?? null;
  const projLng = project?.site_lng ?? null;
  const taskTitle = taskOrder?.title ?? "our next job";
  const publicToken = posting?.public_token;
  const link = typeof window !== "undefined"
    ? `${window.location.origin}/apply/${publicToken}`
    : "";

  // Publicly-shown top-of-range pay
  const positions: any[] = posting?.positions ?? [];
  const publicPay = useMemo(() => {
    const rates = positions
      .filter(p => p.show_pay_publicly && p.advertised_pay_rate != null)
      .map(p => Number(p.advertised_pay_rate));
    return rates.length ? Math.max(...rates) : null;
  }, [positions]);

  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [radius, setRadius] = useState<string>("any"); // 25/50/100/250/any
  const [personnelOnly, setPersonnelOnly] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set()); setSearch(""); setRadius("any"); setPersonnelOnly(false);
    setResult(null); setProgress(0);
    (async () => {
      setLoading(true);
      try {
        // Applicants: non-rejected with phone; include latest position from answers
        const { data: apps } = await supabase
          .from("applicants")
          .select("id, first_name, last_name, phone, status, home_lat, home_lng")
          .not("phone", "is", null)
          .neq("status", "rejected")
          .limit(3000);

        // Latest position per applicant from applications.answers
        const applicantIds = (apps ?? []).map(a => a.id);
        let latestPos = new Map<string, string>();
        if (applicantIds.length) {
          const { data: appRows } = await supabase
            .from("applications")
            .select("applicant_id, answers, submitted_at")
            .in("applicant_id", applicantIds)
            .order("submitted_at", { ascending: false })
            .limit(5000);
          for (const r of appRows ?? []) {
            if (!latestPos.has(r.applicant_id as string)) {
              const ans = (r as any).answers;
              const pos = ans?.position_applying_for;
              if (typeof pos === "string" && pos) latestPos.set(r.applicant_id as string, pos);
            }
          }
        }

        // Personnel with phone
        const { data: pers } = await supabase
          .from("personnel")
          .select("id, first_name, last_name, phone, home_lat, home_lng, status")
          .not("phone", "is", null)
          .limit(3000);

        const map = new Map<string, Candidate>();
        for (const a of apps ?? []) {
          const key = normPhone(a.phone);
          if (!key) continue;
          const dist = (projLat != null && projLng != null && a.home_lat != null && a.home_lng != null)
            ? haversineMi(projLat, projLng, a.home_lat as number, a.home_lng as number) : null;
          map.set(key, {
            key,
            name: `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || "Unnamed",
            phone: a.phone as string,
            applicantId: a.id,
            personnelId: null,
            isPersonnel: false,
            distanceMi: dist,
            lastPosition: latestPos.get(a.id) ?? null,
          });
        }
        for (const p of pers ?? []) {
          const key = normPhone(p.phone);
          if (!key) continue;
          const dist = (projLat != null && projLng != null && p.home_lat != null && p.home_lng != null)
            ? haversineMi(projLat, projLng, p.home_lat as number, p.home_lng as number) : null;
          const existing = map.get(key);
          if (existing) {
            existing.personnelId = p.id;
            existing.isPersonnel = true;
            if (existing.distanceMi == null && dist != null) existing.distanceMi = dist;
          } else {
            map.set(key, {
              key,
              name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Unnamed",
              phone: p.phone as string,
              applicantId: null,
              personnelId: p.id,
              isPersonnel: true,
              distanceMi: dist,
              lastPosition: null,
            });
          }
        }

        setCandidates(Array.from(map.values()));
      } catch (e: any) {
        toast.error("Failed to load candidates: " + (e?.message ?? e));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, projLat, projLng]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const maxDist = radius === "any" ? Infinity : parseInt(radius, 10);
    return candidates
      .filter(c => {
        if (personnelOnly && !c.isPersonnel) return false;
        if (Number.isFinite(maxDist) && c.distanceMi != null && c.distanceMi > maxDist) return false;
        if (Number.isFinite(maxDist) && c.distanceMi == null && maxDist < 999999) return false;
        if (!s) return true;
        return `${c.name} ${c.phone} ${c.lastPosition ?? ""}`.toLowerCase().includes(s);
      })
      .sort((a, b) => {
        const ad = a.distanceMi ?? Number.POSITIVE_INFINITY;
        const bd = b.distanceMi ?? Number.POSITIVE_INFINITY;
        return ad - bd;
      });
  }, [candidates, search, radius, personnelOnly]);

  const toggle = (k: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else {
        if (next.size >= MAX_SELECT) { toast.error(`Max ${MAX_SELECT} recipients`); return next; }
        next.add(k);
      }
      return next;
    });
  };
  const selectAllFiltered = () => {
    const next = new Set(selected);
    for (const c of filtered) {
      if (next.size >= MAX_SELECT) break;
      next.add(c.key);
    }
    setSelected(next);
  };
  const clearAll = () => setSelected(new Set());

  const buildMessage = () => {
    const payBit = publicPay != null ? ` - $${publicPay}/hr` : "";
    return `Fairfield Response Group: We're hiring for ${taskTitle}${payBit}. You've worked with us before — applying takes 2 minutes: {link} Reply STOP to opt out.`;
  };

  const send = async () => {
    if (selected.size === 0) return;
    setSending(true); setProgress(0); setResult(null);
    try {
      const chosen = filtered.filter(c => selected.has(c.key));
      const message = buildMessage();

      // Send in small batches sequentially for progress
      const batchSize = 10;
      let totalSent = 0, totalFailed = 0, totalSkipped = 0;
      for (let i = 0; i < chosen.length; i += batchSize) {
        const batch = chosen.slice(i, i + batchSize);
        const { data, error } = await supabase.functions.invoke("invite-past-workers-sms", {
          body: {
            recipients: batch.map(c => ({
              name: c.name, phone: c.phone,
              applicantId: c.applicantId, personnelId: c.personnelId,
            })),
            message,
            link,
          },
        });
        if (error) {
          totalFailed += batch.length;
          toast.error("Batch failed: " + error.message);
        } else {
          const d = data as any;
          totalSent += d?.sent ?? 0;
          totalFailed += d?.failed ?? 0;
          totalSkipped += d?.skipped ?? 0;
        }
        setProgress(Math.round(((i + batch.length) / chosen.length) * 100));
      }
      setResult({ sent: totalSent, failed: totalFailed, skipped: totalSkipped });
      toast.success(`Done: ${totalSent} sent, ${totalFailed} failed, ${totalSkipped} skipped`);
    } finally {
      setSending(false);
    }
  };

  const previewMsg = buildMessage().replace("{link}", link);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Invite past workers</DialogTitle>
          <DialogDescription>
            Send a re-apply SMS to past applicants and personnel already on file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search name, phone, position…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={radius} onValueChange={setRadius}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="25">Within 25 mi</SelectItem>
                <SelectItem value="50">Within 50 mi</SelectItem>
                <SelectItem value="100">Within 100 mi</SelectItem>
                <SelectItem value="250">Within 250 mi</SelectItem>
                <SelectItem value="any">Any distance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox checked={personnelOnly} onCheckedChange={v => setPersonnelOnly(!!v)} />
              Personnel only
            </label>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={selectAllFiltered} disabled={loading || sending}>
                Select all ({Math.min(filtered.length, MAX_SELECT)})
              </Button>
              <Button size="sm" variant="ghost" onClick={clearAll} disabled={sending || selected.size === 0}>
                Clear
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 border rounded-md min-h-[240px]">
            {loading ? (
              <div className="p-6 flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading candidates…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No candidates match.</div>
            ) : (
              <div className="divide-y">
                {filtered.map(c => (
                  <label key={c.key} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer">
                    <Checkbox checked={selected.has(c.key)} onCheckedChange={() => toggle(c.key)} />
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-muted-foreground">{c.phone}</div>
                      <div className="text-muted-foreground truncate">
                        {c.isPersonnel && <Badge variant="secondary" className="mr-1">Personnel</Badge>}
                        {c.lastPosition || (c.isPersonnel ? "" : "—")}
                      </div>
                      <div className="text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {c.distanceMi != null ? `${c.distanceMi.toFixed(0)} mi` : "unknown"}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </ScrollArea>

          <div>
            <Label className="text-xs text-muted-foreground">Message preview</Label>
            <div className="text-xs bg-muted/40 rounded p-2 whitespace-pre-wrap">{previewMsg}</div>
          </div>

          {sending && (
            <div className="space-y-1">
              <Progress value={progress} />
              <div className="text-xs text-muted-foreground">{progress}%</div>
            </div>
          )}
          {result && (
            <div className="text-sm">
              Sent: <b>{result.sent}</b> · Failed: <b>{result.failed}</b> · Skipped: <b>{result.skipped}</b>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="mr-auto text-sm text-muted-foreground">
            {selected.size} selected {selected.size === MAX_SELECT && "(max)"}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Close</Button>
          <Button onClick={send} disabled={sending || selected.size === 0 || !publicToken}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send SMS ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
