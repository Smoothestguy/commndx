import { useProjectAgencies } from "@/hooks/useProjectAgencies";
import { AgencyChip } from "@/components/personnel/AgencyChip";
import { LocationKioskActions } from '@/components/signin/LocationKioskActions';
import { RoleSelect } from "./RoleSelect";
import { useUpdateAssignmentRole } from "@/integrations/supabase/hooks/useLocationStaffing";
import { Fragment, useEffect, useMemo, useState } from "react";
import { endOfWeek, format, startOfWeek } from "date-fns";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, ExternalLink, MessageSquare, Phone, Search, UserPlus, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { STATUS_LABEL } from "@/components/personnel/lifecycle/PersonnelStatusButton";
import { exportRosterCsv, exportRosterXlsx, rosterFileBase, type RosterExportRow } from "@/utils/rosterExport";
import { toast } from "sonner";
import type { LifecycleStatus } from "@/integrations/supabase/hooks/usePersonnelStatus";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAllCurrentStatuses, useOnSiteMap } from "@/integrations/supabase/hooks/usePersonnelStatus";
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
import { AssetIcon, AssignLocationAssetDialog, assetsAtLocation } from "./LocationAssets";
import { useEndAssetAssignment, useProjectAssetBilling, useUnassignAsset } from "@/integrations/supabase/hooks/useAssetAssignments";
import { fmtMoney0 } from "@/lib/assetBilling";
import { Package, Square } from "lucide-react";

type SortKey = "name" | "role" | "status" | "texted" | "hrs";
// Higher = further along the lifecycle; on site ranks above everything.
const STATUS_RANK: Record<string, number> = { onsite: 7, activated: 6, mobilizing: 5, standby: 4, available: 3, unavailable: 2, demobilized: 1 };

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={label} onClick={onClick}>{children}</button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const fmtRate = (r: number | null) => (r != null ? ` · $${Number(r).toLocaleString(undefined, { maximumFractionDigits: 2 })}/hr` : "");

export function LocationsGrid({ projectId, projectName, locations, staffing, lastServiced, deploymentMode, canWrite, onOpenCard }: {
  projectId: string;
  projectName?: string;
  locations: ProjectLocation[];
  staffing?: Record<string, LocationStaffingSummary>;
  lastServiced?: Record<string, string>;
  deploymentMode: boolean;
  canWrite: boolean;
  onOpenCard: (locationId: string) => void;
}) {
  const { agencyName } = useProjectAgencies(projectId);
  const locIds = useMemo(() => locations.map((l) => l.id), [locations]);
  const { data: assignments = [] } = useLocationsAssignments(locIds);
  const { data: texted = {} } = useLastSiteTexts(locIds);
  const now = new Date();
  const wkFrom = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const wkTo = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const { data: hours = {} } = useTrailHoursByPersonLocation(projectId, wkFrom, wkTo);
  const unassign = useUnassignPersonnel();
  const setRole = useUpdateAssignmentRole();
  const roleEdit = (a: (typeof assignments)[number], locId: string, cls?: string) => (
    <RoleSelect value={a.role_label} canEdit={canWrite} priorityRoles={Object.keys(staffing?.[locId]?.byRole ?? {})} className={cls}
      onChange={(role_label) => setRole.mutate({ id: a.id, location_id: locId, role_label })} />
  );
  const { data: statusMap = {} } = useAllCurrentStatuses();
  const { data: onSite = {} } = useOnSiteMap();
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "status", dir: "desc" });
  const clickSort = (key: SortKey) => setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "role" ? "asc" : "desc" });
  const pidKey = useMemo(() => [...new Set(assignments.map((a) => a.personnel_id))].sort(), [assignments]);
  // Phones: one batched read, managers/admins only (RLS restricts personnel anyway).
  const { data: phones = {} } = useQuery({
    queryKey: ["locations-grid-phones", pidKey],
    enabled: canWrite && pidKey.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("personnel").select("id, phone").in("id", pidKey);
      if (error) throw error;
      const m: Record<string, string> = {};
      for (const r of data ?? []) if (r.phone) m[r.id] = r.phone;
      return m;
    },
  });
  const showPhone = canWrite && Object.keys(phones).length > 0;
  const cols = showPhone ? 7 : 6;
  const { rows: assetRows } = useProjectAssetBilling(projectId);
  const endAsset = useEndAssetAssignment();
  const unassignAsset = useUnassignAsset();
  const [assetFor, setAssetFor] = useState<string | null>(null);
  const locationNames = useMemo(() => Object.fromEntries(locations.map((l) => [l.id, l.name])), [locations]);
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

  const rankOf = (a: (typeof assignments)[number], locId: string) => {
    const os = onSite[a.personnel_id];
    if (os && os.project_id === projectId) return STATUS_RANK.onsite + (os.location_id === locId ? 0.5 : 0);
    return STATUS_RANK[statusMap[a.personnel_id]?.status ?? "available"] ?? 0;
  };
  const sortRows = (rows: typeof assignments, locId: string) => {
    const m = sort.dir === "asc" ? 1 : -1;
    const val = (a: (typeof assignments)[number]): string | number => {
      const k = `${a.personnel_id}:${locId}`;
      switch (sort.key) {
        case "name": return nameOf(a).toLowerCase();
        case "role": return (a.role_label ?? "").toLowerCase();
        case "status": return rankOf(a, locId);
        case "texted": return texted[k] ? new Date(texted[k]).getTime() : 0;
        case "hrs": return hours[k] ?? 0;
      }
    };
    return [...rows].sort((x, y) => {
      const a = val(x), b = val(y);
      const c = a < b ? -1 : a > b ? 1 : 0;
      return c * m || nameOf(x).localeCompare(nameOf(y));
    });
  };
  const SortTh = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => {
    const active = sort.key === k;
    const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th className={cn("px-2 py-1.5 font-medium", className)} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => clickSort(k)} className={cn("inline-flex items-center gap-1 hover:text-foreground", className?.includes("text-right") && "w-full justify-end", active && "text-foreground")}>
          {label}<Icon className={cn("h-3 w-3", !active && "opacity-40")} />
        </button>
      </th>
    );
  };

  // Status text mirrors the grid badge: ON SITE (with site when different) else lifecycle label.
  const statusText = (a: (typeof assignments)[number], locId: string) => {
    const os = onSite[a.personnel_id];
    if (os) return os.location_id === locId ? "ON SITE" : `ON SITE · ${os.location_name ?? "site"}`;
    const st = (statusMap[a.personnel_id]?.status ?? "available") as LifecycleStatus;
    return STATUS_LABEL[st] ?? st;
  };
  const doExport = async (kind: "xlsx" | "csv") => {
    const out: RosterExportRow[] = [];
    for (const l of locations) {
      const rows = sortRows((byLoc[l.id] ?? []).filter((a) => !search || nameOf(a).toLowerCase().includes(search) || (a.role_label ?? "").toLowerCase().includes(search)), l.id);
      for (const a of rows) {
        const k = `${a.personnel_id}:${l.id}`;
        out.push({
          location: l.name, projectNumber: l.project_number ?? "", name: nameOf(a).trim(), role: a.role_label ?? "",
          status: statusText(a, l.id), phone: phones[a.personnel_id] ?? "",
          texted: texted[k] ? format(new Date(texted[k]), "M/d/yyyy") : "", hours: hours[k] ?? 0,
        });
      }
    }
    if (!out.length) { toast.info("No people to export"); return; }
    const base = rosterFileBase(projectName ?? "project", format(new Date(), "yyyy-MM-dd"));
    try {
      if (kind === "csv") exportRosterCsv(out, canWrite, base);
      else await exportRosterXlsx(out, canWrite, base);
    } catch (e) { console.error(e); toast.error("Export failed"); }
  };

  const assignLoc = assignFor ? locations.find((l) => l.id === assignFor.locationId) : undefined;
  const assignedIdsFor = useMemo(() => new Set((assignFor ? byLoc[assignFor.locationId] ?? [] : []).map((a) => a.personnel_id)), [assignFor, byLoc]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative basis-full sm:basis-auto flex-1 min-w-[12rem] sm:max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="h-8 pl-7 text-xs" />
        </div>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setCollapsed(new Set())}>Expand all</Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setCollapsed(new Set(locIds))}>Collapse all</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 text-xs"><Download className="h-3.5 w-3.5 mr-1" />Export</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => doExport("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => doExport("csv")}>CSV</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Phones: stacked list, no horizontal scroll */}
      <div className="sm:hidden border rounded-md divide-y">
        {locations.map((l) => {
          const s = staffing?.[l.id];
          const allRows = byLoc[l.id] ?? [];
          const locHrs = allRows.reduce((t, a) => t + (hours[`${a.personnel_id}:${l.id}`] ?? 0), 0);
          const rows = sortRows(allRows.filter((a) => !search || nameOf(a).toLowerCase().includes(search) || (a.role_label ?? "").toLowerCase().includes(search)), l.id);
          if (search && rows.length === 0) return null;
          const isOpen = search ? true : !collapsed.has(l.id);
          const open = Object.entries(s?.byRole ?? {}).filter(([, v]) => v.needed > v.assigned);
          const locAssets = assetsAtLocation(assetRows, l.id);
          const full = (s?.needed ?? 0) > 0 && (s?.assigned ?? 0) >= (s?.needed ?? 0);
          const meta = [
            l.lat != null && l.lng != null && "📍 geofenced",
            l.project_number && `#${l.project_number}`,
            locAssets.length > 0 && `${locAssets.length} asset${locAssets.length === 1 ? "" : "s"}`,
            l.housing_provided_by === "customer" && "Housing: Cust",
            l.housing_provided_by === "frg" && "Housing: FRG",
            l.mobe_date && !l.demobe_date && `Mobe ${formatLocalDate(l.mobe_date, "M/d")}`,
            l.demobe_date && `${l.mobe_date ? `${formatLocalDate(l.mobe_date, "M/d")}–` : "Demobe "}${formatLocalDate(l.demobe_date, "M/d")}`,
            deploymentMode && lastServiced?.[l.id] && `Svc ${formatLocalDate(lastServiced[l.id], "M/d")}`,
            locHrs > 0 && `${locHrs.toFixed(1)} h this wk`,
          ].filter(Boolean) as string[];
          return (
            <div key={l.id} className="text-xs">
              <div className="bg-muted/40 px-2 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <button type="button" onClick={() => toggle(l.id)} className="flex items-center gap-1 font-semibold min-w-0 flex-1 text-left" aria-expanded={isOpen}>
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{l.name}</span>{l.lat != null && l.lng != null && <Badge variant="outline">📍 geofenced</Badge>}
                  </button>
                  <span className={cn("font-medium shrink-0 tabular-nums", full ? "text-success" : "text-warning")}>{s?.assigned ?? 0}/{s?.needed ?? 0}</span>
                  <span className="flex items-center shrink-0">
                    {canWrite && <IconBtn label="Assign people" onClick={() => setAssignFor({ locationId: l.id })}><UserPlus className="h-4 w-4" /></IconBtn>}
                    {canWrite && <IconBtn label="Assign asset" onClick={() => setAssetFor(l.id)}><Package className="h-4 w-4" /></IconBtn>}
                    <IconBtn label="Open location card" onClick={() => onOpenCard(l.id)}><ExternalLink className="h-4 w-4" /></IconBtn>
                  </span>
                </div>
                {isOpen && meta.length > 0 && <div className="pl-5 mt-0.5 text-[11px] text-muted-foreground">{meta.join(" · ")}</div>}
                {canWrite && isOpen && <LocationKioskActions location={l} />}
              </div>
              {isOpen && rows.map((a) => {
                const k = `${a.personnel_id}:${l.id}`;
                const h = hours[k];
                const line2 = [texted[k] && `texted ${format(new Date(texted[k]), "M/d")}`, h ? `${h.toFixed(1)} h` : null].filter(Boolean).join(" · ");
                return (
                  <div key={a.id} className="border-t px-2 py-1.5 pl-6">
                    <div className="flex items-center gap-2 min-w-0">
                      <Link to={`/personnel/${a.personnel_id}`} className="font-medium truncate flex-1 min-w-0 hover:underline">{nameOf(a)} <AgencyChip name={agencyName(a.personnel_id)} /></Link>
                      <PersonnelStatusButton personnelId={a.personnel_id} projectId={projectId} locationId={l.id} hideProjectName className="text-[10px] px-1.5 py-0 max-w-[9rem] shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex-1 min-w-0 flex items-center gap-1 text-muted-foreground tabular-nums">
                        {(canWrite || a.role_label) && <span className="min-w-0 max-w-[60%] shrink-0 flex">{roleEdit(a, l.id)}</span>}
                        {line2 && <span className="truncate">{(canWrite || a.role_label) ? "· " : ""}{line2}</span>}
                        {!line2 && !canWrite && !a.role_label && "\u00a0"}
                      </span>
                      <span className="flex items-center shrink-0">
                        <IconBtn label="Send site text" onClick={() => setTextFor({ locationId: l.id, ids: [a.personnel_id] })}><MessageSquare className="h-4 w-4" /></IconBtn>
                        {showPhone && phones[a.personnel_id] && (
                          <a href={`tel:${phones[a.personnel_id]}`} className="inline-flex rounded p-1 text-muted-foreground hover:bg-muted" aria-label={`Call ${nameOf(a)}`}><Phone className="h-4 w-4" /></a>
                        )}
                        {canWrite && <IconBtn label="Unassign" onClick={() => unassign.mutate({ id: a.id, location_id: l.id })}><X className="h-4 w-4" /></IconBtn>}
                      </span>
                    </div>
                  </div>
                );
              })}
              {isOpen && !search && locAssets.map((r) => (
                <div key={`asset-${r.id}`} className="border-t px-2 py-1.5 pl-6 flex items-center gap-2 min-w-0">
                  <AssetIcon type={r.assets?.type} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate flex-1 min-w-0">{r.assets?.label ?? "Asset"} <span className="text-muted-foreground">· {r.days}d{canWrite && r.billable ? (r.rate == null ? " · no rate" : ` · ${fmtMoney0(r.rate)}/day`) : ""}</span></span>
                  {canWrite && !r.end_at && <IconBtn label="End (stop day-rate clock)" onClick={() => endAsset.mutate(r.id)}><Square className="h-4 w-4" /></IconBtn>}
                  {canWrite && <IconBtn label="Unassign asset" onClick={() => unassignAsset.mutate(r.id)}><X className="h-4 w-4" /></IconBtn>}
                </div>
              ))}
              {isOpen && !search && open.map(([role, v]) => (
                <div key={`open-${role}`} className="border-t px-2 py-1.5 pl-6 flex items-center gap-2 text-muted-foreground">
                  <span className="italic truncate flex-1 min-w-0">{role} — {v.needed - v.assigned} open{canWrite && fmtRate(v.rate)}</span>
                  {canWrite && <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setAssignFor({ locationId: l.id, role })}>Assign</Button>}
                </div>
              ))}
              {isOpen && !search && rows.length === 0 && open.length === 0 && locAssets.length === 0 && (
                <div className="border-t px-2 py-1.5 pl-6 text-muted-foreground">No one assigned.</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="hidden sm:block border rounded-md overflow-auto max-h-[75vh]">
        <table className="w-full table-fixed text-xs tabular-nums min-w-[600px]">
          <colgroup>
            <col />
            <col className="w-28" />
            <col className="w-36" />
            <col className="w-14" />
            <col className="w-14" />
            {showPhone && <col className="w-8" />}
            <col className={canWrite ? "w-[4.5rem]" : "w-9"} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-muted text-muted-foreground">
            <tr className="text-left">
              <SortTh k="name" label="Name" className="pl-7" />
              <SortTh k="role" label="Role" />
              <SortTh k="status" label="Status" />
              <SortTh k="texted" label="Texted" />
              <SortTh k="hrs" label="Hrs" className="text-right" />
              {showPhone && <th className="px-1 py-1.5"><span className="sr-only">Phone</span></th>}
              <th className="px-2 py-1.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {locations.map((l) => {
              const s = staffing?.[l.id];
              const allRows = byLoc[l.id] ?? [];
              const locHrs = allRows.reduce((t, a) => t + (hours[`${a.personnel_id}:${l.id}`] ?? 0), 0);
              const rows = sortRows(allRows.filter((a) => !search || nameOf(a).toLowerCase().includes(search) || (a.role_label ?? "").toLowerCase().includes(search)), l.id);
              if (search && rows.length === 0) return null;
              const isOpen = search ? true : !collapsed.has(l.id);
              const open = Object.entries(s?.byRole ?? {}).filter(([, v]) => v.needed > v.assigned);
              const locAssets = assetsAtLocation(assetRows, l.id);
              const full = (s?.needed ?? 0) > 0 && (s?.assigned ?? 0) >= (s?.needed ?? 0);
              return (
                <Fragment key={l.id}>
                  <tr className="border-t bg-muted/40 hover:bg-muted/60">
                    <td colSpan={cols} className="px-2 py-1">
                      <div className="flex items-center gap-2 whitespace-nowrap min-w-0">
                        <button type="button" onClick={() => toggle(l.id)} className="flex items-center gap-1 font-semibold min-w-0 flex-1 sm:flex-initial text-left" aria-expanded={isOpen} title={l.name}>
                          {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                          <span className="truncate">{l.name}</span>{l.lat != null && l.lng != null && <Badge variant="outline">📍 geofenced</Badge>}
                        </button>
                        {l.project_number && <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">#{l.project_number}</Badge>}
                        <span className={cn("font-medium shrink-0", full ? "text-success" : "text-warning")}>{s?.assigned ?? 0}/{s?.needed ?? 0}</span>
                        {locAssets.length > 0 && <span className="text-muted-foreground shrink-0">· {locAssets.length} asset{locAssets.length === 1 ? "" : "s"}</span>}
                        {l.housing_provided_by === "customer" && <Badge variant="outline" className="hidden md:inline-flex text-[10px] px-1.5 py-0 shrink-0">Housing: Cust</Badge>}
                        {l.housing_provided_by === "frg" && <Badge variant="outline" className="hidden md:inline-flex text-[10px] px-1.5 py-0 shrink-0">Housing: FRG</Badge>}
                        {l.mobe_date && !l.demobe_date && <span className="text-muted-foreground shrink-0">Mobe {formatLocalDate(l.mobe_date, "M/d")}</span>}
                        {l.demobe_date && <span className="text-muted-foreground shrink-0">{l.mobe_date ? `${formatLocalDate(l.mobe_date, "M/d")}–` : "Demobe "}{formatLocalDate(l.demobe_date, "M/d")}</span>}
                        {deploymentMode && lastServiced?.[l.id] && <span className="hidden md:inline text-muted-foreground shrink-0">Svc {formatLocalDate(lastServiced[l.id], "M/d")}</span>}
                        <span className="ml-auto flex items-center gap-0.5 shrink-0">
                          {locHrs > 0 && <span className="mr-1 text-muted-foreground" title="Total hours this week">{locHrs.toFixed(1)} h</span>}
                          {canWrite && <IconBtn label="Assign people" onClick={() => setAssignFor({ locationId: l.id })}><UserPlus className="h-3.5 w-3.5" /></IconBtn>}
                          {canWrite && <IconBtn label="Assign asset" onClick={() => setAssetFor(l.id)}><Package className="h-3.5 w-3.5" /></IconBtn>}
                          <IconBtn label="Open location card" onClick={() => onOpenCard(l.id)}><ExternalLink className="h-3.5 w-3.5" /></IconBtn>
                        </span>
                      </div>
                    </td>
                  </tr>
                  {canWrite && isOpen && <tr><td colSpan={cols} className="px-2 py-1"><LocationKioskActions location={l} /></td></tr>}
                  {isOpen && rows.map((a) => {
                    const k = `${a.personnel_id}:${l.id}`;
                    const h = hours[k];
                    return (
                      <tr key={a.id} className="border-t hover:bg-muted/30">
                        <td className="px-2 py-1 pl-7 font-medium truncate">
                          <Link to={`/personnel/${a.personnel_id}`} className="hover:underline underline-offset-2" title={nameOf(a)}>{nameOf(a)}</Link> <AgencyChip name={agencyName(a.personnel_id)} />
                        </td>
                        <td className="px-1 py-0.5 text-muted-foreground truncate" title={a.role_label ?? undefined}>{roleEdit(a, l.id, "max-w-full")}</td>
                        <td className="px-2 py-1 overflow-hidden">
                          <PersonnelStatusButton personnelId={a.personnel_id} projectId={projectId} locationId={l.id} hideProjectName className="text-[10px] px-1.5 py-0 max-w-[7.5rem]" />
                        </td>
                        <td className="px-2 py-1 text-muted-foreground">{texted[k] ? format(new Date(texted[k]), "M/d") : ""}</td>
                        <td className="px-2 py-1 text-right">{h ? h.toFixed(1) : ""}</td>
                        {showPhone && (
                          <td className="px-1 py-1 text-center">
                            {phones[a.personnel_id] && (
                              <a href={`tel:${phones[a.personnel_id]}`} className="inline-flex rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Call ${nameOf(a)}`} title={phones[a.personnel_id]}>
                                <Phone className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </td>
                        )}
                        <td className="px-1 py-1 text-right whitespace-nowrap">
                          <IconBtn label="Send site text" onClick={() => setTextFor({ locationId: l.id, ids: [a.personnel_id] })}><MessageSquare className="h-3.5 w-3.5" /></IconBtn>
                          {canWrite && <IconBtn label="Unassign" onClick={() => unassign.mutate({ id: a.id, location_id: l.id })}><X className="h-3.5 w-3.5" /></IconBtn>}
                        </td>
                      </tr>
                    );
                  })}
                  {isOpen && !search && locAssets.map((r) => (
                    <tr key={`asset-${r.id}`} className="border-t hover:bg-muted/30">
                      <td className="px-2 py-1 pl-7 truncate" title={r.assets?.label ?? undefined}>
                        <span className="inline-flex items-center gap-1.5 min-w-0"><AssetIcon type={r.assets?.type} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{r.assets?.label ?? "Asset"}</span></span>
                      </td>
                      <td className="px-2 py-1 text-muted-foreground capitalize truncate">{r.assets?.type ?? ""}</td>
                      <td className="px-2 py-1 truncate">
                        {canWrite && (r.billable
                          ? <span className={r.rate == null ? "text-warning" : "text-success"}>{r.rate == null ? "billable · no rate" : `billable ${fmtMoney0(r.rate)}/day`}</span>
                          : <span className="text-muted-foreground">— not billed</span>)}
                        {r.end_at && <span className="ml-1 text-muted-foreground">ended {format(new Date(r.end_at), "M/d")}</span>}
                      </td>
                      <td className="px-2 py-1 text-muted-foreground">{r.days}d</td>
                      <td className="px-2 py-1 text-right">{canWrite && r.billable && r.accrued != null ? fmtMoney0(r.accrued) : ""}</td>
                      {showPhone && <td />}
                      <td className="px-1 py-1 text-right whitespace-nowrap">
                        {canWrite && !r.end_at && <IconBtn label="End (stop day-rate clock)" onClick={() => endAsset.mutate(r.id)}><Square className="h-3.5 w-3.5" /></IconBtn>}
                        {canWrite && <IconBtn label="Unassign asset" onClick={() => unassignAsset.mutate(r.id)}><X className="h-3.5 w-3.5" /></IconBtn>}
                      </td>
                    </tr>
                  ))}
                  {isOpen && !search && open.map(([role, v]) => (
                    <tr key={`open-${role}`} className="border-t text-muted-foreground">
                      <td colSpan={cols - 1} className="px-2 py-1 pl-7 italic">{role} — {v.needed - v.assigned} open{canWrite && fmtRate(v.rate)}</td>
                      <td className="px-1 py-1 text-right">
                        {canWrite && (
                          <Button size="sm" variant="outline" className="h-6 px-1.5 text-[11px]" onClick={() => setAssignFor({ locationId: l.id, role })}>Assign</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {isOpen && !search && rows.length === 0 && open.length === 0 && locAssets.length === 0 && (
                    <tr className="border-t"><td colSpan={cols} className="px-2 py-1 pl-7 text-muted-foreground">No one assigned.</td></tr>
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
      {canWrite && assetFor && (
        <AssignLocationAssetDialog open={!!assetFor} onOpenChange={(o) => !o && setAssetFor(null)} projectId={projectId}
          locationId={assetFor} locationName={locationNames[assetFor]} rows={assetRows} locationNames={locationNames} />
      )}
      <SendSiteTextDialog open={!!textFor} onOpenChange={(o) => !o && setTextFor(null)} personnelIds={textFor?.ids ?? []} locationId={textFor?.locationId ?? ""} />
    </div>
  );
}
