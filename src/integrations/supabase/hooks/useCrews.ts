import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as any;

export interface CrewMember {
  id: string;
  crew_id: string;
  personnel_id: string;
  role_label: string | null;
  joined_on: string;
  left_on: string | null;
  personnel: { first_name: string | null; last_name: string | null } | null;
}

export interface Crew {
  id: string;
  project_id: string;
  name: string;
  supervisor_personnel_id: string | null;
  truck_count: number | null;
  status: string;
  notes: string | null;
  supervisor: { first_name: string | null; last_name: string | null } | null;
  members: CrewMember[]; // current roster (left_on IS NULL)
}

export const fullName = (p: { first_name: string | null; last_name: string | null } | null | undefined) =>
  [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Unknown";

/** Crews for a project with current rosters. Supervisor/member names come from
 *  personnel_directory (readable by all staff) so field users never see "Unknown". */
export function useCrews(projectId?: string) {
  return useQuery({
    queryKey: ["crews", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data: crews, error } = await db.from("crews")
        .select("id, project_id, name, supervisor_personnel_id, truck_count, status, notes, supervisor:supervisor_personnel_id(first_name, last_name)")
        .eq("project_id", projectId).order("created_at", { ascending: true });
      if (error) throw error;
      const ids = (crews ?? []).map((c: any) => c.id);
      let members: CrewMember[] = [];
      if (ids.length) {
        const { data, error: mErr } = await db.from("crew_members")
          .select("id, crew_id, personnel_id, role_label, joined_on, left_on, personnel:personnel_id(first_name, last_name)")
          .in("crew_id", ids).is("left_on", null).order("joined_on", { ascending: true });
        if (mErr) throw mErr;
        members = (data ?? []) as CrewMember[];
      }
      return (crews ?? []).map((c: any) => ({ ...c, members: members.filter((m) => m.crew_id === c.id) })) as Crew[];
    },
  });
}

/** Searchable staff directory for pickers — readable by all authenticated roles. */
export function usePersonnelDirectory(enabled: boolean) {
  return useQuery({
    queryKey: ["personnel-directory"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from("personnel_directory")
        .select("id, first_name, last_name, photo_url, status")
        .eq("status", "active").order("first_name", { ascending: true }).limit(2000);
      if (error) throw error;
      return (data ?? []) as { id: string; first_name: string | null; last_name: string | null; photo_url: string | null; status: string }[];
    },
  });
}

function useInv(projectId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["crews", projectId] });
}

export function useCreateCrew(projectId: string) {
  const inv = useInv(projectId);
  return useMutation({
    mutationFn: async (input: { name: string; supervisor_personnel_id?: string | null; truck_count?: number | null; notes?: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await db.from("crews").insert({ ...input, project_id: projectId, created_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => { inv(); toast.success("Crew created"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create crew"),
  });
}

export function useUpdateCrew(projectId: string) {
  const inv = useInv(projectId);
  return useMutation({
    mutationFn: async ({ id, ...rest }: { id: string; name?: string; supervisor_personnel_id?: string | null; truck_count?: number | null; notes?: string | null; status?: string }) => {
      const { error } = await db.from("crews").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { inv(); toast.success("Crew updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update crew"),
  });
}

export function useAddCrewMember(projectId: string) {
  const inv = useInv(projectId);
  return useMutation({
    mutationFn: async ({ crew_id, personnel_id, role_label }: { crew_id: string; personnel_id: string; role_label?: string | null }) => {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await db.from("crew_members").insert({ crew_id, personnel_id, role_label: role_label || null, joined_on: today });
      if (error) {
        if (error.code === "23505") { toast.warning("Already on this crew"); return; }
        throw error;
      }
    },
    onSuccess: () => inv(),
    onError: (e: any) => toast.error(e?.message ?? "Failed to add member"),
  });
}

/** Soft-remove: sets left_on = today, preserving membership history. */
export function useRemoveCrewMember(projectId: string) {
  const inv = useInv(projectId);
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await db.from("crew_members").update({ left_on: today }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { inv(); toast.success("Member removed"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to remove member"),
  });
}
