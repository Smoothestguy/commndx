import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";
import { useAuditLog, computeChanges } from "@/hooks/useAuditLog";
import type { Json } from "@/integrations/supabase/types";

export type ProjectStage = "quote" | "task_order" | "active" | "complete" | "canceled";

export interface Project {
  id: string;
  name: string;
  customer_id: string;
  status: "active" | "completed" | "on-hold";
  stage: ProjectStage;
  start_date: string;
  end_date: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  customer_po: string | null;
  poc_name: string | null;
  poc_phone: string | null;
  poc_email: string | null;
  mandatory_payroll: boolean;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UseProjectsOptions {
  includeArchived?: boolean;
}

export const useProjects = (options: UseProjectsOptions = {}) => {
  const { includeArchived = false } = options;
  return useQuery({
    queryKey: ["projects", { includeArchived }],
    queryFn: async () => {
      let q = supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (!includeArchived) q = q.is("archived_at", null);
      const { data, error } = await q;

      if (error) throw error;
      return data as Project[];
    },
  });
};

export const useArchivedProjects = () => {
  return useQuery({
    queryKey: ["projects", "archived"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
  });
};

export const useProject = (id: string | undefined) => {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Project | null;
    },
    enabled: !!id,
  });
};

export const useProjectsByCustomer = (customerId: string | null) => {
  return useQuery({
    queryKey: ["projects", "customer", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Project[];
    },
    enabled: !!customerId,
  });
};

export const useAddProject = () => {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async (project: Omit<Project, "id" | "created_at" | "updated_at" | "archived_at" | "archived_by"> & { archived_at?: string | null; archived_by?: string | null }) => {
      const { data, error } = await supabase
        .from("projects")
        .insert([project])
        .select()
        .single();

      if (error) throw error;

      // Log audit action
      await logAction({
        actionType: "create",
        resourceType: "project",
        resourceId: data.id,
        resourceNumber: data.name,
        changesAfter: data as unknown as Json,
        metadata: { 
          customer_id: project.customer_id,
          status: project.status,
          stage: project.stage 
        } as Json,
      });

      // Auto-geocode if address exists
      if (project.address) {
        try {
          const fullAddress = [project.address, project.city, project.state, project.zip]
            .filter(Boolean).join(", ");
          const { data: geocodeResult } = await supabase.functions.invoke("geocode", {
            body: { address: fullAddress },
          });
          if (geocodeResult?.ok && geocodeResult.lat && geocodeResult.lng) {
            await supabase.from("projects").update({
              site_lat: geocodeResult.lat,
              site_lng: geocodeResult.lng,
              site_geocoded_at: new Date().toISOString(),
            }).eq("id", data.id);
          }
        } catch (e) {
          console.error("Auto-geocode failed:", e);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add project: ${error.message}`);
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Project> & { id: string }) => {
      // Fetch original for audit
      const { data: originalData } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      const { data, error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Log audit action
      const { changesBefore, changesAfter } = computeChanges(
        originalData as Record<string, unknown>,
        data as Record<string, unknown>
      );
      await logAction({
        actionType: "update",
        resourceType: "project",
        resourceId: id,
        resourceNumber: data.name,
        changesBefore,
        changesAfter,
      });

      // Auto-geocode if address changed
      const addressChanged = 
        updates.address !== undefined && updates.address !== originalData?.address ||
        updates.city !== undefined && updates.city !== originalData?.city ||
        updates.state !== undefined && updates.state !== originalData?.state ||
        updates.zip !== undefined && updates.zip !== originalData?.zip;

      if (addressChanged && (updates.address || data.address)) {
        try {
          const fullAddress = [
            updates.address ?? data.address,
            updates.city ?? data.city,
            updates.state ?? data.state,
            updates.zip ?? data.zip
          ].filter(Boolean).join(", ");
          
          const { data: geocodeResult } = await supabase.functions.invoke("geocode", {
            body: { address: fullAddress },
          });
          
          if (geocodeResult?.ok && geocodeResult.lat && geocodeResult.lng) {
            await supabase.from("projects").update({
              site_lat: geocodeResult.lat,
              site_lng: geocodeResult.lng,
              site_geocoded_at: new Date().toISOString(),
            }).eq("id", id);
          }
        } catch (e) {
          console.error("Auto-geocode failed:", e);
        }
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-geofence", variables.id] });
      toast.success("Project updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update project: ${error.message}`);
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async (id: string) => {
      // Fetch original for audit
      const { data: originalData } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      const { data: { user } } = await supabase.auth.getUser();
      
      // Soft delete instead of hard delete
      const { error } = await supabase
        .from("projects")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
        })
        .eq("id", id);

      if (error) throw error;

      // Log audit action
      await logAction({
        actionType: "delete",
        resourceType: "project",
        resourceId: id,
        resourceNumber: originalData?.name,
        changesBefore: originalData as unknown as Json,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["deleted_items"] });
      toast.success("Project moved to trash");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete project: ${error.message}`);
    },
  });
};

export const useArchiveProject = () => {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();
  return useMutation({
    mutationFn: async (project: { id: string; name?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("projects")
        .update({ archived_at: new Date().toISOString(), archived_by: user?.id ?? null })
        .eq("id", project.id)
        .select()
        .single();
      if (error) throw error;
      await logAction({
        actionType: "update",
        resourceType: "project",
        resourceId: project.id,
        resourceNumber: data.name,
        metadata: { archived: true } as Json,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(`Project archived: ${data.name}`);
    },
    onError: (error: Error) => toast.error(`Failed to archive: ${error.message}`),
  });
};

export const useUnarchiveProject = () => {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();
  return useMutation({
    mutationFn: async (project: { id: string; name?: string }) => {
      const { data, error } = await supabase
        .from("projects")
        .update({ archived_at: null, archived_by: null })
        .eq("id", project.id)
        .select()
        .single();
      if (error) throw error;
      await logAction({
        actionType: "update",
        resourceType: "project",
        resourceId: project.id,
        resourceNumber: data.name,
        metadata: { archived: false } as Json,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(`Project unarchived: ${data.name}`);
    },
    onError: (error: Error) => toast.error(`Failed to unarchive: ${error.message}`),
  });
};

export const useDuplicateProject = () => {
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async (sourceId: string): Promise<{ id: string; name: string }> => {
      const { data: source, error: fetchErr } = await supabase
        .from("projects")
        .select("*")
        .eq("id", sourceId)
        .single();
      if (fetchErr) throw fetchErr;
      if (!source) throw new Error("Source project not found");

      const today = new Date().toISOString().split("T")[0];
      const insertPayload: Record<string, unknown> = {
        name: `${source.name} (Copy)`,
        customer_id: source.customer_id,
        status: "active",
        stage: "quote",
        start_date: today,
        end_date: null,
        description: source.description,
        address: source.address,
        city: source.city,
        state: source.state,
        zip: source.zip,
        customer_po: null,
        poc_name: source.poc_name,
        poc_phone: source.poc_phone,
        poc_email: source.poc_email,
        mandatory_payroll: source.mandatory_payroll ?? false,
        time_clock_enabled: (source as { time_clock_enabled?: boolean | null }).time_clock_enabled ?? false,
        require_clock_location: (source as { require_clock_location?: boolean | null }).require_clock_location ?? true,
      };

      const { data, error } = await supabase
        .from("projects")
        .insert([insertPayload as never])
        .select()
        .single();
      if (error) throw error;

      await logAction({
        actionType: "create",
        resourceType: "project",
        resourceId: data.id,
        resourceNumber: data.name,
        changesAfter: data as unknown as Json,
        metadata: { duplicated_from: sourceId } as Json,
      });

      return { id: data.id, name: data.name };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(`Duplicated: ${result.name}`);
    },
    onError: (error: Error) => toast.error(`Failed to duplicate: ${error.message}`),
  });
};
