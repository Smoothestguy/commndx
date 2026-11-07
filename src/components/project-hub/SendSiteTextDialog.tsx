import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2, MessageSquare } from "lucide-react";

import { localDateTimeToIso } from "@/lib/signinSheets";
import { localStamp, locationZone } from "../../../supabase/functions/_shared/locationTime";

type Loc = { timezone: string | null; project_id: string; id: string; name: string; address: string | null; city: string | null; state: string | null; zip: string | null; poc_name: string | null; poc_phone: string | null };

/** Latest site-text send per person+location (from site_checkin_tokens.created_at). Key: `${personnel_id}:${location_id}` */
export function useLastSiteTexts(locationIds: string[]) {
  const ids = [...new Set(locationIds)].sort();
  return useQuery({
    queryKey: ["site-texts", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("site_checkin_tokens")
        .select("personnel_id, location_id, created_at").in("location_id", ids).order("created_at", { ascending: false });
      if (error) throw error;
      const m: Record<string, string> = {};
      for (const r of data ?? []) { const k = `${r.personnel_id}:${r.location_id}`; if (!m[k]) m[k] = r.created_at as string; }
      return m;
    },
  });
}

export function TextedCaption({ at }: { at?: string }) {
  if (!at) return null;
  return <span className="text-[10px] text-muted-foreground">texted {format(new Date(at), "M/d")}</span>;
}

function fmtAddr(l?: Loc | null) {
  if (!l) return "";
  return [l.address, [l.city, [l.state, l.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(", ");
}
const defaultReport = () => format(addDays(new Date(), 1), "yyyy-MM-dd") + "T07:00";

export function SendSiteTextDialog({ open, onOpenChange, personnelIds, locationId, projectId }: {
  open: boolean; onOpenChange: (o: boolean) => void; personnelIds: string[];
  /** Fixed location. If omitted, pick from the person's active assignments in projectId. */
  locationId?: string; projectId?: string;
}) {
  const qc = useQueryClient();
  const [locId, setLocId] = useState<string | undefined>(locationId);
  const [reportAt, setReportAt] = useState(defaultReport);
  const [inc, setInc] = useState({ address: true, report_time: true, poc: true });
  const [note, setNote] = useState("");

  const { data: locOptions = [] } = useQuery({
    queryKey: ["site-text-locs", locationId, projectId, personnelIds],
    enabled: open,
    queryFn: async (): Promise<Loc[]> => {
      const cols = "id, name, address, city, state, zip, poc_name, poc_phone, timezone, project_id";
      if (locationId) {
        const { data } = await supabase.from("project_locations").select(cols).eq("id", locationId);
        return (data ?? []) as Loc[];
      }
      const { data: asg } = await supabase.from("location_assignments").select("location_id")
        .in("personnel_id", personnelIds).eq("status", "active");
      const lids = [...new Set((asg ?? []).map((a) => a.location_id))];
      if (!lids.length) return [];
      let q = supabase.from("project_locations").select(cols).in("id", lids);
      if (projectId) q = q.eq("project_id", projectId);
      const { data } = await q;
      return (data ?? []) as Loc[];
    },
  });
  const { data: people = [] } = useQuery({
    queryKey: ["site-text-people", personnelIds],
    enabled: open && personnelIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("personnel").select("id, first_name, last_name, phone").in("id", personnelIds);
      return data ?? [];
    },
  });

  useEffect(() => { if (open) { setLocId(locationId); setReportAt(defaultReport()); setNote(""); } }, [open, locationId]);
  useEffect(() => { if (!locId && locOptions.length === 1) setLocId(locOptions[0].id); }, [locOptions, locId]);
  const loc = locOptions.find((l) => l.id === locId) ?? null;
  const zone = locationZone(loc || {});
  const reportIso = reportAt ? localDateTimeToIso(reportAt.split('T')[0],reportAt.split('T')[1]||'',zone) : null;
  const hasPoc = !!(loc?.poc_name || loc?.poc_phone);
  useEffect(() => { setInc((s) => ({ ...s, poc: hasPoc })); }, [hasPoc]);

  const preview = useMemo(() => {
    if (!loc) return "";
    let m = `FRG: You're assigned to ${loc.name}`;
    const a = fmtAddr(loc);
    if (inc.address && a) m += `\n${a}`;
    if (inc.report_time && reportAt) m += `\nReport: ${reportIso ? localStamp(reportIso,zone) : "Invalid report time"}`;
    if (inc.poc && hasPoc) m += `\nPOC: ${[loc.poc_name, loc.poc_phone].filter(Boolean).join(" ")}`;
    if (note.trim()) m += `\n${note.trim()}`;
    m += `\nWhen you arrive, tap to check in: https://fairfieldrg.com/punch/…\nTap again when you leave to check out.`;
    return m;
  }, [loc, inc, reportAt, reportIso, zone, note, hasPoc]);

  const hasPhone = (p: any) => { const d = String(p.phone ?? "").replace(/\D/g, ""); return d.length === 10 || (d.length === 11 && d.startsWith("1")); };
  const nameOf = (id: string) => { const p: any = people.find((x: any) => x.id === id); return p ? [p.first_name, p.last_name].filter(Boolean).join(" ") : "…"; };

  const send = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-site-assignment-sms", {
        body: { location_id: locId, personnel_ids: personnelIds, report_at: reportIso, include: inc, custom_note: note.trim() || undefined },
      });
      if (error) throw new Error(error instanceof FunctionsHttpError ? await error.context.text() : error.message);
      return (data?.results ?? []) as { personnel_id: string; status: string; reason?: string }[];
    },
    onSuccess: (results) => {
      for (const r of results) {
        if (r.status === "sent") toast.success(`Texted ${nameOf(r.personnel_id)}`);
        else toast.error(`${nameOf(r.personnel_id)}: ${r.reason ?? "failed"}`);
      }
      qc.invalidateQueries({ queryKey: ["site-texts"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(`Send failed: ${e.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" />Text site details?</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {!locationId && (
            locOptions.length === 0 ? <p className="text-sm text-muted-foreground">No assigned location found for this person.</p> : (
              <div className="space-y-1">
                <Label>Location</Label>
                <Select value={locId} onValueChange={setLocId}>
                  <SelectTrigger><SelectValue placeholder="Choose location" /></SelectTrigger>
                  <SelectContent>{locOptions.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )
          )}
          <div className="space-y-1">
            <Label>Report date & time · {zone}</Label>{loc && !loc.timezone && <p role="alert" className="text-xs text-warning">Location timezone not set — using {zone}. Set it before sending.</p>}
            <Input type="datetime-local" value={reportAt} onChange={(e) => setReportAt(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-4">
            {([["address", "Address"], ["report_time", "Report time"], ["poc", "POC"]] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <Checkbox checked={inc[k]} disabled={k === "poc" && !hasPoc} onCheckedChange={(v) => setInc((s) => ({ ...s, [k]: !!v }))} />{label}
              </label>
            ))}
          </div>
          <Textarea placeholder="Optional note (e.g. bring PPE)" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} rows={2} />
          {preview && <pre className="whitespace-pre-wrap text-xs rounded-md border bg-muted/40 p-3 font-sans">{preview}</pre>}
          <div className="space-y-1">
            <Label>Recipients ({personnelIds.length})</Label>
            <div className="flex flex-wrap gap-1">
              {personnelIds.map((id) => {
                const p: any = people.find((x: any) => x.id === id);
                const missing = p && !hasPhone(p);
                return (
                  <span key={id} className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${missing ? "border-destructive/50 text-destructive" : ""}`}>
                    {missing && <AlertTriangle className="h-3 w-3" />}{nameOf(id)}{missing && " · no phone"}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Skip</Button>
          <Button disabled={!locId || (inc.report_time && !!reportAt && !reportIso) || send.isPending} onClick={() => send.mutate()}>
            {send.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
