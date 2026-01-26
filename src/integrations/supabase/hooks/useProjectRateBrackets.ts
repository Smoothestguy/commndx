import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProjectRateBracket {
  id: string;
  project_id: string;
  name: string;
  bill_rate: number;
  overtime_multiplier: number;
  is_active: boolean;
  is_billable: boolean;
  created_at: string;
  updated_at: string;
}

export interface RateBracketInsert {
  project_id: string;
  name: string;
  bill_rate: number;
  overtime_multiplier?: number;
  is_active?: boolean;
  is_billable?: boolean;
}

export interface RateBracketUpdate {
  id: string;
  name?: string;
  bill_rate?: number;
  overtime_multiplier?: number;
  is_active?: boolean;
  is_billable?: boolean;
}

// Fetch all rate brackets for a project
export function useProjectRateBrackets(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-rate-brackets", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from("project_rate_brackets")
        .select("*")
        .eq("project_id", projectId)
        .order("name");

      if (error) throw error;
      return data as ProjectRateBracket[];
    },
    enabled: !!projectId,
  });
}

// Fetch only active rate brackets for a project (for assignment dropdown)
export function useActiveProjectRateBrackets(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-rate-brackets", projectId, "active"],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from("project_rate_brackets")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as ProjectRateBracket[];
    },
    enabled: !!projectId,
  });
}

// Add a new rate bracket
export function useAddRateBracket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bracket: RateBracketInsert) => {
      const { data, error } = await supabase
        .from("project_rate_brackets")
        .insert({
          project_id: bracket.project_id,
          name: bracket.name,
          bill_rate: bracket.is_billable === false ? 0 : bracket.bill_rate,
          overtime_multiplier: bracket.overtime_multiplier ?? 1.5,
          is_active: bracket.is_active ?? true,
          is_billable: bracket.is_billable ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["project-rate-brackets", data.project_id] });
      toast.success("Rate bracket added successfully");
    },
    onError: (error: Error) => {
      console.error("Error adding rate bracket:", error);
      if (error.message.includes("duplicate")) {
        toast.error("A rate bracket with this name already exists for this project");
      } else {
        toast.error("Failed to add rate bracket");
      }
    },
  });
}

// Update an existing rate bracket
export function useUpdateRateBracket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bracket: RateBracketUpdate) => {
      const { id, ...updates } = bracket;
      const { data, error } = await supabase
        .from("project_rate_brackets")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["project-rate-brackets", data.project_id] });
      toast.success("Rate bracket updated successfully");
    },
    onError: (error: Error) => {
      console.error("Error updating rate bracket:", error);
      if (error.message.includes("duplicate")) {
        toast.error("A rate bracket with this name already exists for this project");
      } else {
        toast.error("Failed to update rate bracket");
      }
    },
  });
}

// Delete a rate bracket
export function useDeleteRateBracket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase
        .from("project_rate_brackets")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { id, projectId };
    },
    onSuccess: ({ projectId }) => {
      queryClient.invalidateQueries({ queryKey: ["project-rate-brackets", projectId] });
      toast.success("Rate bracket deleted successfully");
    },
    onError: (error: Error) => {
      console.error("Error deleting rate bracket:", error);
      if (error.message.includes("violates foreign key")) {
        toast.error("Cannot delete rate bracket that is assigned to personnel");
      } else {
        toast.error("Failed to delete rate bracket");
      }
    },
  });
}
