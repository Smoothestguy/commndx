import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProjectLocation {
  id: string;
  project_id: string;
  name: string;
  project_number: string | null;
  scope: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  poc_name: string | null;
  poc_phone: string | null;
  poc_email: string | null;
  status: string;
  sort_order: number | null;
  housing_provided_by: string | null;
  meals_provided: boolean | null;
  meals_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectLocationInput = Partial<Omit<ProjectLocation, "id" | "created_at" | "updated_at">> & { name: string };

const key = (projectId?: string) => ["project-locations", projectId];
const tbl = () => (supabase as any).from("project_locations");

export function useProjectLocations(projectId?: string) {
  return useQuery({
    queryKey: key(projectId),
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await tbl().select("*").eq("project_id", projectId)
        .order("sort_order", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProjectLocation[];
    },
  });
}

export function useAddProjectLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProjectLocationInput & { project_id: string }) => {
      const { data, error } = await tbl().insert(input).select("id").single();
      if (error) throw error;
      return { pid: input.project_id, id: data.id as string };
    },
    onSuccess: ({ pid }) => { qc.invalidateQueries({ queryKey: key(pid) }); toast.success("Location added"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to add location"),
  });
}

export function useUpdateProjectLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id, ...rest }: ProjectLocationInput & { id: string; project_id: string }) => {
      const { error } = await tbl().update(rest).eq("id", id);
      if (error) throw error;
      return project_id;
    },
    onSuccess: (pid) => { qc.invalidateQueries({ queryKey: key(pid) }); toast.success("Location updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update location"),
  });
}

export function useDeleteProjectLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const { error } = await tbl().delete().eq("id", id);
      if (error) throw error;
      return project_id;
    },
    onSuccess: (pid) => { qc.invalidateQueries({ queryKey: key(pid) }); toast.success("Location deleted"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete location"),
  });
}
