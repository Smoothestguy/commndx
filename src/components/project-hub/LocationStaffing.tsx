import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListChecks, Loader2, Plus, Trash2, UserPlus, X } from "lucide-react";
import { ROLE_TAGS } from "@/lib/roleTags";
import { cn } from "@/lib/utils";
import {
  LocationStaffingSummary, useActivePersonnelLite, useAddLocationRequirement, useAssignPersonnel,
  useDeleteLocationRequirement, useLocationAssignments, useLocationRequirements, useUnassignPersonnel,
  useUpdateLocationRequirement,
} from "@/integrations/supabase/hooks/useLocationStaffing";

const CUSTOM = "__custom__";
const NONE = "__none__";

export function RolePicker({ value, onChange, options, allowNone }: { value: string; onChange: (v: string) => void; options: string[]; allowNone?: boolean }) {
  const isCustom = value !== "" && !options.includes(value);
  const [custom, setCustom] = useState(isCustom);
  if (custom) {
    return (
      <div className="flex gap-1 flex-1 min-w-0">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Custom role" className="h-9" autoFocus />
        <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => { setCustom(false); onChange(""); }} aria-label="Cancel custom"><X className="h-4 w-4" /></Button>
      </div>
    );
  }
  return (
    <Select value={value || (allowNone ? NONE : undefined)} onValueChange={(v) => {
      if (v === CUSTOM) { setCustom(true); onChange(""); } else onChange(v === NONE ? "" : v);
    }}>
      <SelectTrigger className="h-9 flex-1 min-w-0"><SelectValue placeholder="Select role" /></SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>No role</SelectItem>}
        {options.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
        <SelectItem value={CUSTOM}>Custom…</SelectItem>
      </SelectContent>
    </Select>
  );
}

function RequirementsDialog({ locationId, open, onOpenChange }: { locationId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: reqs = [], isLoading } = useLocationRequirements(open ? locationId : undefined);
  const add = useAddLocationRequirement();
  const upd = useUpdateLocationRequirement();
  const del = useDeleteLocationRequirement();
  const [role, setRole] = useState("");
  const [count, setCount] = useState(1);
  const [rate, setRate] = useState("");
  const options = [...ROLE_TAGS] as string[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Staffing requirements</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : reqs.length === 0 && <p className="text-sm text-muted-foreground">No requirements yet.</p>}
          {reqs.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm truncate">{r.role_label}</span>
              <Input type="number" min={0} defaultValue={r.headcount_needed} className="h-9 w-20"
                onBlur={(e) => {
                  const n = Math.max(0, parseInt(e.target.value) || 0);
                  if (n !== r.headcount_needed) upd.mutate({ id: r.id, location_id: locationId, headcount_needed: n });
                }} />
              <Input type="number" min={0} step="0.01" placeholder="$/hr" defaultValue={r.bill_rate ?? ""} className="h-9 w-24"
                onBlur={(e) => {
                  const v = e.target.value.trim() ? Number(e.target.value) : null;
                  if (v !== (r.bill_rate ?? null)) upd.mutate({ id: r.id, location_id: locationId, bill_rate: v });
                }} />
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => del.mutate({ id: r.id, location_id: locationId })} aria-label="Delete requirement">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2 border-t">
            <RolePicker value={role} onChange={setRole} options={options} />
            <Input type="number" min={1} value={count} onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))} className="h-9 w-20" />
            <Input type="number" min={0} step="0.01" placeholder="$/hr" value={rate} onChange={(e) => setRate(e.target.value)} className="h-9 w-24" />
            <Button size="sm" disabled={!role.trim() || add.isPending} onClick={() => {
              add.mutate({ location_id: locationId, role_label: role.trim(), headcount_needed: count, bill_rate: rate.trim() ? Number(rate) : null }, { onSuccess: () => { setRole(""); setCount(1); setRate(""); } });
            }}><Plus className="h-4 w-4 mr-1" />Add</Button>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ locationId, open, onOpenChange, assignedIds, roleOptions }: {
  locationId: string; open: boolean; onOpenChange: (o: boolean) => void; assignedIds: Set<string>; roleOptions: string[];
}) {
  const { data: people = [], isLoading } = useActivePersonnelLite(open);
  const assign = useAssignPersonnel();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [role, setRole] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    return people.filter((p) => {
      if (!s) return true;
      const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.toLowerCase();
      return name.includes(s) || (!!digits && (p.phone ?? "").replace(/\D/g, "").includes(digits));
    }).slice(0, 200);
  }, [people, q]);

  const toggle = (id: string) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const opts = roleOptions.length ? roleOptions : ([...ROLE_TAGS] as string[]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setSel(new Set()); setQ(""); setRole(""); } onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Assign personnel</DialogTitle></DialogHeader>
        <Input placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-[50vh] overflow-y-auto border rounded-md divide-y">
          {isLoading ? <div className="p-4"><Loader2 className="h-4 w-4 animate-spin" /></div> :
            filtered.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No matches.</p> :
            filtered.map((p) => {
              const already = assignedIds.has(p.id);
              return (
                <label key={p.id} className={cn("flex items-center gap-3 px-3 py-2 min-h-11 cursor-pointer", already && "opacity-60 cursor-not-allowed")}>
                  <Checkbox checked={already || sel.has(p.id)} disabled={already} onCheckedChange={() => toggle(p.id)} />
                  <span className="flex-1 min-w-0 text-sm truncate">{[p.first_name, p.last_name].filter(Boolean).join(" ")}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{already ? "Assigned" : p.phone}</span>
                </label>
              );
            })}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">Role</span>
          <RolePicker value={role} onChange={setRole} options={opts} allowNone />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={sel.size === 0 || assign.isPending} onClick={() => {
            assign.mutate({ location_id: locationId, personnel_ids: [...sel], role_label: role.trim() || null }, {
              onSuccess: () => { setSel(new Set()); onOpenChange(false); },
            });
          }}>
            {assign.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Assign {sel.size || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LocationStaffing({ locationId, summary, canWrite }: { locationId: string; summary?: LocationStaffingSummary; canWrite: boolean }) {
  const { data: assignments = [] } = useLocationAssignments(locationId);
  const unassign = useUnassignPersonnel();
  const [reqOpen, setReqOpen] = useState(false);
  const [asgOpen, setAsgOpen] = useState(false);
  const roles = Object.entries(summary?.byRole ?? {}).filter(([, v]) => v.needed > 0);
  const assignedIds = useMemo(() => new Set(assignments.map((a) => a.personnel_id)), [assignments]);
  const needed = summary?.needed ?? 0;
  const assigned = summary?.assigned ?? assignments.length;

  return (
    <div className="pt-2 border-t space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Staffed {assigned}/{needed}</span>
        {canWrite && (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setReqOpen(true)}><ListChecks className="h-4 w-4 mr-1" />Requirements</Button>
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setAsgOpen(true)}><UserPlus className="h-4 w-4 mr-1" />Assign</Button>
          </div>
        )}
      </div>
      {roles.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {roles.map(([role, v]) => (
            <Badge key={role} variant="outline" className={cn(
              v.assigned >= v.needed ? "border-success/40 bg-success/15 text-success" : "border-warning/40 bg-warning/15 text-warning",
            )}>{role} {v.assigned}/{v.needed}{v.rate != null && ` · $${Number(v.rate).toLocaleString(undefined, { maximumFractionDigits: 2 })}/hr`}</Badge>
          ))}
        </div>
      )}
      {assignments.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {assignments.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1 rounded-md border bg-muted/40 pl-2 pr-1 py-0.5 text-xs">
              <span className="font-medium">{[a.personnel?.first_name, a.personnel?.last_name].filter(Boolean).join(" ") || "Unknown"}</span>
              {a.role_label && <span className="text-muted-foreground">· {a.role_label}</span>}
              {canWrite && (
                <button type="button" className="ml-0.5 rounded p-1 hover:bg-muted" aria-label="Unassign"
                  onClick={() => unassign.mutate({ id: a.id, location_id: locationId })}><X className="h-3 w-3" /></button>
              )}
            </span>
          ))}
        </div>
      )}
      {canWrite && <RequirementsDialog locationId={locationId} open={reqOpen} onOpenChange={setReqOpen} />}
      {canWrite && (
        <AssignDialog locationId={locationId} open={asgOpen} onOpenChange={setAsgOpen} assignedIds={assignedIds}
          roleOptions={Object.keys(summary?.byRole ?? {})} />
      )}
    </div>
  );
}
