import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ProjectAssignment {
  id: string;
  project_id: string;
  user_id: string;
  assigned_by: string | null;
  assigned_at: string;
  last_time_entry_at: string | null;
  status: 'active' | 'removed';
  created_at: string;
  updated_at: string;
}

export interface ProjectAssignmentInsert {
  project_id: string;
  user_id: string;
}

// Get all assignments for current user (active only)
export function useMyProjectAssignments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["project-assignments", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("project_assignments")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("assigned_at", { ascending: false });

      if (error) throw error;
      return data as ProjectAssignment[];
    },
    enabled: !!user,
  });
}

// Get all assignments (for managers/admins)
export function useAllProjectAssignments() {
  return useQuery({
    queryKey: ["all-project-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_assignments")
        .select(`
          *,
          projects:project_id(name),
          profiles:user_id(first_name, last_name, email)
        `)
        .order("assigned_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

// Get assignments for a specific project
export function useProjectAssignmentsByProject(projectId: string | null) {
  return useQuery({
    queryKey: ["project-assignments", "project", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("project_assignments")
        .select(`
          *,
          profiles:user_id(first_name, last_name, email)
        `)
        .eq("project_id", projectId)
        .order("assigned_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

// Assign user to project
export function useAssignToProject() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (assignment: ProjectAssignmentInsert) => {
      const { data, error } = await supabase
        .from("project_assignments")
        .insert({
          ...assignment,
          assigned_by: user?.id,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all-project-assignments"] });
      toast.success("User assigned to project successfully");
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error("User is already assigned to this project");
      } else {
        toast.error("Failed to assign user to project");
      }
    },
  });
}

// Remove user from project
export function useRemoveFromProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("project_assignments")
        .update({ status: 'removed' })
        .eq("id", assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all-project-assignments"] });
      toast.success("User removed from project");
    },
    onError: () => {
      toast.error("Failed to remove user from project");
    },
  });
}

// Reactivate assignment
export function useReactivateAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("project_assignments")
        .update({ status: 'active', last_time_entry_at: null })
        .eq("id", assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all-project-assignments"] });
      toast.success("User reassigned to project");
    },
    onError: () => {
      toast.error("Failed to reassign user to project");
    },
  });
}