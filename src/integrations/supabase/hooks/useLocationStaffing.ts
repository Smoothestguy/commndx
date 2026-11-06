import { saveManualRequirements } from '@/lib/manualRequirementSave';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LocationRequirement {
  id: string;
  location_id: string;
  role_label: string;
  headcount_needed: number;
  bill_rate: number | null;
  notes: string | null;
}

export interface LocationAssignment {
  id: string;
  location_id: string;
  personnel_id: string;
  role_label: string | null;
  status: string;
  assigned_at: string | null;
  personnel: { first_name: string | null; last_name: string | null; status: string | null; phone: string | null } | null;
}

export interface LocationStaffingSummary {
  needed: number;
  assigned: number;
  byRole: Record<string, { needed: number; assigned: number; rate: number | null }>;
}

const db = supabase as any;
const reqKey = (id?: string) => ["location-requirements", id];
const asgKey = (id?: string) => ["location-assignments", id];

function useInvalidate() {
  const qc = useQueryClient();
  return (locationId: string) => {
    qc.invalidateQueries({ queryKey: reqKey(locationId) });
    qc.invalidateQueries({ queryKey: asgKey(locationId) });
    qc.invalidateQueries({ queryKey: ["location-staffing-summary"] });
    for (const key of ["location-authorization", "location-task-orders", "location-task-orders-asof", "customer-project-counts", "deployment-alerts"]) qc.invalidateQueries({ queryKey: [key] });
  };
}

export function useLocationRequirements(locationId?: string) {
  return useQuery({
    queryKey: reqKey(locationId),
    enabled: !!locationId,
    queryFn: async () => {
      const { data, error } = await db.from("location_requirements").select("*")
        .eq("location_id", locationId).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LocationRequirement[];
    },
  });
}

export function useAddLocationRequirement() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (input: { location_id: string; role_label: string; headcount_needed: number; bill_rate?: number | null; notes?: string | null }) => {
      const {data:current,error}=await supabase.from("location_requirements").select("*").eq("location_id",input.location_id);if(error)throw error;
      await saveManualRequirements(input.location_id,[...current??[],input],current??[]);
      return input.location_id;
    },
    onSuccess: inv,
    onError: (e: any) => toast.error(e?.message ?? "Failed to add requirement"),
  });
}

export function useUpdateLocationRequirement() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, location_id, ...rest }: Partial<LocationRequirement> & { id: string; location_id: string }) => {
      const {data:current,error}=await supabase.from("location_requirements").select("*").eq("location_id",location_id);if(error)throw error;
      await saveManualRequirements(location_id,(current??[]).map(r=>r.id===id?{...r,...rest}:r),current??[]);
      return location_id;
    },
    onSuccess: inv,
    onError: (e: any) => toast.error(e?.message ?? "Failed to update requirement"),
  });
}

export function useDeleteLocationRequirement() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, location_id }: { id: string; location_id: string }) => {
      const {data:current,error}=await supabase.from("location_requirements").select("*").eq("location_id",location_id);if(error)throw error;
      await saveManualRequirements(location_id,(current??[]).filter(r=>r.id!==id),current??[]);
      return location_id;
    },
    onSuccess: inv,
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete requirement"),
  });
}

export function useLocationAssignments(locationId?: string) {
  return useQuery({
    queryKey: asgKey(locationId),
    enabled: !!locationId,
    queryFn: async () => {
      const { data, error } = await db.from("location_assignments")
        .select("id, location_id, personnel_id, role_label, status, assigned_at")
        .eq("location_id", locationId).eq("status", "active").order("assigned_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as Omit<LocationAssignment, "personnel">[];
      // Names via personnel_directory (readable by all staff; personnel is admin/manager-only)
      const ids = [...new Set(rows.map((r) => r.personnel_id))];
      let names: Record<string, { first_name: string | null; last_name: string | null }> = {};
      if (ids.length) {
        const { data: dir, error: dErr } = await db.from("personnel_directory")
          .select("id, first_name, last_name").in("id", ids);
        if (dErr) throw dErr;
        for (const r of dir ?? []) names[r.id] = { first_name: r.first_name, last_name: r.last_name };
      }
      return rows.map((r) => ({ ...r, personnel: names[r.personnel_id] ?? null })) as LocationAssignment[];
    },
  });
}

export function useAssignPersonnel() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ location_id, personnel_ids, role_label }: { location_id: string; personnel_ids: string[]; role_label?: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser();
      let dupes = 0;
      for (const pid of personnel_ids) {
        const previous = await db.from('location_assignments').select('id,status').eq('location_id',location_id).eq('personnel_id',pid).maybeSingle();
        if(previous.error)throw previous.error;
        if(previous.data){
          if(previous.data.status==='active'){dupes++;continue;}
          const restored=await db.from('location_assignments').update({status:'active',unassigned_at:null,assigned_at:new Date().toISOString(),assigned_by:user?.id??null,role_label:role_label||null}).eq('id',previous.data.id);
          if(restored.error)throw restored.error;
          continue;
        }
        const { error } = await db.from("location_assignments").insert({
          location_id, personnel_id: pid, role_label: role_label || null, assigned_by: user?.id ?? null,
        });
        if (error) {
          if (error.code === "23505") { dupes++; continue; }
          throw error;
        }
      }
      return { location_id, count: personnel_ids.length - dupes, dupes };
    },
    onSuccess: ({ location_id, count, dupes }) => {
      inv(location_id);
      if (dupes) toast.warning("Already assigned");
      if (count) toast.success(`Assigned ${count}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to assign"),
  });
}

/** Change role on an existing assignment; optimistic across all cached assignment lists. */
export function useUpdateAssignmentRole() {
  const qc = useQueryClient();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, role_label }: { id: string; location_id: string; role_label: string | null }) => {
      const { error } = await db.from("location_assignments").update({ role_label }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, location_id, role_label }) => {
      const keys = [asgKey(location_id), ["location-staffing-summary", "assignments"]];
      await Promise.all(keys.map((k) => qc.cancelQueries({ queryKey: k })));
      const snaps = keys.flatMap((k) => qc.getQueriesData<any[]>({ queryKey: k }));
      for (const [k, d] of snaps) if (Array.isArray(d)) qc.setQueryData(k, d.map((a: any) => (a.id === id ? { ...a, role_label } : a)));
      return { snaps };
    },
    onError: (e: any, _v, ctx) => { ctx?.snaps.forEach(([k, d]) => qc.setQueryData(k, d)); toast.error(e?.message ?? "Failed to update role"); },
    onSettled: (_d, _e, v) => inv(v.location_id),
  });
}

export function useUnassignPersonnel() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, location_id }: { id: string; location_id: string }) => {
      const { error } = await db.from("location_assignments").update({status:'unassigned',unassigned_at:new Date().toISOString()}).eq("id", id);
      if (error) throw error;
      return location_id;
    },
    onSuccess: (lid) => { inv(lid); toast.success("Unassigned"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to unassign"),
  });
}

export function useLocationStaffingSummary(locationIds: string[]) {
  const ids = [...locationIds].sort();
  return useQuery({
    queryKey: ["location-staffing-summary", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const [r, a] = await Promise.all([
        db.from("location_requirements").select("location_id, role_label, headcount_needed, bill_rate").in("location_id", ids),
        db.from("location_assignments").select("location_id, role_label").eq("status", "active").in("location_id", ids),
      ]);
      if (r.error) throw r.error;
      if (a.error) throw a.error;
      const out: Record<string, LocationStaffingSummary> = {};
      const get = (id: string) => (out[id] ??= { needed: 0, assigned: 0, byRole: {} });
      for (const row of r.data ?? []) {
        const s = get(row.location_id);
        const n = Number(row.headcount_needed) || 0;
        s.needed += n;
        const b = (s.byRole[row.role_label] ??= { needed: 0, assigned: 0, rate: null });
        b.needed += n;
        if (row.bill_rate != null && b.rate == null) b.rate = Number(row.bill_rate);
      }
      for (const row of a.data ?? []) {
        const s = get(row.location_id);
        s.assigned += 1;
        if (row.role_label) {
          const b = (s.byRole[row.role_label] ??= { needed: 0, assigned: 0, rate: null });
          b.assigned += 1;
        }
      }
      return out;
    },
  });
}

export function useActivePersonnelLite(enabled: boolean) {
  return useQuery({
    queryKey: ["personnel-lite-active"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from("personnel").select("id, first_name, last_name, phone, status")
        .eq("status", "active").order("first_name", { ascending: true }).limit(2000);
      if (error) throw error;
      return (data ?? []) as { id: string; first_name: string | null; last_name: string | null; phone: string | null; status: string }[];
    },
  });
}

/** One batched query: all active project assignments -> personnel_id mapped to project name. */
export function useActiveProjectAssignmentMap(enabled: boolean) {
  return useQuery({
    queryKey: ["active-project-assignments-map"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from("personnel_project_assignments")
        .select("personnel_id, projects:project_id(name)")
        .eq("status", "active");
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data ?? []) {
        const name = (row as any).projects?.name;
        if (row.personnel_id && name && !map[row.personnel_id]) map[row.personnel_id] = name;
      }
      return map;
    },
  });
}

/** Diff-save a location's requirement rows (insert/update/delete). */
export async function saveLocationRequirements(
  locationId: string,
  rows: { id?: string; role_label: string; headcount_needed: number; bill_rate: number | null }[],
  existing: LocationRequirement[],
) {
  await saveManualRequirements(locationId, rows, existing);
}

/** All active assignments across many locations in one round-trip (+ one name lookup). */
export function useLocationsAssignments(locationIds: string[]) {
  const ids = [...new Set(locationIds)].sort();
  return useQuery({
    // Under the summary key so every staffing mutation invalidates it.
    queryKey: ["location-staffing-summary", "assignments", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await db.from("location_assignments")
        .select("id, location_id, personnel_id, role_label, status, assigned_at")
        .in("location_id", ids).eq("status", "active").order("assigned_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as Omit<LocationAssignment, "personnel">[];
      const pids = [...new Set(rows.map((r) => r.personnel_id))];
      const names: Record<string, { first_name: string | null; last_name: string | null }> = {};
      if (pids.length) {
        const { data: dir, error: dErr } = await db.from("personnel_directory").select("id, first_name, last_name").in("id", pids);
        if (dErr) throw dErr;
        for (const r of dir ?? []) names[r.id] = { first_name: r.first_name, last_name: r.last_name };
      }
      return rows.map((r) => ({ ...r, personnel: names[r.personnel_id] ?? null })) as LocationAssignment[];
    },
  });
}
