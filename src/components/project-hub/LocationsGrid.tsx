import { Fragment, useEffect, useMemo, useState } from "react";
import { endOfWeek, format, startOfWeek } from "date-fns";
import { ChevronDown, ChevronRight, ExternalLink, MessageSquare, Search, UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatLocalDate } from "@/lib/dateUtils";
import { PersonnelStatusButton } from "@/components/personnel/lifecycle/PersonnelStatusButton";
import type { ProjectLocation } from "@/integrations/supabase/hooks/useProjectLocations";
import {
  LocationStaffingSummary, useLocationsAssignments, useUnassignPersonnel,
} from "@/integrations/supabase/hooks/useLocationStaffing";
import { useTrailHoursByPersonLocation } from "@/integrations/supabase/hooks/useFieldMode";
import { autoMobilize, useInvalidateStatus } from "@/integrations/supabase/hooks/usePersonnelStatus";
import { SendSiteTextDialog, useLastSiteTexts } from "./SendSiteTextDialog";
import { AssignDialog } from "./LocationStaffing";

const fmtRate = (r: number | null) => (r != null ? ` · $${Number(r).toLocaleString(undefined, { maximumFractionDigits: 2 })}/hr` : "");

export function LocationsGrid({ projectId, locations, staffing, lastServiced, deploymentMode, canWrite, onOpenCard }: {
  projectId: string;
  locations: ProjectLocation[];
  staffing?: Record<string, LocationStaffingSummary>;
  lastServiced?: Record<string, string>;
  deploymentMode: boolean;
  canWrite: boolean;
  onOpenCard: (locationId: string) => void;
}) {
  const locIds = useMemo(() => locations.map((l) => l.id), [locations]);
  const { data: assignments = [] } = useLocationsAssignments(locIds);
  const { data: texted = {} } = useLastSiteTexts(locIds);
  const now = new Date();
  const wkFrom = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const wkTo = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const { data: hours = {} } = useTrailHoursByPersonLocation(projectId, wkFrom, wkTo);
  const unassign = useUnassignPersonnel();
  const invStatus = useInvalidateStatus();

  const storeKey = `locations-grid-collapsed:${projectId}`;
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(storeKey) || "[]")); } catch { return new Set(); }
  });
  useEffect(() => { try { localStorage.setItem(storeKey, JSON.stringify([...collapsed])); } catch { /* ignore */ } }, [collapsed, storeKey]);
  const toggle = (id: string) => setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [q, setQ] = useState("");
  const [assignFor, setAssignFor] = useState<{ locationId: string; role?: string } | null>(null);
  const [textFor, setTextFor] = useState<{ locationId: string; ids: string[] } | null>(null);

  const byLoc = useMemo(() => {
    const m: Record<string, typeof assignments> = {};
    for (const a of assignments) (m[a.location_id] ??= []).push(a);
    return m;
  }, [assignments]);

  const search = q.trim().toLowerCase();
  const nameOf = (a: (typeof assignments)[number]) => [a.personnel?.first_name, a.personnel?.last_name].filter(Boolean).join(" ") || "Unknown";

  const assignLoc = assignFor ? locations.find((l) => l.id === assignFor.locationId) : undefined;
  const assignedIdsFor = useMemo(() => new Set((assignFor ? byLoc[assignFor.locationId] ?? [] : []).map((a) => a.personnel_id)), [assignFor, byLoc]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[12rem] max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="h-8 pl-7 text-xs" />
        </div>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setCollapsed(new Set())}>Expand all</Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setCollapsed(new Set(locIds))}>Collapse all</Button>
      </div>

      <div className="border rounded-md overflow-auto max-h-[75vh]">
        <table className="w-full text-xs tabular-nums min-w-[720px]">
          <thead className="sticky top-0 z-10 bg-muted text-muted-foreground">
            <tr className="text-left">
              <th className="px-2 py-1.5 font-medium">Name</th>
              <th className="px-2 py-1.5 font-medium">Role</th>
              <th className="px-2 py-1.5 font-medium">Status</th>
              <th className="px-2 py-1.5 font-medium">Texted</th>
              <th className="px-2 py-1.5 font-medium text-right">Hrs (wk)</th>
              <th className="px-2 py-1.5 font-medium text-right w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((l) => {
              const s = staffing?.[l.id];
              const rows = (byLoc[l.id] ?? []).filter((a) => !search || nameOf(a).toLowerCase().includes(search) || (a.role_label ?? "").toLowerCase().includes(search));
              if (search && rows.length === 0) return null;
              const isOpen = search ? true : !collapsed.has(l.id);
              const open = Object.entries(s?.byRole ?? {}).filter(([, v]) => v.needed > v.assigned);
              const full = (s?.needed ?? 0) > 0 && (s?.assigned ?? 0) >= (s?.needed ?? 0);
              return (
                <Fragment key={l.id}>
                  <tr className="border-t bg-muted/40 hover:bg-muted/60">
                    <td colSpan={6} className="px-2 py-1">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <button type="button" onClick={() => toggle(l.id)} className="flex items-center gap-1 font-semibold min-w-0" aria-expanded={isOpen}>
                          {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                          <span className="truncate max-w-[16rem]">{l.name}</span>
                        </button>
                        {l.project_number && <Badge variant="outline" className="text-[10px] px-1.5 py-0">#{l.project_number}</Badge>}
                        <span className={cn("font-medium", full ? "text-success" : "text-warning")}>{s?.assigned ?? 0}/{s?.needed ?? 0}</span>
                        {l.housing_provided_by === "customer" && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Housing: Cust</Badge>}
                        {l.housing_provided_by === "frg" && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Housing: FRG</Badge>}
                        {(l.mobe_date || l.demobe_date) && (
                          <span className="text-muted-foreground">{l.mobe_date ? formatLocalDate(l.mobe_date, "M/d") : "—"}→{l.demobe_date ? formatLocalDate(l.demobe_date, "M/d") : "—"}</span>
                        )}
                        {deploymentMode && lastServiced?.[l.id] && <span className="text-muted-foreground">Svc {formatLocalDate(lastServiced[l.id], "M/d")}</span>}
                        <span className="ml-auto flex items-center gap-1">
                          {canWrite && (
                            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => setAssignFor({ locationId: l.id })}>
                              <UserPlus className="h-3 w-3 mr-1" />Assign
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => onOpenCard(l.id)}>
                            <ExternalLink className="h-3 w-3 mr-1" />Open card
                          </Button>
                        </span>
                      </div>
                    </td>
                  </tr>
                  {isOpen && rows.map((a) => {
                    const k = `${a.personnel_id}:${l.id}`;
                    const h = hours[k];
                    return (
                      <tr key={a.id} className="border-t hover:bg-muted/30">
                        <td className="px-2 py-1 pl-7 font-medium whitespace-nowrap">{nameOf(a)}</td>
                        <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">{a.role_label ?? "—"}</td>
                        <td className="px-2 py-1"><PersonnelStatusButton personnelId={a.personnel_id} projectId={projectId} className="text-[10px] px-1.5 py-0" /></td>
                        <td className="px-2 py-1 text-muted-foreground">{texted[k] ? format(new Date(texted[k]), "M/d") : "—"}</td>
                        <td className="px-2 py-1 text-right">{h ? h.toFixed(2) : "—"}</td>
                        <td className="px-2 py-1 text-right whitespace-nowrap">
                          <button type="button" className="rounded p-1 hover:bg-muted" aria-label="Send site text" onClick={() => setTextFor({ locationId: l.id, ids: [a.personnel_id] })}>
                            <MessageSquare className="h-3.5 w-3.5" />
                          </button>
                          {canWrite && (
                            <button type="button" className="rounded p-1 hover:bg-muted" aria-label="Unassign" onClick={() => unassign.mutate({ id: a.id, location_id: l.id })}>
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {isOpen && !search && open.map(([role, v]) => (
                    <tr key={`open-${role}`} className="border-t text-muted-foreground">
                      <td colSpan={5} className="px-2 py-1 pl-7 italic">{role} — {v.needed - v.assigned} open{fmtRate(v.rate)}</td>
                      <td className="px-2 py-1 text-right">
                        {canWrite && (
                          <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setAssignFor({ locationId: l.id, role })}>Assign</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {isOpen && !search && rows.length === 0 && open.length === 0 && (
                    <tr className="border-t"><td colSpan={6} className="px-2 py-1 pl-7 text-muted-foreground">No one assigned.</td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {canWrite && assignFor && (
        <AssignDialog
          locationId={assignFor.locationId}
          open={!!assignFor}
          onOpenChange={(o) => !o && setAssignFor(null)}
          assignedIds={assignedIdsFor}
          defaultRole={assignFor.role}
          roleOptions={Object.keys(staffing?.[assignFor.locationId]?.byRole ?? {})}
          onAssigned={(ids) => {
            if (!ids.length) return;
            const lid = assignFor.locationId;
            setTextFor({ locationId: lid, ids });
            autoMobilize(ids, projectId, `Assigned to ${assignLoc?.name ?? "location"}`).then(invStatus).catch((e) => console.warn("auto-mobilize failed", e));
          }}
        />
      )}
      <SendSiteTextDialog open={!!textFor} onOpenChange={(o) => !o && setTextFor(null)} personnelIds={textFor?.ids ?? []} locationId={textFor?.locationId ?? ""} />
    </div>
  );
}
