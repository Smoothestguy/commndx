import { useProjectAgencies } from '@/hooks/useProjectAgencies';
import { personnelAmount } from '@/lib/personnelBilling';
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDeploymentHours } from '@/hooks/useDeploymentHours';

const db = supabase as any;

export type LifecycleStatus = "available" | "unavailable" | "standby" | "mobilizing" | "activated" | "demobilized";
export const PROJECT_REQUIRED: LifecycleStatus[] = ["standby", "mobilizing", "activated"];

export interface CurrentStatus {
  personnel_id: string;
  first_name: string | null;
  last_name: string | null;
  status: LifecycleStatus;
  project_id: string | null;
  project_name: string | null;
  effective_at: string | null;
  note: string | null;
  set_by: string | null;
}

const ALL_KEY = ["personnel-current-status", "all"];

/** One shared, cached fetch of the current-status view; every badge reads from this map (no per-row queries). */
export function useAllCurrentStatuses() {
  return useQuery({
    queryKey: ALL_KEY,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await db.from("personnel_current_status").select("*").limit(10000);
      if (error) throw error;
      const map: Record<string, CurrentStatus> = {};
      for (const r of data ?? []) if (r.personnel_id) map[r.personnel_id] = r as CurrentStatus;
      return map;
    },
  });
}

export function useCurrentStatuses(opts: { ids?: string[]; projectId?: string } = {}) {
  const q = useAllCurrentStatuses();
  const list = useMemo(() => {
    const all = Object.values(q.data ?? {});
    if (opts.projectId) return all.filter((s) => s.project_id === opts.projectId && PROJECT_REQUIRED.includes(s.status));
    if (opts.ids) { const set = new Set(opts.ids); return all.filter((s) => set.has(s.personnel_id)); }
    return all;
  }, [q.data, opts.projectId, opts.ids?.join(",")]);
  return { ...q, list, map: q.data ?? {} };
}

/** ON SITE is derived: one shared query of every open trail row (out_at IS NULL), mapped by person. */
export function useOnSiteMap() {
  return useQuery({
    queryKey: ["on-site-now", "all"],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from("personnel_location_trail")
        .select("personnel_id, location_id, location_name, project_id, in_at").is("out_at", null).limit(5000);
      if (error) throw error;
      const map: Record<string, { location_id: string; location_name: string | null; project_id: string; in_at: string }> = {};
      for (const r of data ?? []) map[r.personnel_id] = r;
      return map;
    },
  });
}

/** Auto-mark assigned people as mobilizing for a project, skipping those already mobilizing/activated there. */
export async function autoMobilize(personnelIds: string[], projectId: string, note: string) {
  if (!personnelIds.length) return;
  const { data, error } = await db.from("personnel_current_status").select("personnel_id, status, project_id").in("personnel_id", personnelIds);
  if (error) throw error;
  const skip = new Set((data ?? []).filter((r: any) => r.project_id === projectId && (r.status === "mobilizing" || r.status === "activated")).map((r: any) => r.personnel_id));
  await insertStatusRows(personnelIds.filter((id) => !skip.has(id)).map((id) => ({ personnel_id: id, status: "mobilizing" as LifecycleStatus, project_id: projectId, note })));
}

export function useCurrentStatus(personnelId?: string) {
  const { map, isLoading } = useCurrentStatuses();
  const s = personnelId ? map[personnelId] : undefined;
  return { status: (s?.status ?? "available") as LifecycleStatus, row: s, isLoading };
}

export function useInvalidateStatus() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["personnel-current-status"] });
    qc.invalidateQueries({ queryKey: ["personnel-status-history"] });
    qc.invalidateQueries({ queryKey: ["project-roster"] });
  };
}

/** Append-only: always INSERT a new log row. */
export async function insertStatusRows(rows: { personnel_id: string; status: LifecycleStatus; project_id?: string | null; note?: string | null }[]) {
  if (!rows.length) return;
  const { data: { user } } = await supabase.auth.getUser();
  for (const r of rows) {
    if (PROJECT_REQUIRED.includes(r.status) && !r.project_id) throw new Error("Project is required for standby/mobilizing/activated");
  }
  const { error } = await db.from("personnel_status_log").insert(
    rows.map((r) => ({ personnel_id: r.personnel_id, status: r.status, project_id: r.project_id ?? null, note: r.note || null, set_by: user?.id ?? null })),
  );
  if (error) throw error;
}

export function useSetStatus() {
  const inv = useInvalidateStatus();
  return useMutation({
    mutationFn: async (input: { personnelIds: string[]; status: LifecycleStatus; project_id?: string | null; note?: string | null }) =>
      insertStatusRows(input.personnelIds.map((pid) => ({ personnel_id: pid, status: input.status, project_id: input.project_id, note: input.note }))),
    onSuccess: (_r, v) => { inv(); toast.success(v.personnelIds.length > 1 ? `${v.personnelIds.length} people updated` : "Status updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to set status"),
  });
}

export interface StatusHistoryRow {
  id: string; status: LifecycleStatus; project_id: string | null; effective_at: string; note: string | null; set_by: string | null;
  project_name: string | null; set_by_name: string | null;
}

export function useStatusHistory(personnelId?: string) {
  return useQuery({
    queryKey: ["personnel-status-history", personnelId],
    enabled: !!personnelId,
    queryFn: async () => {
      const { data, error } = await db.from("personnel_status_log")
        .select("id, status, project_id, effective_at, note, set_by, project:project_id(name)")
        .eq("personnel_id", personnelId).order("effective_at", { ascending: false }).limit(200);
      if (error) throw error;
      const setBy = [...new Set((data ?? []).map((r: any) => r.set_by).filter(Boolean))];
      let names: Record<string, string> = {};
      if (setBy.length) {
        const { data: profs } = await db.from("profiles").select("id, first_name, last_name, email").in("id", setBy);
        names = Object.fromEntries((profs ?? []).map((p: any) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Staff"]));
      }
      return (data ?? []).map((r: any) => ({ ...r, project_name: r.project?.name ?? null, set_by_name: r.set_by ? names[r.set_by] ?? "Staff" : "System" })) as StatusHistoryRow[];
    },
  });
}

/** Projects selectable for standby/activation: active, plus planning/quote/task-order stages; excludes archived/canceled/complete. */
export function useStatusProjects(enabled = true) {
  return useQuery({
    queryKey: ["status-project-options"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from("projects").select("id, name, stage, status")
        .is("archived_at", null).not("stage", "in", "(complete,canceled)").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; stage: string; status: string }[];
    },
  });
}

export interface RosterRow extends CurrentStatus {
  days: number;
  hours: number;
  laborCost: number | null; // null = unresolvable rate or not permitted
  rateSource: "location" | "personnel" | null;
}

const daysSince = (iso: string | null) =>
  iso ? Math.max(1, Math.ceil((Date.now() - new Date(iso).getTime()) / 86_400_000)) : 0;

/** Canonical approved visit/manual time entries feed roster hours; trail is detail only. */
export function useProjectRoster(projectId?: string, withCosts = false) {
  const hoursQuery = useDeploymentHours(projectId);
  const billingPeople = useProjectAgencies(projectId || '');
  const { list, isLoading: sLoading } = useCurrentStatuses({ projectId });
  const activatedIds = list.filter((s) => s.status === "activated").map((s) => s.personnel_id);
  const key = activatedIds.slice().sort().join(",");

  const detail = useQuery({
    queryKey: ["project-roster", projectId, key, withCosts, hoursQuery.dataUpdatedAt],
    enabled: !!projectId,
    queryFn: async () => {
      const hoursByPerson: Record<string, Record<string, number>> = {}; // pid -> location -> hours
      if (activatedIds.length) {
        for (const r of hoursQuery.data ?? []) {
          if (!r.personnel_id || r.hours == null) continue;
          const m = (hoursByPerson[r.personnel_id] ??= {});
          m[r.location_id ?? ""] = (m[r.location_id ?? ""] ?? 0) + Number(r.hours);
        }
      }
      let locRate: Record<string, Record<string, number>> = {}; // pid -> location -> rate
      let personRate: Record<string, number> = {};
      if (withCosts && activatedIds.length) {
        const { data: locs } = await db.from("project_locations").select("id").eq("project_id", projectId);
        const locIds = (locs ?? []).map((l: any) => l.id);
        if (locIds.length) {
          const [{ data: asg }, { data: reqs }] = await Promise.all([
            db.from("location_assignments").select("personnel_id, location_id, role_label").in("location_id", locIds).in("personnel_id", activatedIds),
            db.from("location_requirements").select("location_id, role_label, bill_rate").in("location_id", locIds),
          ]);
          const reqMap: Record<string, number> = {};
          for (const r of reqs ?? []) if (r.bill_rate != null) reqMap[`${r.location_id}|${(r.role_label ?? "").toLowerCase()}`] = Number(r.bill_rate);
          for (const a of asg ?? []) {
            const rate = reqMap[`${a.location_id}|${(a.role_label ?? "").toLowerCase()}`];
            if (rate != null) (locRate[a.personnel_id] ??= {})[a.location_id] = rate;
          }
        }
        const { data: ppl } = await db.from("personnel").select("id, bill_rate").in("id", activatedIds);
        for (const p of ppl ?? []) if (p.bill_rate != null) personRate[p.id] = Number(p.bill_rate);
      }
      return { hoursByPerson, locRate, personRate };
    },
  });

  const rows = useMemo<RosterRow[]>(() => {
    const d = detail.data;
    return list.map((s) => {
      const byLoc = d?.hoursByPerson[s.personnel_id] ?? {};
      const hours = Object.values(byLoc).reduce((a, b) => a + b, 0);
      let laborCost: number | null = null;
      let rateSource: RosterRow["rateSource"] = null;
      if (withCosts && s.status === "activated" && d) {
        let cost = 0; let ok = true;
        for (const [loc, h] of Object.entries(byLoc)) {
          const lr = d.locRate[s.personnel_id]?.[loc];
          const pr = d.personRate[s.personnel_id];
          if (lr != null) { cost += h * lr; rateSource = rateSource ?? "location"; }
          else if (pr != null) { cost += h * pr; rateSource = rateSource ?? "personnel"; }
          else if (h > 0) ok = false;
        }
        laborCost = ok ? cost : null;
      }
      if (withCosts && billingPeople.nonBillableByPerson[s.personnel_id] !== false) laborCost = personnelAmount(laborCost || 0, true);
      return { ...s, days: daysSince(s.effective_at), hours, laborCost, rateSource };
    });
  }, [list, detail.data, withCosts, billingPeople.data]);

  return { rows, isLoading: sLoading || detail.isLoading || hoursQuery.isLoading };
}

// ---------- Personnel expenses ----------

export const EXPENSE_CATEGORIES = [
  { value: "travel", label: "Travel" },
  { value: "per_diem", label: "Per diem" },
  { value: "fuel", label: "Fuel" },
  { value: "materials", label: "Materials" },
  { value: "lodging", label: "Lodging" },
  { value: "other", label: "Other" },
] as const;

export interface PersonnelExpense {
  id: string; personnel_id: string; project_id: string; amount: number; category: string;
  note: string | null; receipt_url: string | null; incurred_on: string; created_at: string;
  person_name?: string;
  deleted_at?: string | null; deleted_by?: string | null; deleted_by_name?: string | null;
}

/** Active (non-removed) expenses by default. includeDeleted=true also returns soft-deleted rows (admin review). */
export function useProjectPersonnelExpenses(projectId?: string, includeDeleted = false) {
  return useQuery({
    queryKey: ["personnel-expenses", projectId, includeDeleted ? "with-deleted" : "active"],
    enabled: !!projectId,
    queryFn: async () => {
      let q = db.from("personnel_expenses").select("*").eq("project_id", projectId);
      if (!includeDeleted) q = q.is("deleted_at", null);
      const { data, error } = await q.order("incurred_on", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((r: any) => r.personnel_id))];
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: ppl } = await db.from("personnel_directory").select("id, first_name, last_name").in("id", ids);
        names = Object.fromEntries((ppl ?? []).map((p: any) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ")]));
      }
      const delIds = [...new Set((data ?? []).map((r: any) => r.deleted_by).filter(Boolean))];
      let delNames: Record<string, string> = {};
      if (delIds.length) {
        const { data: pr } = await db.from("profiles").select("id, first_name, last_name, email").in("id", delIds);
        delNames = Object.fromEntries((pr ?? []).map((p: any) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unknown"]));
      }
      return (data ?? []).map((r: any) => ({ ...r, amount: Number(r.amount), person_name: names[r.personnel_id] || "Unknown", deleted_by_name: r.deleted_by ? delNames[r.deleted_by] ?? null : null })) as PersonnelExpense[];
    },
  });
}

function useInvExpenses() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["personnel-expenses"] });
}

export function useAddPersonnelExpense() {
  const inv = useInvExpenses();
  return useMutation({
    mutationFn: async (input: { personnel_id: string; project_id: string; amount: number; category: string; note?: string | null; incurred_on?: string; receipt?: File | null }) => {
      const { data: { user } } = await supabase.auth.getUser();
      let receipt_url: string | null = null;
      if (input.receipt) {
        const ext = input.receipt.name.split(".").pop() || "jpg";
        const path = `receipts/${input.project_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("field-captures").upload(path, input.receipt, { contentType: input.receipt.type || "image/jpeg" });
        if (upErr) throw upErr;
        receipt_url = supabase.storage.from("field-captures").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await db.from("personnel_expenses").insert({
        personnel_id: input.personnel_id, project_id: input.project_id, amount: input.amount, category: input.category,
        note: input.note || null, receipt_url, created_by: user?.id ?? null,
        ...(input.incurred_on ? { incurred_on: input.incurred_on } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => { inv(); toast.success("Expense added"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to add expense"),
  });
}

export function useUpdatePersonnelExpense() {
  const inv = useInvExpenses();
  return useMutation({
    mutationFn: async ({ id, ...rest }: { id: string; amount?: number; category?: string; note?: string | null; incurred_on?: string }) => {
      const { error } = await db.from("personnel_expenses").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { inv(); toast.success("Expense updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update expense"),
  });
}

export function useDeletePersonnelExpense() {
  const inv = useInvExpenses();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await db.from("personnel_expenses")
        .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { inv(); toast.success("Expense removed"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to remove expense"),
  });
}

export function useRestorePersonnelExpense() {
  const inv = useInvExpenses();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("personnel_expenses").update({ deleted_at: null, deleted_by: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { inv(); toast.success("Expense restored"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to restore expense"),
  });
}
