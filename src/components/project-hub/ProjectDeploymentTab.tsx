import { useMemo, useRef, useState } from "react";
import { addDays, format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLocalDate, parseLocalDate } from "@/lib/dateUtils";
import { useProjectLocations, ProjectLocation } from "@/integrations/supabase/hooks/useProjectLocations";
import { useLocationAssignments } from "@/integrations/supabase/hooks/useLocationStaffing";
import {
  AttendanceStatus, markKey, useLocationAttendance, useServiceLog, useSetAttendance, useToggleServiceMark,
} from "@/integrations/supabase/hooks/useDeployment";

const DAYS = 10;
const ymd = (d: Date) => format(d, "yyyy-MM-dd");

function useDateRange() {
  const [offset, setOffset] = useState(0); // in windows of DAYS
  const dates = useMemo(() => {
    const end = addDays(new Date(), offset * DAYS);
    return Array.from({ length: DAYS }, (_, i) => ymd(addDays(end, i - (DAYS - 1))));
  }, [offset]);
  return { dates, from: dates[0], to: dates[DAYS - 1], offset, setOffset };
}

function RangePager({ r }: { r: ReturnType<typeof useDateRange> }) {
  return (
    <div className="flex items-center gap-2">
      <Button size="icon" variant="outline" className="h-9 w-9" aria-label="Earlier" onClick={() => r.setOffset(r.offset - 1)}><ChevronLeft className="h-4 w-4" /></Button>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatLocalDate(r.from, "M/d")} – {formatLocalDate(r.to, "M/d")}</span>
      <Button size="icon" variant="outline" className="h-9 w-9" aria-label="Later" onClick={() => r.setOffset(r.offset + 1)} disabled={r.offset >= 0}><ChevronRight className="h-4 w-4" /></Button>
      {r.offset !== 0 && <Button size="sm" variant="ghost" onClick={() => r.setOffset(0)}>Today</Button>}
    </div>
  );
}

const inWindow = (l: ProjectLocation, d: string) =>
  !(l.demobe_date && l.demobe_date < d) && !(l.mobe_date && l.mobe_date > d);

const DateHead = ({ d }: { d: string }) => (
  <div className="leading-tight">
    <div className="text-[10px] uppercase text-muted-foreground">{formatLocalDate(d, "EEE")}</div>
    <div className="text-xs font-medium">{formatLocalDate(d, "M/d")}</div>
  </div>
);

function ServiceGrid({ locations }: { locations: ProjectLocation[] }) {
  const r = useDateRange();
  const { data: marks = {}, isLoading } = useServiceLog(locations.map((l) => l.id), r.from, r.to);
  const toggle = useToggleServiceMark();

  return (
    <div className="space-y-2">
      <RangePager r={r} />
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
        <div className="overflow-x-auto border rounded-md">
          <table className="text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted text-left p-2 min-w-[10rem] max-w-[14rem]">Location</th>
                {r.dates.map((d) => {
                  const active = locations.filter((l) => inWindow(l, d));
                  const done = active.filter((l) => marks[markKey(l.id, d)]).length;
                  return (
                    <th key={d} className="p-1 text-center min-w-[3rem]">
                      <DateHead d={d} />
                      <div className="text-[10px] text-muted-foreground">{done}/{active.length}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {locations.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="sticky left-0 z-10 bg-card p-2 align-top max-w-[14rem]">
                    <div className="font-medium truncate">{l.name}</div>
                    {l.project_number && <Badge variant="outline" className="text-[10px]">#{l.project_number}</Badge>}
                    {l.scope && <div className="text-[11px] text-muted-foreground truncate">{l.scope}</div>}
                    {(l.mobe_date || l.demobe_date) && (
                      <div className="text-[10px] text-muted-foreground">
                        {l.mobe_date ? formatLocalDate(l.mobe_date, "M/d") : "?"} → {l.demobe_date ? formatLocalDate(l.demobe_date, "M/d") : "…"}
                      </div>
                    )}
                  </td>
                  {r.dates.map((d) => {
                    const id = marks[markKey(l.id, d)];
                    const disabled = !inWindow(l, d) && !id;
                    return (
                      <td key={d} className="p-1 text-center">
                        <button
                          type="button"
                          disabled={disabled || toggle.isPending}
                          aria-label={`${l.name} ${d} ${id ? "serviced" : "not serviced"}`}
                          onClick={() => toggle.mutate({ location_id: l.id, service_date: d, existingId: id })}
                          className={cn(
                            "h-10 w-10 rounded-md border flex items-center justify-center mx-auto transition-colors",
                            id ? "bg-success text-success-foreground border-success" : "bg-background hover:bg-muted",
                            disabled && "opacity-30 cursor-not-allowed",
                          )}
                        >
                          {id && <Check className="h-5 w-5" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const NEXT: Record<string, AttendanceStatus | null> = { none: "worked", worked: "standby", standby: "no_show", no_show: null };
const STYLE: Record<AttendanceStatus, { label: string; cls: string }> = {
  worked: { label: "W", cls: "bg-success text-success-foreground border-success" },
  standby: { label: "S", cls: "bg-warning text-warning-foreground border-warning" },
  no_show: { label: "N", cls: "bg-destructive text-destructive-foreground border-destructive" },
};

function AttendanceCell({ status, hours, onTap, onLongPress, label }: {
  status?: AttendanceStatus; hours?: number | null; onTap: () => void; onLongPress: () => void; label: string;
}) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const start = () => {
    fired.current = false;
    timer.current = window.setTimeout(() => { fired.current = true; onLongPress(); }, 500);
  };
  const cancel = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = null; };
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => { e.preventDefault(); }}
      onClick={() => { if (fired.current) { fired.current = false; return; } onTap(); }}
      className={cn(
        "h-10 w-10 rounded-md border flex flex-col items-center justify-center mx-auto select-none touch-manipulation",
        status ? STYLE[status].cls : "bg-background hover:bg-muted",
      )}
    >
      {status && <span className="text-sm font-bold leading-none">{STYLE[status].label}</span>}
      {status && hours != null && <span className="text-[9px] leading-none mt-0.5">{hours}h</span>}
    </button>
  );
}

function AttendanceGrid({ locations }: { locations: ProjectLocation[] }) {
  const [locId, setLocId] = useState<string>(locations[0]?.id ?? "");
  const r = useDateRange();
  const { data: assigned = [] } = useLocationAssignments(locId || undefined);
  const { data: att = [], isLoading } = useLocationAttendance(locId || undefined, r.from, r.to);
  const setAtt = useSetAttendance();
  const [edit, setEdit] = useState<{ pid: string; name: string; date: string; status: AttendanceStatus | "none"; hours: string } | null>(null);

  const people = useMemo(() => {
    const m = new Map<string, string>();
    const nm = (p: { first_name: string | null; last_name: string | null } | null) =>
      [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Unknown";
    for (const a of assigned) m.set(a.personnel_id, nm(a.personnel));
    for (const a of att) if (!m.has(a.personnel_id)) m.set(a.personnel_id, nm(a.personnel));
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [assigned, att]);

  const cells = useMemo(() => {
    const m: Record<string, { status: AttendanceStatus; hours: number | null }> = {};
    for (const a of att) m[`${a.personnel_id}|${a.att_date}`] = { status: a.status, hours: a.hours };
    return m;
  }, [att]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={locId} onValueChange={setLocId}>
          <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Pick a location" /></SelectTrigger>
          <SelectContent>
            {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}{l.project_number ? ` (#${l.project_number})` : ""}</SelectItem>)}
          </SelectContent>
        </Select>
        <RangePager r={r} />
      </div>
      <p className="text-[11px] text-muted-foreground">Tap: blank → W → S → N → blank. Press and hold a cell to set hours.</p>
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : people.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No personnel assigned to this location.</p>
      ) : (
        <div className="overflow-x-auto border rounded-md">
          <table className="text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted text-left p-2 min-w-[9rem]">Name</th>
                {r.dates.map((d) => <th key={d} className="p-1 text-center min-w-[3rem]"><DateHead d={d} /></th>)}
                <th className="p-2 text-center">Days</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const worked = r.dates.filter((d) => cells[`${p.id}|${d}`]?.status === "worked").length;
                return (
                  <tr key={p.id} className="border-t">
                    <td className="sticky left-0 z-10 bg-card p-2 font-medium whitespace-nowrap">{p.name}</td>
                    {r.dates.map((d) => {
                      const c = cells[`${p.id}|${d}`];
                      return (
                        <td key={d} className="p-1 text-center">
                          <AttendanceCell
                            status={c?.status}
                            hours={c?.hours}
                            label={`${p.name} ${d} ${c?.status ?? "blank"}`}
                            onTap={() => setAtt.mutate({ location_id: locId, personnel_id: p.id, att_date: d, status: NEXT[c?.status ?? "none"] })}
                            onLongPress={() => setEdit({ pid: p.id, name: p.name, date: d, status: c?.status ?? "worked", hours: c?.hours != null ? String(c.hours) : "" })}
                          />
                        </td>
                      );
                    })}
                    <td className="p-2 text-center font-semibold">{worked}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle className="text-base">{edit?.name} · {edit && formatLocalDate(edit.date, "EEE M/d")}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Status</Label>
                <Select value={edit.status} onValueChange={(v) => setEdit({ ...edit, status: v as AttendanceStatus | "none" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Blank</SelectItem>
                    <SelectItem value="worked">Worked</SelectItem>
                    <SelectItem value="standby">Standby</SelectItem>
                    <SelectItem value="no_show">No-show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Hours (optional)</Label>
                <Input type="number" inputMode="decimal" min={0} step="0.25" value={edit.hours} onChange={(e) => setEdit({ ...edit, hours: e.target.value })} disabled={edit.status === "none"} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={() => {
              if (!edit) return;
              setAtt.mutate({
                location_id: locId, personnel_id: edit.pid, att_date: edit.date,
                status: edit.status === "none" ? null : edit.status,
                hours: edit.hours.trim() ? Number(edit.hours) : null,
              });
              setEdit(null);
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ProjectDeploymentTab({ projectId }: { projectId: string }) {
  const { data: locations = [], isLoading } = useProjectLocations(projectId);
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (locations.length === 0) {
    return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Add locations first to track daily service and attendance.</CardContent></Card>;
  }
  return (
    <Tabs defaultValue="service">
      <TabsList>
        <TabsTrigger value="service">Service grid</TabsTrigger>
        <TabsTrigger value="attendance">Attendance</TabsTrigger>
      </TabsList>
      <TabsContent value="service"><ServiceGrid locations={locations} /></TabsContent>
      <TabsContent value="attendance"><AttendanceGrid locations={locations} /></TabsContent>
    </Tabs>
  );
}

// keep parseLocalDate import tree-shaken-safe for future use
void parseLocalDate;
