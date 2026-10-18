import { useMemo, useRef, useState } from "react";
import { addDays, format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Check, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Settings2, Trash2, Truck, UserMinus, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLocalDate } from "@/lib/dateUtils";
import { ROLE_TAGS } from "@/lib/roleTags";
import { useUserRole } from "@/hooks/useUserRole";
import { useProjectLocations, ProjectLocation } from "@/integrations/supabase/hooks/useProjectLocations";
import { useLocationAssignments } from "@/integrations/supabase/hooks/useLocationStaffing";
import { useProject, useUpdateProject } from "@/integrations/supabase/hooks/useProjects";
import {
  AttendanceStatus, markKey, useCrewMileage, useDeleteMileage, useLocationAttendance, useLocationAttendanceBatch,
  useLogMileage, useMarkCrewAttendance, useServiceLog, useSetAttendance, useToggleServiceMark,
} from "@/integrations/supabase/hooks/useDeployment";
import {
  Crew, fullName, useAddCrewMember, useCreateCrew, useCrews, usePersonnelDirectory, useRemoveCrewMember, useUpdateCrew,
} from "@/integrations/supabase/hooks/useCrews";

const db = supabase as any;
const DAYS = 10;
const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const today = () => ymd(new Date());

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

// ---------- Service grid ----------

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

// ---------- Attendance grid ----------

const NEXT: Record<string, AttendanceStatus | null> = { none: "worked", worked: "standby", standby: "no_show", no_show: null };
const STYLE: Record<AttendanceStatus, { label: string; cls: string }> = {
  worked: { label: "W", cls: "bg-success text-success-foreground border-success" },
  standby: { label: "S", cls: "bg-warning text-warning-foreground border-warning" },
  no_show: { label: "N", cls: "bg-destructive text-destructive-foreground border-destructive" },
};

function AttendanceCell({ status, hours, crewInitial, onTap, onLongPress, label }: {
  status?: AttendanceStatus; hours?: number | null; crewInitial?: string | null;
  onTap: () => void; onLongPress: () => void; label: string;
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
        "relative h-10 w-10 rounded-md border flex flex-col items-center justify-center mx-auto select-none touch-manipulation",
        status ? STYLE[status].cls : "bg-background hover:bg-muted",
      )}
    >
      {status && <span className="text-sm font-bold leading-none">{STYLE[status].label}</span>}
      {status && hours != null && <span className="text-[9px] leading-none mt-0.5">{hours}h</span>}
      {crewInitial && (
        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center border border-background">
          {crewInitial}
        </span>
      )}
    </button>
  );
}

function MarkCrewDialog({ open, onOpenChange, crews, locations, defaultLocationId, defaultDate, defaultHours }: {
  open: boolean; onOpenChange: (o: boolean) => void; crews: Crew[]; locations: ProjectLocation[];
  defaultLocationId: string; defaultDate: string; defaultHours: number;
}) {
  const active = crews.filter((c) => c.status === "active");
  const [crewId, setCrewId] = useState("");
  const [locId, setLocId] = useState(defaultLocationId);
  const [date, setDate] = useState(defaultDate);
  const [status, setStatus] = useState<AttendanceStatus>("worked");
  const mark = useMarkCrewAttendance();

  // reset defaults each open
  const openRef = useRef(false);
  if (open && !openRef.current) {
    openRef.current = true;
    setCrewId(active[0]?.id ?? "");
    setLocId(defaultLocationId);
    setDate(defaultDate);
    setStatus("worked");
  } else if (!open && openRef.current) openRef.current = false;

  const crew = active.find((c) => c.id === crewId);
  // roster as of the chosen date: joined_on <= date AND (left_on IS NULL OR left_on >= date)
  const rosterIds = useMemo(() => {
    if (!crew) return [] as string[];
    return crew.members
      .filter((m) => m.joined_on <= date && (!m.left_on || m.left_on >= date))
      .map((m) => m.personnel_id);
  }, [crew, date]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="text-base">Mark crew attendance</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Crew</Label>
            <Select value={crewId} onValueChange={setCrewId}>
              <SelectTrigger><SelectValue placeholder="Pick a crew" /></SelectTrigger>
              <SelectContent>{active.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Location</Label>
            <Select value={locId} onValueChange={setLocId}>
              <SelectTrigger><SelectValue placeholder="Pick a location" /></SelectTrigger>
              <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as AttendanceStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="worked">Worked</SelectItem>
                  <SelectItem value="standby">Standby</SelectItem>
                  <SelectItem value="no_show">No-show</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {rosterIds.length} current member{rosterIds.length === 1 ? "" : "s"} will be marked
            {status === "worked" ? ` at ${defaultHours}h each` : ""}. You can fix individuals afterward by tapping their cells.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!crewId || !locId || !date || !rosterIds.length || mark.isPending}
            onClick={() => mark.mutate(
              { crew_id: crewId, location_id: locId, att_date: date, status, defaultHours, memberIds: rosterIds },
              { onSuccess: () => onOpenChange(false) },
            )}
          >
            {mark.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Mark {rosterIds.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttendanceGrid({ locations, crews, defaultHours }: { locations: ProjectLocation[]; crews: Crew[]; defaultHours: number }) {
  const [locId, setLocId] = useState<string>(locations[0]?.id ?? "");
  const r = useDateRange();
  const { data: assigned = [] } = useLocationAssignments(locId || undefined);
  const { data: att = [], isLoading } = useLocationAttendance(locId || undefined, r.from, r.to);
  const setAtt = useSetAttendance();
  const [edit, setEdit] = useState<{ pid: string; name: string; date: string; status: AttendanceStatus | "none"; hours: string } | null>(null);
  const [markCrewOpen, setMarkCrewOpen] = useState(false);

  const crewInitial = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of crews) m[c.id] = (c.name.trim()[0] || "C").toUpperCase();
    return m;
  }, [crews]);

  const people = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of assigned) m.set(a.personnel_id, fullName(a.personnel));
    for (const a of att) if (!m.has(a.personnel_id)) m.set(a.personnel_id, fullName(a.personnel));
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [assigned, att]);

  const cells = useMemo(() => {
    const m: Record<string, { status: AttendanceStatus; hours: number | null; crew_id: string | null }> = {};
    for (const a of att) m[`${a.personnel_id}|${a.att_date}`] = { status: a.status, hours: a.hours, crew_id: a.crew_id };
    return m;
  }, [att]);

  const hasActiveCrew = crews.some((c) => c.status === "active");

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
        {hasActiveCrew && (
          <Button size="sm" variant="secondary" className="gap-1" onClick={() => setMarkCrewOpen(true)}>
            <Users className="h-4 w-4" />Mark crew
          </Button>
        )}
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
                            crewInitial={c?.crew_id ? crewInitial[c.crew_id] : null}
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

      <MarkCrewDialog
        open={markCrewOpen}
        onOpenChange={setMarkCrewOpen}
        crews={crews}
        locations={locations}
        defaultLocationId={locId}
        defaultDate={r.dates[DAYS - 1]}
        defaultHours={defaultHours}
      />
    </div>
  );
}

// ---------- Crews section ----------

function PersonPicker({ value, onChange, excludeIds, placeholder }: {
  value: string; onChange: (id: string) => void; excludeIds?: Set<string>; placeholder: string;
}) {
  const [q, setQ] = useState("");
  const { data: dir = [], isLoading } = usePersonnelDirectory(true);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return dir
      .filter((p) => !excludeIds?.has(p.id))
      .filter((p) => !needle || fullName(p).toLowerCase().includes(needle))
      .slice(0, 50);
  }, [dir, q, excludeIds]);
  return (
    <div className="space-y-1">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="h-9" />
      <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
        {isLoading ? <div className="p-2"><Loader2 className="h-4 w-4 animate-spin" /></div> :
          list.length === 0 ? <p className="p-2 text-xs text-muted-foreground">No matches.</p> :
          list.map((p) => (
            <button
              key={p.id} type="button"
              onClick={() => onChange(p.id)}
              className={cn("w-full text-left px-2 py-1.5 text-sm hover:bg-muted", value === p.id && "bg-primary/10")}
            >
              {fullName(p)}
            </button>
          ))}
      </div>
    </div>
  );
}

function CrewDialog({ open, onOpenChange, projectId, crew }: {
  open: boolean; onOpenChange: (o: boolean) => void; projectId: string; crew: Crew | null;
}) {
  const create = useCreateCrew(projectId);
  const update = useUpdateCrew(projectId);
  const addMember = useAddCrewMember(projectId);
  const removeMember = useRemoveCrewMember(projectId);
  const [name, setName] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [trucks, setTrucks] = useState("");
  const [notes, setNotes] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [confirmDisband, setConfirmDisband] = useState(false);

  const openRef = useRef(false);
  if (open && !openRef.current) {
    openRef.current = true;
    setName(crew?.name ?? "");
    setSupervisorId(crew?.supervisor_personnel_id ?? "");
    setTrucks(crew?.truck_count != null ? String(crew.truck_count) : "");
    setNotes(crew?.notes ?? "");
    setMemberRole("");
  } else if (!open && openRef.current) openRef.current = false;

  const memberIds = new Set(crew?.members.map((m) => m.personnel_id) ?? []);
  const saving = create.isPending || update.isPending;

  const save = () => {
    const payload = {
      name: name.trim(),
      supervisor_personnel_id: supervisorId || null,
      truck_count: trucks.trim() ? Number(trucks) : null,
      notes: notes.trim() || null,
    };
    if (!payload.name) return;
    if (crew) update.mutate({ id: crew.id, ...payload }, { onSuccess: () => onOpenChange(false) });
    else create.mutate(payload, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-base">{crew ? `Edit ${crew.name}` : "New crew"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Crew A" /></div>
          <div><Label>Supervisor</Label>
            <PersonPicker value={supervisorId} onChange={setSupervisorId} placeholder="Search personnel…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Trucks</Label><Input type="number" inputMode="numeric" min={0} value={trucks} onChange={(e) => setTrucks(e.target.value)} /></div>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>

          {crew && (
            <div className="space-y-2 pt-1">
              <Label>Members ({crew.members.length})</Label>
              <div className="border rounded-md divide-y">
                {crew.members.length === 0 && <p className="p-2 text-xs text-muted-foreground">No members yet.</p>}
                {crew.members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 px-2 py-1.5">
                    <span className="text-sm flex-1 truncate">{fullName(m.personnel)}</span>
                    {m.role_label && <Badge variant="outline" className="text-[10px]">{m.role_label}</Badge>}
                    <span className="text-[10px] text-muted-foreground">joined {formatLocalDate(m.joined_on, "M/d")}</span>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7" aria-label={`Remove ${fullName(m.personnel)}`}
                      onClick={() => removeMember.mutate({ id: m.id })}
                    ><UserMinus className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-[1fr_8rem] gap-2 items-end">
                <div><Label className="text-xs">Add member</Label>
                  <PersonPicker
                    value=""
                    onChange={(pid) => addMember.mutate({ crew_id: crew.id, personnel_id: pid, role_label: memberRole || null })}
                    excludeIds={memberIds}
                    placeholder="Search to add…"
                  />
                </div>
                <div><Label className="text-xs">Role</Label>
                  <Select value={memberRole} onValueChange={setMemberRole}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {ROLE_TAGS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          {crew && crew.status === "active" ? (
            <Button variant="ghost" className="text-destructive" onClick={() => setConfirmDisband(true)}>Disband</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmDisband} onOpenChange={setConfirmDisband}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disband {crew?.name}?</AlertDialogTitle>
            <AlertDialogDescription>The crew is marked disbanded; membership and mileage history are kept.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (crew) update.mutate({ id: crew.id, status: "disbanded" }, { onSuccess: () => { setConfirmDisband(false); onOpenChange(false); } });
            }}>Disband</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function CrewsSection({ projectId, crews, canEdit }: { projectId: string; crews: Crew[]; canEdit: boolean }) {
  const [dialog, setDialog] = useState<{ open: boolean; crew: Crew | null }>({ open: false, crew: null });
  return (
    <Card>
      <CardHeader className="py-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" />Crews</CardTitle>
        {canEdit && (
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setDialog({ open: true, crew: null })}>
            <Plus className="h-4 w-4" />New crew
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {crews.length === 0 && <p className="text-sm text-muted-foreground">No crews yet. Crews enable one-tap attendance and mileage logging.</p>}
        {crews.map((c) => {
          const sup = c.supervisor ? fullName(c.supervisor) : null;
          return (
            <div key={c.id} className="flex items-center gap-2 border rounded-md px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{c.name}</span>
                  <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-[10px]">{c.status}</Badge>
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {sup ? `${sup} (Super)` : "No supervisor"} · {techs + (sup ? 1 : 0) - (sup ? 1 : 0) + techs * 0 + (c.members.length - (sup ? 1 : 0))} members · {c.truck_count ?? 0} truck{(c.truck_count ?? 0) === 1 ? "" : "s"}
                </div>
              </div>
              {canEdit && (
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Edit ${c.name}`} onClick={() => setDialog({ open: true, crew: c })}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
      <CrewDialog open={dialog.open} onOpenChange={(o) => setDialog({ open: o, crew: dialog.crew })} projectId={projectId} crew={dialog.crew} />
    </Card>
  );
}

// ---------- Mileage ----------

function MileageCard({ crews, from, to, mileageRate, canEdit }: {
  crews: Crew[]; from: string; to: string; mileageRate: number | null; canEdit: boolean;
}) {
  const crewIds = crews.map((c) => c.id);
  const { data: rows = [], isLoading } = useCrewMileage(crewIds, from, to);
  const log = useLogMileage();
  const del = useDeleteMileage();
  const [open, setOpen] = useState(false);
  const [crewId, setCrewId] = useState("");
  const [date, setDate] = useState(today());
  const [miles, setMiles] = useState("");
  const [notes, setNotes] = useState("");
  const [delId, setDelId] = useState<string | null>(null);

  const crewName = useMemo(() => Object.fromEntries(crews.map((c) => [c.id, c.name])), [crews]);
  const totalMiles = rows.reduce((s, r) => s + (Number(r.miles) || 0), 0);
  const billable = mileageRate != null ? totalMiles * mileageRate : null;

  const openRef = useRef(false);
  if (open && !openRef.current) {
    openRef.current = true;
    setCrewId(crews.find((c) => c.status === "active")?.id ?? crews[0]?.id ?? "");
    setDate(today()); setMiles(""); setNotes("");
  } else if (!open && openRef.current) openRef.current = false;

  if (crews.length === 0) return null;

  return (
    <Card>
      <CardHeader className="py-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2"><Truck className="h-4 w-4" />Mileage</CardTitle>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Log miles</Button>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No miles logged in this window.</p>
        ) : (
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50 text-left">
                <th className="p-2">Crew</th><th className="p-2">Date</th><th className="p-2 text-right">Miles</th><th className="p-2">Notes</th>{canEdit && <th className="p-2 w-10" />}
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{crewName[r.crew_id] ?? "—"}</td>
                    <td className="p-2 whitespace-nowrap">{formatLocalDate(r.log_date, "M/d")}</td>
                    <td className="p-2 text-right font-medium">{Number(r.miles).toLocaleString()}</td>
                    <td className="p-2 text-muted-foreground truncate max-w-[10rem]">{r.notes ?? ""}</td>
                    {canEdit && (
                      <td className="p-2">
                        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Delete mileage" onClick={() => setDelId(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="text-xs text-muted-foreground">
          Window total: <span className="font-medium text-foreground">{totalMiles.toLocaleString()} mi</span>
          {billable != null && <> · ≈ <span className="font-medium text-foreground">${billable.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span> billable</>}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-base">Log miles</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Crew</Label>
              <Select value={crewId} onValueChange={setCrewId}>
                <SelectTrigger><SelectValue placeholder="Pick a crew" /></SelectTrigger>
                <SelectContent>{crews.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div><Label>Miles</Label><Input type="number" inputMode="decimal" min={0} step="0.1" value={miles} onChange={(e) => setMiles(e.target.value)} /></div>
            </div>
            <div><Label>Notes (optional)</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <p className="text-[11px] text-muted-foreground">Re-entering the same crew + date overwrites the previous entry.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!crewId || !date || !miles.trim() || log.isPending}
              onClick={() => log.mutate({ crew_id: crewId, log_date: date, miles: Number(miles), notes: notes.trim() || null }, { onSuccess: () => setOpen(false) })}
            >{log.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete mileage entry?</AlertDialogTitle>
            <AlertDialogDescription>This removes the logged miles for that crew and date.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => delId && del.mutate(delId, { onSuccess: () => setDelId(null) })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ---------- Summary strip ----------

function useRoleLabels(locationIds: string[], crews: Crew[]) {
  const ids = [...locationIds].sort();
  const crewIds = crews.map((c) => c.id).sort();
  return useQuery({
    queryKey: ["deployment-role-labels", ids, crewIds],
    enabled: ids.length > 0,
    queryFn: async () => {
      // bill rates per location+role
      const { data: reqs, error: rErr } = await db.from("location_requirements")
        .select("location_id, role_label, bill_rate").in("location_id", ids);
      if (rErr) throw rErr;
      const rates: Record<string, number> = {};
      for (const r of reqs ?? []) if (r.bill_rate != null) rates[`${r.location_id}|${r.role_label}`] = Number(r.bill_rate);
      // role label per person: crew membership first, then location assignment
      const roleByPerson: Record<string, string> = {};
      if (crewIds.length) {
        const { data: cms, error: cErr } = await db.from("crew_members")
          .select("personnel_id, role_label").in("crew_id", crewIds).is("left_on", null);
        if (cErr) throw cErr;
        for (const m of cms ?? []) if (m.role_label && !roleByPerson[m.personnel_id]) roleByPerson[m.personnel_id] = m.role_label;
      }
      const { data: las, error: lErr } = await db.from("location_assignments")
        .select("personnel_id, role_label").in("location_id", ids).eq("status", "active");
      if (lErr) throw lErr;
      for (const a of las ?? []) if (a.role_label && !roleByPerson[a.personnel_id]) roleByPerson[a.personnel_id] = a.role_label;
      return { rates, roleByPerson };
    },
  });
}

function SummaryStrip({ locations, crews, from, to, mileageRate }: {
  locations: ProjectLocation[]; crews: Crew[]; from: string; to: string; mileageRate: number | null;
}) {
  const locIds = locations.map((l) => l.id);
  const { data: att = [] } = useLocationAttendanceBatch(locIds, from, to);
  const { data: miles = [] } = useCrewMileage(crews.map((c) => c.id), from, to);
  const { data: rl } = useRoleLabels(locIds, crews);

  const s = useMemo(() => {
    const personDays = new Set<string>();
    let hours = 0, missingRate = 0, laborBill = 0;
    for (const a of att) {
      if (a.status === "worked") personDays.add(`${a.personnel_id}|${a.att_date}`);
      const h = Number(a.hours) || 0;
      hours += h;
      if (h > 0) {
        const role = rl?.roleByPerson[a.personnel_id];
        const rate = role ? rl?.rates[`${a.location_id}|${role}`] : undefined;
        if (rate != null) laborBill += h * rate; else missingRate++;
      }
    }
    const totalMiles = miles.reduce((sum, m) => sum + (Number(m.miles) || 0), 0);
    const mileBill = mileageRate != null ? totalMiles * mileageRate : 0;
    return { personDays: personDays.size, hours, totalMiles, missingRate, billable: laborBill + mileBill };
  }, [att, miles, rl, mileageRate]);

  const Item = ({ label, value }: { label: string; value: string }) => (
    <div className="flex-1 min-w-[7rem] border rounded-md px-3 py-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold leading-tight">{value}</div>
    </div>
  );

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <Item label="Person-days" value={String(s.personDays)} />
        <Item label="Hours" value={s.hours.toLocaleString()} />
        <Item label="Miles" value={s.totalMiles.toLocaleString()} />
        <Item label="Est. billable" value={`$${s.billable.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
      </div>
      {s.missingRate > 0 && (
        <p className="text-[11px] text-warning">{s.missingRate} row{s.missingRate === 1 ? "" : "s"} missing a bill rate — hours counted but not billed.</p>
      )}
    </div>
  );
}

// ---------- Settings popover ----------

function DeploymentSettings({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const { data: project } = useProject(projectId);
  const update = useUpdateProject();
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState("");
  const [open, setOpen] = useState(false);

  const openRef = useRef(false);
  if (open && !openRef.current) {
    openRef.current = true;
    setHours(project?.default_shift_hours != null ? String(project.default_shift_hours) : "12");
    setRate(project?.mileage_rate != null ? String(project.mileage_rate) : "");
  } else if (!open && openRef.current) openRef.current = false;

  if (!canEdit) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1"><Settings2 className="h-4 w-4" />Billing settings</Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3" align="end">
        <div><Label>Default shift hours</Label>
          <Input type="number" inputMode="decimal" min={0} step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} />
        </div>
        <div><Label>Mileage rate ($/mile, optional)</Label>
          <Input type="number" inputMode="decimal" min={0} step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 0.70" />
        </div>
        <Button
          size="sm" className="w-full" disabled={update.isPending}
          onClick={() => update.mutate({
            id: projectId,
            default_shift_hours: hours.trim() ? Number(hours) : 12,
            mileage_rate: rate.trim() ? Number(rate) : null,
          } as any, { onSuccess: () => setOpen(false) })}
        >{update.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Save</Button>
      </PopoverContent>
    </Popover>
  );
}

// ---------- Tab root ----------

export function ProjectDeploymentTab({ projectId }: { projectId: string }) {
  const { data: locations = [], isLoading } = useProjectLocations(projectId);
  const { data: crews = [] } = useCrews(projectId);
  const { data: project } = useProject(projectId);
  const { isAdmin, isManager } = useUserRole();
  const canEdit = isAdmin || isManager;
  const r = useDateRange();

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (locations.length === 0) {
    return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Add locations first to track daily service and attendance.</CardContent></Card>;
  }

  const defaultHours = Number((project as any)?.default_shift_hours ?? 12) || 12;
  const mileageRate = (project as any)?.mileage_rate != null ? Number((project as any).mileage_rate) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <SummaryStrip locations={locations} crews={crews} from={r.from} to={r.to} mileageRate={mileageRate} />
        <DeploymentSettings projectId={projectId} canEdit={canEdit} />
      </div>
      <CrewsSection projectId={projectId} crews={crews} canEdit={canEdit} />
      <MileageCard crews={crews} from={r.from} to={r.to} mileageRate={mileageRate} canEdit={canEdit} />
      <Tabs defaultValue="service">
        <TabsList>
          <TabsTrigger value="service">Service grid</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>
        <TabsContent value="service"><ServiceGrid locations={locations} /></TabsContent>
        <TabsContent value="attendance"><AttendanceGrid locations={locations} crews={crews} defaultHours={defaultHours} /></TabsContent>
      </Tabs>
    </div>
  );
}
