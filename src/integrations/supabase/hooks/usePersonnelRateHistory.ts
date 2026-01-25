import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RateHistoryRecord {
  id: string;
  project_id: string;
  personnel_id: string;
  assignment_id: string | null;
  effective_from: string;
  effective_to: string | null;
  pay_rate: number;
  changed_by: string | null;
  change_reason: string | null;
  notes: string | null;
  created_at: string;
}

interface UpdatePayRateParams {
  projectId: string;
  personnelId: string;
  assignmentId: string;
  newRate: number;
  changeReason?: string;
  notes?: string;
}

/**
 * Fetch rate history for a specific personnel on a project
 */
export function usePersonnelRateHistory(projectId: string, personnelId: string) {
  return useQuery({
    queryKey: ["personnel-rate-history", projectId, personnelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_personnel_rate_history")
        .select("*")
        .eq("project_id", projectId)
        .eq("personnel_id", personnelId)
        .order("effective_from", { ascending: false });

      if (error) throw error;
      return data as RateHistoryRecord[];
    },
    enabled: !!projectId && !!personnelId,
  });
}

/**
 * Get the current active rate for a personnel on a project
 */
export function useCurrentPersonnelRate(projectId: string, personnelId: string) {
  return useQuery({
    queryKey: ["personnel-current-rate", projectId, personnelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_personnel_rate_history")
        .select("*")
        .eq("project_id", projectId)
        .eq("personnel_id", personnelId)
        .is("effective_to", null)
        .single();

      if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
      return data as RateHistoryRecord | null;
    },
    enabled: !!projectId && !!personnelId,
  });
}

/**
 * Update pay rate for a personnel on a project.
 * This closes the previous rate record and creates a new one.
 */
export function useUpdatePersonnelPayRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      personnelId,
      assignmentId,
      newRate,
      changeReason,
      notes,
    }: UpdatePayRateParams) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("You must be logged in to update pay rates");

      // Step 1: Close the current active rate record (if any)
      const { error: closeError } = await supabase
        .from("project_personnel_rate_history")
        .update({ effective_to: new Date().toISOString() })
        .eq("project_id", projectId)
        .eq("personnel_id", personnelId)
        .is("effective_to", null);

      // Ignore error if no existing record (first rate being set)
      if (closeError && closeError.code !== "PGRST116") {
        console.error("Error closing previous rate:", closeError);
      }

      // Step 2: Insert new rate history record
      const { data: newHistory, error: insertError } = await supabase
        .from("project_personnel_rate_history")
        .insert({
          project_id: projectId,
          personnel_id: personnelId,
          assignment_id: assignmentId,
          pay_rate: newRate,
          changed_by: user.id,
          change_reason: changeReason || null,
          notes: notes || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Step 3: Update the assignment's current pay_rate field
      const { error: updateError } = await supabase
        .from("personnel_project_assignments")
        .update({ pay_rate: newRate, updated_at: new Date().toISOString() })
        .eq("id", assignmentId);

      if (updateError) throw updateError;

      return newHistory;
    },
    onSuccess: (_, variables) => {
      toast.success("Pay rate updated for this project going forward");
      
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ["personnel-rate-history", variables.projectId, variables.personnelId],
      });
      queryClient.invalidateQueries({
        queryKey: ["personnel-current-rate", variables.projectId, variables.personnelId],
      });
      queryClient.invalidateQueries({
        queryKey: ["personnel-project-assignments", "by-project", variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["personnel-with-assets", variables.projectId],
      });
    },
    onError: (error: Error) => {
      console.error("Failed to update pay rate:", error);
      toast.error(error.message || "Failed to update pay rate");
    },
  });
}

/**
 * Initialize rate history when first assigning personnel to a project.
 * Should be called after creating the assignment.
 */
export function useInitializePersonnelRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      personnelId,
      assignmentId,
      payRate,
    }: {
      projectId: string;
      personnelId: string;
      assignmentId: string;
      payRate: number;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Check if rate history already exists
      const { data: existing } = await supabase
        .from("project_personnel_rate_history")
        .select("id")
        .eq("project_id", projectId)
        .eq("personnel_id", personnelId)
        .is("effective_to", null)
        .single();

      if (existing) {
        // Rate already exists, skip initialization
        return existing;
      }

      // Create initial rate history record
      const { data, error } = await supabase
        .from("project_personnel_rate_history")
        .insert({
          project_id: projectId,
          personnel_id: personnelId,
          assignment_id: assignmentId,
          pay_rate: payRate,
          changed_by: user?.id || null,
          change_reason: "Initial assignment",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["personnel-rate-history", variables.projectId, variables.personnelId],
      });
    },
  });
}

export const RATE_CHANGE_REASONS = [
  { value: "rate_adjustment", label: "Rate Adjustment" },
  { value: "customer_change", label: "Customer Change Request" },
  { value: "performance", label: "Performance Review" },
  { value: "market_rate", label: "Market Rate Update" },
  { value: "role_change", label: "Role/Position Change" },
  { value: "other", label: "Other" },
] as const;
