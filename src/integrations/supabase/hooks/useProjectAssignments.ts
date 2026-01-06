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

// Bulk assign multiple users to a project
export function useBulkAssignToProject() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ userIds, projectId }: { userIds: string[]; projectId: string }) => {
      const assignments = userIds.map(userId => ({
        project_id: projectId,
        user_id: userId,
        assigned_by: user?.id,
        status: 'active' as const,
        assigned_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from("project_assignments")
        .upsert(assignments, { 
          onConflict: 'project_id,user_id',
          ignoreDuplicates: false 
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all-project-assignments"] });
      toast.success(`${variables.userIds.length} user(s) assigned to project`);
    },
    onError: () => {
      toast.error("Failed to assign users to project");
    },
  });
}

// Bulk assign one user to multiple projects
// Uses personnel_project_assignments if user has a linked personnel record
export function useBulkAssignUserToProjects() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ userId, projectIds }: { userId: string; projectIds: string[] }) => {
      // Check if user has a linked personnel record
      const { data: personnel, error: personnelError } = await supabase
        .from("personnel")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (personnelError) {
        // If the current user doesn't have permission to read personnel, we should fail loudly.
        // Otherwise we'll silently fall back to project_assignments and SMS won't ever send.
        throw personnelError;
      }

      if (personnel?.id) {
        // User has a personnel record - use personnel_project_assignments
        const assignments = projectIds.map(projectId => ({
          project_id: projectId,
          personnel_id: personnel.id,
          assigned_by: user?.id,
          status: 'active' as const,
          assigned_at: new Date().toISOString(),
        }));

        const { data, error } = await supabase
          .from("personnel_project_assignments")
          .upsert(assignments, { 
            onConflict: 'project_id,personnel_id',
            ignoreDuplicates: false 
          })
          .select();

        if (error) throw error;

        let smsFailed = 0;
        for (const assignment of data || []) {
          const { error: smsError } = await supabase.functions.invoke('send-assignment-sms', {
            body: {
              personnelId: assignment.personnel_id,
              projectId: assignment.project_id,
              assignmentId: assignment.id,
              force: true,
            },
          });

          if (smsError) {
            smsFailed += 1;
            console.error(`SMS failed for personnel ${assignment.personnel_id}:`, smsError);
          }
        }

        return { data, type: 'personnel' as const, smsFailed };
      }

      // No personnel record - fall back to project_assignments
      const assignments = projectIds.map(projectId => ({
        project_id: projectId,
        user_id: userId,
        assigned_by: user?.id,
        status: 'active' as const,
        assigned_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from("project_assignments")
        .upsert(assignments, { 
          onConflict: 'project_id,user_id',
          ignoreDuplicates: false 
        })
        .select();

      if (error) throw error;
      return { data, type: 'user' as const };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all-project-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-project-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-assignments"] });

      if (result.type === 'personnel' && result.smsFailed) {
        toast.warning(`Assigned to ${variables.projectIds.length} project(s), but ${result.smsFailed} SMS failed. Check Messages for details.`);
      } else if (result.type === 'user') {
        toast.warning(`Assigned to ${variables.projectIds.length} project(s). No SMS sent (user has no linked personnel/phone).`);
      } else {
        toast.success(`User assigned to ${variables.projectIds.length} project(s)`);
      }
    },
    onError: (error: any) => {
      toast.error(error?.message ? `Failed to assign user: ${error.message}` : "Failed to assign user to projects");
    },
  });
}