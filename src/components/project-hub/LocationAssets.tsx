import { AssetResponsiblePicker } from './AssetResponsiblePicker';
import { AssetOwnershipFields, emptyOwnership } from './AssetOwnershipFields';
import { assetCareLabel, ownershipText } from '@/lib/assetDetails';
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Pencil, Key, MapPin, Package, Plus, Settings, Square, Truck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAssets, useCreateAsset } from "@/integrations/supabase/hooks/useAssets";
import {
  AssetBillingRow, useAssignAssetToLocation, useEndAssetAssignment, useProjectAssetBilling, useUnassignAsset,
} from "@/integrations/supabase/hooks/useAssetAssignments";
import { fmtMoney0 } from "@/lib/assetBilling";
import { EditAssetDialog, type EditableAsset } from "./EditAssetDialog";

export function AssetIcon({ type, className = "h-3.5 w-3.5" }: { type?: string | null; className?: string }) {
  const I = type === "vehicle" ? Truck : type === "equipment" ? Settings : type === "key" ? Key : type === "location" ? MapPin : Package;
  return <I className={className} />;
}

/** "$450/day · 12d · $5,400" | "no rate · 12d" | "" (not billable) */
export function assetBillingText(r: AssetBillingRow) {
  if (!r.billable) return "";
  if (r.rate == null) return `no rate · ${r.days}d`;
  return `Bill rate ${fmtMoney0(r.rate)}/day · ${r.days}d · ${fmtMoney0(r.accrued ?? 0)}`;
}

/** Assets currently placed at a location (not returned). */
export const assetsAtLocation = (rows: AssetBillingRow[], locationId: string) =>
  rows.filter((r) => r.status === "active" && r.location_id === locationId);

export function AssignLocationAssetDialog({ open, onOpenChange, projectId, locationId, locationName, rows, locationNames }: {
  open: boolean; onOpenChange: (o: boolean) => void; projectId: string; locationId: string; locationName?: string;
  rows: AssetBillingRow[]; locationNames?: Record<string, string>;
}) {
  const { isAdmin, isManager } = useUserRole();
  const canBill = isAdmin || isManager;
  const { data: allAssets = [] } = useAssets();
  const create = useCreateAsset();
  const assign = useAssignAssetToLocation();
  // Open placements anywhere (any project) so assets in use can still be moved here.
  const placements = useQuery({
    queryKey: ["asset-assignments", "open-placements"], enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("asset_assignments")
        .select("asset_id, location_id, project_id, end_at, project_locations(name), projects(name)")
        .eq("status", "active").is("unassigned_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });
  const projectRows = rows.filter((r) => r.status === "active");
  const projectAssetIds = new Set(projectRows.map((r) => r.asset_id));
  const hereIds = new Set(rows.filter((r) => r.status === "active" && !r.end_at && r.location_id === locationId).map((r) => r.asset_id));
  const registry = allAssets.filter((a) => a.status !== "retired" && !projectAssetIds.has(a.id) && !hereIds.has(a.id));
  const elsewhere = (assetId: string) => {
    const p = (placements.data ?? []).find((x) => x.asset_id === assetId && !x.end_at) as
      | { project_locations?: { name?: string } | null; projects?: { name?: string } | null } | undefined;
    return p ? (p.project_locations?.name ?? p.projects?.name ?? "another project") : null;
  };
  const [responsible, setResponsible] = useState<string | null>(null);
  const [ownership, setOwnership] = useState(emptyOwnership);
  const [careEdit, setCareEdit] = useState(false);
  const [creating, setCreating] = useState(false);
  const [nw, setNw] = useState({ label: "", type: "vehicle", serial: "" });
  const [pick, setPick] = useState("");
  const [billable, setBillable] = useState(false);
  const [rate, setRate] = useState("");
  const [start, setStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) { setLastOpen(open); if (open) { setResponsible(null); setOwnership(emptyOwnership); setCareEdit(false); setCreating(false); setNw({ label: "", type: "vehicle", serial: "" }); setPick(""); setBillable(false); setRate(""); setStart(format(new Date(), "yyyy-MM-dd")); } }

  const onPick = (v: string) => {
    setPick(v);
    const selected = rows.find(r => r.id === v.slice(2));
    setCareEdit(!!selected && selected.location_id === locationId && !selected.end_at);
    setResponsible(selected?.location_id === locationId ? selected.assigned_to_personnel_id : null);
    if (v.startsWith("a:")) {
      const r = projectRows.find((x) => x.id === v.slice(2));
      setBillable(!!r?.billable);
      const d = r?.day_rate ?? r?.assets?.default_day_rate;
      setRate(d != null ? String(d) : "");
    } else {
      const a = registry.find((x) => x.id === v.slice(2));
      setRate(a?.default_day_rate != null ? String(a.default_day_rate) : "");
    }
  };
  const isExisting = pick.startsWith("a:");
  const createAsset = () => {
    if (!nw.label.trim()) return;
    create.mutate({ label: nw.label.trim(), type: nw.type, serial_number: nw.serial.trim() || undefined, ownership: ownership.ownership, vendor_id: ownership.vendor || null, status: "available" }, {
      onSuccess: (a) => { setCreating(false); setPick(`r:${a.id}`); setRate(""); },
    });
  };
  const submit = () => {
    const n = rate.trim() === "" ? null : Number(rate);
    assign.mutate({
      projectId, locationId, personnelId: responsible,
      assignmentId: isExisting ? pick.slice(2) : undefined,
      assetId: !isExisting ? pick.slice(2) : undefined,
      ...(canBill ? { billable, dayRate: n != null && Number.isFinite(n) ? n : null } : {}),
      startAt: careEdit ? undefined : new Date(`${start}T08:00:00`).toISOString(),
    }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Assign asset{locationName ? ` to ${locationName}` : ""}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Asset</Label>
            <Select value={pick} onValueChange={onPick}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Pick a truck or equipment" /></SelectTrigger>
              <SelectContent>
                {projectRows.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>On this project</SelectLabel>
                    {projectRows.map((r) => (
                      <SelectItem key={r.id} value={`a:${r.id}`}>
                        {r.assets?.label ?? "Asset"}{r.location_id ? ` — at ${locationNames?.[r.location_id] ?? "another location"}` : " — project-wide"}{r.end_at ? " (ended)" : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {registry.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>From registry (adds to project)</SelectLabel>
                    {registry.map((a) => { const w = elsewhere(a.id); return <SelectItem key={a.id} value={`r:${a.id}`}>{a.label} · {a.type}{w ? ` — in use at ${w} (will move)` : ""}</SelectItem>; })}
                  </SelectGroup>
                )}
                {projectRows.length === 0 && registry.length === 0 && <div className="p-2 text-sm text-muted-foreground">No assets available.</div>}
              </SelectContent>
            </Select>
          </div>
          {creating ? (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-1.5"><Label htmlFor="na-label">New asset name</Label><Input id="na-label" className="h-11" value={nw.label} onChange={(e) => setNw({ ...nw, label: e.target.value })} placeholder="e.g. 2024 F-250 #12" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5"><Label>Type</Label>
                  <Select value={nw.type} onValueChange={(v) => setNw({ ...nw, type: v })}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>{["vehicle", "equipment", "tool", "key", "other"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label htmlFor="na-serial">Plate / serial</Label><Input id="na-serial" className="h-11" value={nw.serial} onChange={(e) => setNw({ ...nw, serial: e.target.value })} /></div>
              </div>
              <AssetOwnershipFields value={ownership} onChange={setOwnership} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancel</Button>
                <Button size="sm" disabled={!nw.label.trim() || (ownership.ownership === "rented" && !ownership.vendor) || create.isPending} onClick={createAsset}>Create asset</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setCreating(true)}><Plus className="h-3 w-3 mr-1" />Create new asset</Button>
          )}
          {pick && <div className="space-y-1.5"><Label>Responsible person (optional)</Label><AssetResponsiblePicker locationId={locationId} value={responsible} onChange={setResponsible} /></div>}
          {pick && !careEdit && (
            <div className="space-y-1.5"><Label>{isExisting ? "Move effective" : "Start date"}</Label><Input type="date" className="h-11" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          )}
          {pick && canBill && (
            <>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div><Label>Bill customer per day</Label><p className="text-xs text-muted-foreground">Per-diem charge while it's assigned</p></div>
                <Switch checked={billable} onCheckedChange={setBillable} />
              </div>
              {billable && (
                <div className="space-y-1.5"><Label>Bill rate ($/day)</Label>
                  <Input type="number" inputMode="decimal" min={0} step="0.01" className="h-11" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="No rate set" />
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!pick || assign.isPending} onClick={submit}>{careEdit ? "Save responsibility" : isExisting || (pick && elsewhere(pick.slice(2))) ? "Move here" : "Assign"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Small "Assets" block for a location card. */
export function LocationAssets({ projectId, locationId, locationName, canWrite, locationNames }: {
  projectId: string; locationId: string; locationName?: string; canWrite: boolean; locationNames?: Record<string, string>;
}) {
  const { isAdmin, isManager } = useUserRole();
  const canBill = isAdmin || isManager;
  const { rows } = useProjectAssetBilling(projectId);
  const here = useMemo(() => assetsAtLocation(rows, locationId), [rows, locationId]);
  const end = useEndAssetAssignment();
  const unassign = useUnassignAsset();
  const [open, setOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<EditableAsset | null>(null);

  return (
    <div className="space-y-1.5">
      {canBill && <EditAssetDialog asset={editAsset} open={!!editAsset} onOpenChange={(o) => !o && setEditAsset(null)} />}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Assets{here.length ? ` (${here.length})` : ""}</span>
        {canWrite && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setOpen(true)}><Plus className="h-3 w-3 mr-1" />Assign asset</Button>}
      </div>
      {here.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {here.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1 rounded-md border bg-muted/40 pl-2 pr-1 py-0.5 text-xs">
              <AssetIcon type={r.assets?.type} />
              <span className="font-medium">{assetCareLabel(r.assets?.label ?? "Asset", r.personnel)}</span><Badge variant="outline">{ownershipText(r.assets)}</Badge>
              {canBill && r.billable && (
                <Badge variant="outline" className={r.rate == null ? "text-[10px] px-1.5 py-0 border-warning/50 text-warning" : "text-[10px] px-1.5 py-0 border-success/50 text-success"}>
                  {assetBillingText(r)}
                </Badge>
              )}
              {r.end_at && <span className="text-muted-foreground">ended {format(new Date(r.end_at), "M/d")}</span>}
              {canBill && r.assets && (
                <Tooltip><TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" type="button" className="h-7 w-7" aria-label="Edit asset" onClick={() => setEditAsset(r.assets as EditableAsset)}><Pencil className="h-3 w-3" /></Button>
                </TooltipTrigger><TooltipContent>Edit asset (registry)</TooltipContent></Tooltip>
              )}
              {canWrite && !r.end_at && (
                <Tooltip><TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" type="button" className="h-7 w-7" aria-label="End assignment" onClick={() => end.mutate(r.id)}><Square className="h-3 w-3" /></Button>
                </TooltipTrigger><TooltipContent>End (stop day-rate clock)</TooltipContent></Tooltip>
              )}
              {canWrite && (
                <Tooltip><TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" type="button" className="h-7 w-7" aria-label="Unassign asset" onClick={() => unassign.mutate(r.id)}><X className="h-3 w-3" /></Button>
                </TooltipTrigger><TooltipContent>Return to registry</TooltipContent></Tooltip>
              )}
            </span>
          ))}
        </div>
      )}
      {canWrite && (
        <AssignLocationAssetDialog open={open} onOpenChange={setOpen} projectId={projectId} locationId={locationId}
          locationName={locationName} rows={rows} locationNames={locationNames} />
      )}
    </div>
  );
}
