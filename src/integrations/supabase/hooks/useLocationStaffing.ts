import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LocationRequirement {
  id: string;
  location_id: string;
  role_label: string;
  headcount_needed: number;
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
  byRole: Record<string, { needed: number; assigned: number }>;
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
    mutationFn: async (input: { location_id: string; role_label: string; headcount_needed: number; notes?: string | null }) => {
      const { error } = await db.from("location_requirements").insert(input);
      if (error) throw error;
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
      const { error } = await db.from("location_requirements").update(rest).eq("id", id);
      if (error) throw error;
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
      const { error } = await db.from("location_requirements").delete().eq("id", id);
      if (error) throw error;
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
        .select("id, location_id, personnel_id, role_label, status, assigned_at, personnel:personnel_id(first_name, last_name, status, phone)")
        .eq("location_id", locationId).eq("status", "active").order("assigned_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LocationAssignment[];
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

export function useUnassignPersonnel() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, location_id }: { id: string; location_id: string }) => {
      const { error } = await db.from("location_assignments").delete().eq("id", id);
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
        db.from("location_requirements").select("location_id, role_label, headcount_needed").in("location_id", ids),
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
        const b = (s.byRole[row.role_label] ??= { needed: 0, assigned: 0 });
        b.needed += n;
      }
      for (const row of a.data ?? []) {
        const s = get(row.location_id);
        s.assigned += 1;
        if (row.role_label) {
          const b = (s.byRole[row.role_label] ??= { needed: 0, assigned: 0 });
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
