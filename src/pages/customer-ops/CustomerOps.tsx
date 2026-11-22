import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Download, Loader2, LogOut, MapPin, Phone, Send, UserMinus, UserPlus } from "lucide-react";
import { buildAttendanceCsv, missingByPerson, type AttendanceRow } from "@/lib/customerOps";

// Customer Ops workspace: customer-scoped, dollar-free. Every read/write goes through
// allow-listed server functions; this page never queries tables directly.
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase.rpc as any)(fn, args);
type Loc = { location_id: string; location_name: string; project_name: string; city: string | null; state: string | null; status: string | null; timezone: string | null; active_count: number };
type Person = { personnel_id: string; first_name: string; last_name: string; phone: string | null; role_label: string | null; on_location: boolean };

const ymd = (d: Date, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const hm = (iso: string | null, tz: string) => iso ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)) : "—";

export default function CustomerOps() {
  const { signOut, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const locs = useQuery({ queryKey: ["co-locations"], queryFn: async () => { const { data, error } = await rpc("customer_ops_locations"); if (error) throw error; return (data ?? []) as Loc[]; } });
  const selectedId = params.get("location");
  const loc = locs.data?.find(l => l.location_id === selectedId) ?? null;
  const pick = (id: string | null) => { const next = new URLSearchParams(params); if (id) next.set("location", id); else next.delete("location"); setParams(next); };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Customer operations</p>
            <h1 className="truncate text-lg font-semibold">{loc ? loc.location_name : "Your locations"}</h1>
          </div>
          <div className="flex items-center gap-2">
            {loc && <Button variant="outline" size="sm" onClick={() => pick(null)}>All locations</Button>}
            <Button variant="ghost" size="icon" aria-label="Sign out" title={user?.email ?? "Sign out"} onClick={() => signOut()}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-4">
        {locs.isLoading ? <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-primary" /> :
         locs.error ? <p className="text-destructive">Could not load locations.</p> :
         loc ? <LocationView loc={loc} /> :
         !locs.data?.length ? <p className="text-muted-foreground">No locations are linked to your account yet.</p> :
         <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
           {locs.data.map(l => (
             <button key={l.location_id} onClick={() => pick(l.location_id)} className="rounded-lg border bg-card p-4 text-left transition hover:border-primary">
               <div className="flex items-start justify-between gap-2">
                 <p className="font-medium">{l.location_name}</p>
                 {l.status === "closed" ? <Badge variant="secondary">Closed</Badge> : <Badge variant="outline">{l.active_count} on site</Badge>}
               </div>
               <p className="mt-1 text-sm text-muted-foreground">{l.project_name}</p>
               {(l.city || l.state) && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{[l.city, l.state].filter(Boolean).join(", ")}</p>}
             </button>
           ))}
         </div>}
      </main>
    </div>
  );
}

function LocationView({ loc }: { loc: Loc }) {
  const tz = loc.timezone || "America/Chicago";
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "attendance";
  const setTab = (t: string) => { const n = new URLSearchParams(params); n.set("tab", t); setParams(n, { replace: true }); };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{loc.project_name}{!loc.timezone && " · times shown in Central (location timezone not set)"}</p>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="missing">Missing signatures</TabsTrigger>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="sheets">Sheets</TabsTrigger>
        </TabsList>
        <TabsContent value="attendance"><Attendance loc={loc} tz={tz} /></TabsContent>
        <TabsContent value="missing"><Missing loc={loc} tz={tz} /></TabsContent>
        <TabsContent value="roster"><Roster loc={loc} /></TabsContent>
        <TabsContent value="sheets"><Sheets loc={loc} /></TabsContent>
      </Tabs>
    </div>
  );
}

function useAttendance(locId: string, from: string, to: string) {
  return useQuery({ queryKey: ["co-att", locId, from, to], queryFn: async () => { const { data, error } = await rpc("customer_ops_attendance", { _location: locId, _from: from, _to: to }); if (error) throw error; return (data ?? []) as AttendanceRow[]; } });
}

function Attendance({ loc, tz }: { loc: Loc; tz: string }) {
  const today = ymd(new Date(), tz);
  const [from, setFrom] = useState(ymd(new Date(Date.now() - 6 * 86400000), tz));
  const [to, setTo] = useState(today);
  const q = useAttendance(loc.location_id, from, to);
  const days = useMemo(() => { const m = new Map<string, AttendanceRow[]>(); for (const r of q.data ?? []) m.set(r.local_day, [...(m.get(r.local_day) ?? []), r]); return [...m.entries()]; }, [q.data]);
  const download = () => {
    const blob = new Blob([buildAttendanceCsv(q.data ?? [], tz)], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${loc.location_name}-attendance-${from}-to-${to}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">From<Input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="w-40" /></label>
        <label className="text-xs text-muted-foreground">To<Input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className="w-40" /></label>
        <Button variant="outline" size="sm" onClick={download} disabled={!q.data?.length}><Download className="mr-1 h-4 w-4" />Download timesheet</Button>
      </div>
      {q.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : q.error ? <p className="text-destructive">{(q.error as Error).message}</p> :
       !days.length ? <p className="text-muted-foreground">No attendance in this range.</p> :
       days.map(([day, rows]) => (
        <section key={day} className="rounded-lg border bg-card">
          <h3 className="border-b px-3 py-2 text-sm font-medium">{day} <span className="text-muted-foreground">· {rows.length} {rows.length === 1 ? "stay" : "stays"}</span></h3>
          <ul className="divide-y">
            {rows.map(r => (
              <li key={r.visit_personnel_id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{r.first_name} {r.last_name}</span>
                <span className="flex shrink-0 items-center gap-2 tabular-nums">
                  {hm(r.in_at, tz)}–{hm(r.out_at, tz)}
                  {r.signed ? <Badge variant="outline">Signed</Badge> : <Badge variant="destructive">Unsigned</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Missing({ loc, tz }: { loc: Loc; tz: string }) {
  const [params] = useSearchParams();
  const dryRun = params.get("dryRun") === "1";
  const from = ymd(new Date(Date.now() - 30 * 86400000), tz), to = ymd(new Date(), tz);
  const q = useAttendance(loc.location_id, from, to);
  const people = useMemo(() => missingByPerson(q.data ?? []), [q.data]);
  const ids = people.map(p => p.personnel_id);
  const status = useQuery({ enabled: ids.length > 0, queryKey: ["co-missing", loc.location_id, ids.join()], queryFn: async () => {
    const { data, error } = await supabase.functions.invoke("timesheet-signature", { body: { action: "missing", location_id: loc.location_id, personnel_ids: ids } }); if (error) throw error;
    return new Map<string, any>((data?.people ?? []).map((p: any) => [p.personnel_id, p.request]));
  } });
  const qc = useQueryClient();
  const send = useMutation({
    mutationFn: async ({ pid, resend }: { pid: string; resend: boolean }) => {
      const body = resend ? { action: "resend", location_id: loc.location_id, personnel_id: pid, dry_run: dryRun } : { action: "request", location_id: loc.location_id, personnel_ids: [pid], dry_run: dryRun };
      const { data, error } = await supabase.functions.invoke("timesheet-signature", { body }); if (error) throw error; return data?.results?.[0];
    },
    onSuccess: r => {
      const msg: Record<string, string> = { requested: "Signature request sent", resent: "Request resent", dry_run: "Test only — no text sent", already_requested: "Already requested", rate_limited: `Wait ${r?.retry_in_s ?? ""}s before resending`, no_phone: "No valid phone number on file", skipped: "Nothing to sign" };
      (r?.status === "failed" ? toast.error : toast.success)(msg[r?.status] ?? r?.reason ?? "Request failed");
      qc.invalidateQueries({ queryKey: ["co-missing", loc.location_id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Request failed"),
  });
  if (q.isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Unsigned worked days in the last 30 days.{dryRun && " Test mode: no texts are sent."}</p>
      {!people.length ? <p className="text-muted-foreground">Everyone has signed.</p> : people.map(p => {
        const req = status.data?.get(p.personnel_id);
        return (
          <div key={p.personnel_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
            <div className="min-w-0">
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.dates.join(", ")}</p>
              {req && <p className="text-xs text-muted-foreground">Requested {new Date(req.last_sent_at).toLocaleString()} · sent {req.send_count}×</p>}
            </div>
            <Button size="sm" variant={req ? "outline" : "default"} disabled={send.isPending} onClick={() => send.mutate({ pid: p.personnel_id, resend: !!req })}>
              <Send className="mr-1 h-4 w-4" />{req ? "Resend" : "Request signature"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function Roster({ loc }: { loc: Loc }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["co-roster", loc.location_id], queryFn: async () => { const { data, error } = await rpc("customer_ops_roster", { _location: loc.location_id }); if (error) throw error; return (data ?? []) as Person[]; } });
  const set = useMutation({
    mutationFn: async ({ pid, assign }: { pid: string; assign: boolean }) => { const { error } = await rpc("customer_ops_set_assignment", { _location: loc.location_id, _personnel: pid, _assign: assign }); if (error) throw error; return assign; },
    onSuccess: a => { toast.success(a ? "Assigned to location" : "Removed from location"); qc.invalidateQueries({ queryKey: ["co-roster", loc.location_id] }); qc.invalidateQueries({ queryKey: ["co-locations"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Could not update"),
  });
  const [filter, setFilter] = useState("");
  const rows = (q.data ?? []).filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(filter.toLowerCase()));
  const closed = loc.status === "closed";
  const row = (p: Person) => (
    <li key={p.personnel_id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{p.first_name} {p.last_name}</p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">{p.role_label && <span>{p.role_label}</span>}{p.phone && <a href={`tel:${p.phone}`} className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</a>}</p>
      </div>
      {!closed && (p.on_location
        ? <Button size="sm" variant="outline" disabled={set.isPending} onClick={() => set.mutate({ pid: p.personnel_id, assign: false })}><UserMinus className="mr-1 h-4 w-4" />Unassign</Button>
        : <Button size="sm" disabled={set.isPending} onClick={() => set.mutate({ pid: p.personnel_id, assign: true })}><UserPlus className="mr-1 h-4 w-4" />Assign</Button>)}
    </li>
  );
  if (q.isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  const on = rows.filter(p => p.on_location), off = rows.filter(p => !p.on_location);
  return (
    <div className="space-y-3">
      <Input placeholder="Search names" value={filter} onChange={e => setFilter(e.target.value)} className="max-w-sm" />
      <section className="rounded-lg border bg-card"><h3 className="border-b px-3 py-2 text-sm font-medium">On this location ({on.length})</h3><ul className="divide-y">{on.map(row)}</ul></section>
      <section className="rounded-lg border bg-card"><h3 className="border-b px-3 py-2 text-sm font-medium">Project roster — available to assign ({off.length})</h3><ul className="divide-y">{off.map(row)}</ul></section>
    </div>
  );
}

function Sheets({ loc }: { loc: Loc }) {
  const q = useQuery({ queryKey: ["co-sheets", loc.location_id], queryFn: async () => { const { data, error } = await rpc("customer_ops_sheets", { _location: loc.location_id }); if (error) throw error; return (data ?? []) as any[]; } });
  const [busy, setBusy] = useState<string | null>(null);
  const open = async (id: string) => {
    setBusy(id);
    try { const { data, error } = await supabase.functions.invoke("customer-sheet", { body: { sheet_day_id: id } }); if (error || !data?.url) throw error ?? new Error("Unavailable"); window.open(data.url, "_blank", "noopener"); }
    catch { toast.error("Sheet unavailable"); } finally { setBusy(null); }
  };
  useEffect(() => () => setBusy(null), []);
  if (q.isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (!q.data?.length) return <p className="text-muted-foreground">No sign-in sheets yet. Use Attendance → Download timesheet for daily hours.</p>;
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {q.data.map(s => (
        <li key={s.sheet_day_id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
          <span>{s.sheet_date} {s.countersign_name && <span className="text-muted-foreground">· approved by {s.countersign_name}</span>}</span>
          {s.status === "locked" && s.has_pdf ? <Button size="sm" variant="outline" disabled={busy === s.sheet_day_id} onClick={() => open(s.sheet_day_id)}><Download className="mr-1 h-4 w-4" />PDF</Button> : <Badge variant="secondary">Open</Badge>}
        </li>
      ))}
    </ul>
  );
}
