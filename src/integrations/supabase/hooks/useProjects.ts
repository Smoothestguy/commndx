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
  created_at: string;
  updated_at: string;
}

export const useProjects = () => {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Project[];
    },
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
    mutationFn: async (project: Omit<Project, "id" | "created_at" | "updated_at">) => {
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

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
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
