import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PersonnelProjectAssignment {
  id: string;
  personnel_id: string;
  project_id: string;
  assigned_by: string | null;
  assigned_at: string;
  status: string;
  bill_rate: number | null;
  rate_bracket_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PersonnelWithAssignment {
  id: string;
  first_name: string;
  last_name: string;
  hourly_rate: number | null;
  pay_rate: number | null;
  bill_rate: number | null;
  email: string;
  phone: string | null;
  status: string | null;
  vendor_id: string | null;
  linked_vendor_id: string | null;
}

export interface AssignmentWithDetails extends PersonnelProjectAssignment {
  personnel: PersonnelWithAssignment | null;
  projects: {
    id: string;
    name: string;
    status: string;
    customers: { name: string; company: string | null } | null;
  } | null;
}

export interface RateBracketInfo {
  id: string;
  name: string;
  bill_rate: number;
  overtime_multiplier: number;
}

// Get all personnel assigned to a specific project (filters out inactive/do_not_hire personnel)
export function usePersonnelByProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["personnel-project-assignments", "by-project", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from("personnel_project_assignments")
        .select(`
          id,
          personnel_id,
          project_id,
          assigned_by,
          assigned_at,
          status,
          bill_rate,
          rate_bracket_id,
          created_at,
          updated_at,
          personnel!inner (
            id,
            first_name,
            last_name,
            hourly_rate,
            pay_rate,
            bill_rate,
            email,
            phone,
            status,
            vendor_id,
            linked_vendor_id
          ),
          project_rate_brackets (
            id,
            name,
            bill_rate,
            overtime_multiplier
          )
        `)
        .eq("project_id", projectId)
        .eq("status", "active")
        .eq("personnel.status", "active");

      if (error) throw error;
      return data as (PersonnelProjectAssignment & { 
        personnel: PersonnelWithAssignment | null;
        project_rate_brackets: RateBracketInfo | null;
      })[];
    },
    enabled: !!projectId,
  });
}

// Get all personnel assignments (for admin view)
export function useAllPersonnelProjectAssignments() {
  return useQuery({
    queryKey: ["personnel-project-assignments", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel_project_assignments")
        .select(`
          id,
          personnel_id,
          project_id,
          assigned_by,
          assigned_at,
          status,
          created_at,
          updated_at,
          personnel (
            id,
            first_name,
            last_name,
            hourly_rate,
            email,
            phone,
            status
          ),
          projects (
            id,
            name,
            status,
            customers (
              name,
              company
            )
          )
        `)
        .order("assigned_at", { ascending: false });

      if (error) throw error;
      return data as AssignmentWithDetails[];
    },
  });
}

// Assign personnel to a project
export function useAssignPersonnelToProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      personnelId,
      projectId,
    }: {
      personnelId: string;
      projectId: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("personnel_project_assignments")
        .insert({
          personnel_id: personnelId,
          project_id: projectId,
          assigned_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-project-assignments"] });
      toast.success("Personnel assigned to project");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate")) {
        toast.error("Personnel is already assigned to this project");
      } else {
        toast.error("Failed to assign personnel");
      }
    },
  });
}

// Bulk assign multiple personnel to a project with rate bracket
export function useBulkAssignPersonnelToProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      personnelIds,
      projectId,
      rateBracketIds,
    }: {
      personnelIds: string[];
      projectId: string;
      rateBracketIds: Record<string, string>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const assignments = personnelIds.map((personnelId) => ({
        personnel_id: personnelId,
        project_id: projectId,
        assigned_by: user?.id || null,
        status: 'active',
        assigned_at: new Date().toISOString(),
        rate_bracket_id: rateBracketIds[personnelId] || null,
      }));

      const { data, error } = await supabase
        .from("personnel_project_assignments")
        .upsert(assignments, { onConflict: "personnel_id,project_id" })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["personnel-project-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["project-rate-brackets"] });
      toast.success(`${data.length} personnel assigned to project`);
    },
    onError: () => {
      toast.error("Failed to assign personnel");
    },
  });
}

// Remove personnel from a project (soft delete by changing status)
export function useRemovePersonnelFromProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("personnel_project_assignments")
        .update({ status: "removed" })
        .eq("id", assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-project-assignments"] });
      toast.success("Personnel removed from project");
    },
    onError: () => {
      toast.error("Failed to remove personnel");
    },
  });
}

// Get all projects assigned to a specific personnel member
export function useProjectsForPersonnel(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["personnel-project-assignments", "by-personnel", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];
      
      const { data, error } = await supabase
        .from("personnel_project_assignments")
        .select(`
          id,
          personnel_id,
          project_id,
          assigned_by,
          assigned_at,
          status,
          created_at,
          updated_at,
          projects (
            id,
            name,
            status,
            start_date,
            end_date,
            customers (
              name,
              company
            )
          )
        `)
        .eq("personnel_id", personnelId)
        .eq("status", "active")
        .order("assigned_at", { ascending: false });

      if (error) throw error;
      return data as (PersonnelProjectAssignment & { 
        projects: {
          id: string;
          name: string;
          status: string;
          start_date: string | null;
          end_date: string | null;
          customers: { name: string; company: string | null } | null;
        } | null 
      })[];
    },
    enabled: !!personnelId,
  });
}

// Update assignment rate bracket
export function useUpdateAssignmentRateBracket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assignmentId,
      rateBracketId,
    }: {
      assignmentId: string;
      rateBracketId: string | null;
    }) => {
      const { data, error } = await supabase
        .from("personnel_project_assignments")
        .update({ rate_bracket_id: rateBracketId })
        .eq("id", assignmentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-project-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["project-rate-brackets"] });
      toast.success("Rate bracket updated");
    },
    onError: () => {
      toast.error("Failed to update rate bracket");
    },
  });
}

// Update assignment bill rate (deprecated - keep for backward compatibility)
export function useUpdateAssignmentBillRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assignmentId,
      billRate,
    }: {
      assignmentId: string;
      billRate: number | null;
    }) => {
      const { data, error } = await supabase
        .from("personnel_project_assignments")
        .update({ bill_rate: billRate })
        .eq("id", assignmentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-project-assignments"] });
      toast.success("Bill rate updated");
    },
    onError: () => {
      toast.error("Failed to update bill rate");
    },
  });
}

// Hard delete assignment
export function useDeletePersonnelAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("personnel_project_assignments")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-project-assignments"] });
      toast.success("Assignment deleted");
    },
    onError: () => {
      toast.error("Failed to delete assignment");
    },
  });
}

// Bulk remove personnel from projects (soft delete)
export function useBulkRemovePersonnelFromProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignments: { projectId: string; personnelId: string }[]) => {
      // First, get the assignment IDs for the given project-personnel pairs
      const conditions = assignments.map(a => 
        `(project_id.eq.${a.projectId},personnel_id.eq.${a.personnelId})`
      ).join(',');
      
      // Use a simpler approach - update each pair
      const results = await Promise.all(
        assignments.map(async ({ projectId, personnelId }) => {
          const { error } = await supabase
            .from("personnel_project_assignments")
            .update({ status: "removed" })
            .eq("project_id", projectId)
            .eq("personnel_id", personnelId)
            .eq("status", "active");
          
          if (error) throw error;
        })
      );

      return results;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["personnel-project-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-time-entries"] });
      toast.success(`${variables.length} personnel removed from projects`);
    },
    onError: () => {
      toast.error("Failed to remove personnel from projects");
    },
  });
}
