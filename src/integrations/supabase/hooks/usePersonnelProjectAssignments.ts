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

// Get assignment counts for multiple projects (efficient batch query)
export function useAssignmentCountsByProject(projectIds: string[]) {
  return useQuery({
    queryKey: ["personnel-assignment-counts", projectIds],
    queryFn: async () => {
      if (!projectIds.length) return {};
      
      const { data, error } = await supabase
        .from("personnel_project_assignments")
        .select("project_id")
        .in("project_id", projectIds)
        .eq("status", "active");

      if (error) throw error;

      // Group by project_id and count
      const counts: Record<string, number> = {};
      data?.forEach((a) => {
        counts[a.project_id] = (counts[a.project_id] || 0) + 1;
      });
      return counts;
    },
    enabled: projectIds.length > 0,
  });
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
      
      // Send SMS notification for the assignment
      try {
        await supabase.functions.invoke('send-assignment-sms', {
          body: {
            personnelId: data.personnel_id,
            projectId: data.project_id,
            assignmentId: data.id,
            force: true
          }
        });
        console.log(`Assignment SMS sent for personnel ${data.personnel_id}`);
      } catch (smsError) {
        console.error(`Failed to send assignment SMS:`, smsError);
        // Don't fail the assignment if SMS fails
      }
      
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

// Bulk assign multiple personnel to a project with rate bracket and optional schedule
export function useBulkAssignPersonnelToProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      personnelIds,
      projectId,
      rateBracketIds,
      scheduledDate,
      scheduledStartTime,
      scheduledEndTime,
    }: {
      personnelIds: string[];
      projectId: string;
      rateBracketIds: Record<string, string>;
      scheduledDate?: string;
      scheduledStartTime?: string;
      scheduledEndTime?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const assignedPersonnelData: any[] = [];
      
      // For each personnel, check if they already have an active assignment
      // If not, create a new one (preserving old ended assignments for history)
      for (const personnelId of personnelIds) {
        // Check if already has an active assignment
        const { data: existing } = await supabase
          .from("personnel_project_assignments")
          .select("id")
          .eq("personnel_id", personnelId)
          .eq("project_id", projectId)
          .eq("status", "active")
          .maybeSingle();

        if (existing) {
          // Already active - update rate bracket if needed
          const { data: updated, error: updateError } = await supabase
            .from("personnel_project_assignments")
            .update({ rate_bracket_id: rateBracketIds[personnelId] || null })
            .eq("id", existing.id)
            .select()
            .single();
          
          if (!updateError && updated) {
            assignedPersonnelData.push(updated);
          }
        } else {
          // Insert new assignment (leaves old ended assignments intact for history)
          const { data: inserted, error: insertError } = await supabase
            .from("personnel_project_assignments")
            .insert({
              personnel_id: personnelId,
              project_id: projectId,
              assigned_by: user?.id || null,
              status: 'active',
              assigned_at: new Date().toISOString(),
              rate_bracket_id: rateBracketIds[personnelId] || null,
            })
            .select()
            .single();
          
          if (!insertError && inserted) {
            assignedPersonnelData.push(inserted);
          }
        }
      }

      const data = assignedPersonnelData;
      
      // Create schedule entries if schedule info was provided
      if (scheduledDate && scheduledStartTime) {
        for (const assignment of data) {
          try {
            // Check if schedule already exists
            const { data: existingSchedule } = await supabase
              .from("personnel_schedules")
              .select("id")
              .eq("personnel_id", assignment.personnel_id)
              .eq("project_id", assignment.project_id)
              .eq("scheduled_date", scheduledDate)
              .maybeSingle();
            
            if (existingSchedule) {
              // Update existing schedule
              await supabase
                .from("personnel_schedules")
                .update({
                  scheduled_start_time: scheduledStartTime,
                  scheduled_end_time: scheduledEndTime || "17:00",
                })
                .eq("id", existingSchedule.id);
            } else {
              // Insert new schedule
              const { data: userData } = await supabase.auth.getUser();
              await supabase
                .from("personnel_schedules")
                .insert([{
                  personnel_id: assignment.personnel_id,
                  project_id: assignment.project_id,
                  scheduled_date: scheduledDate,
                  scheduled_start_time: scheduledStartTime,
                  scheduled_end_time: scheduledEndTime || "17:00",
                  created_by: userData?.user?.id || null,
                }]);
            }
          } catch (scheduleError) {
            console.error(`Failed to create schedule for personnel ${assignment.personnel_id}:`, scheduleError);
          }
        }
      }
      
      // Send SMS notifications for each assignment
      for (const assignment of data) {
        try {
          await supabase.functions.invoke('send-assignment-sms', {
            body: {
              personnelId: assignment.personnel_id,
              projectId: assignment.project_id,
              assignmentId: assignment.id,
              scheduledDate,
              scheduledStartTime,
              force: true
            }
          });
          console.log(`Assignment SMS sent for personnel ${assignment.personnel_id}`);
        } catch (smsError) {
          console.error(`Failed to send assignment SMS for personnel ${assignment.personnel_id}:`, smsError);
          // Don't fail the assignment if SMS fails
        }
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["personnel-project-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["project-rate-brackets"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-schedules"] });
      toast.success(`${data.length} personnel assigned to project`);
    },
    onError: () => {
      toast.error("Failed to assign personnel");
    },
  });
}

// Unassignment reason types
export type UnassignmentReason = 
  | "sent_home" 
  | "no_show" 
  | "left_site" 
  | "terminated" 
  | "project_ended" 
  | "other";

export const UNASSIGNMENT_REASONS: { value: UnassignmentReason; label: string }[] = [
  { value: "sent_home", label: "Sent Home" },
  { value: "no_show", label: "No Show" },
  { value: "left_site", label: "Left Site" },
  { value: "terminated", label: "Terminated" },
  { value: "project_ended", label: "Project Ended" },
  { value: "other", label: "Other" },
];

export interface UnassignPersonnelInput {
  assignmentId: string;
  reason: UnassignmentReason;
  notes?: string;
}

// Unassign personnel from a project (soft unassign with audit trail)
export function useUnassignPersonnelFromProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ assignmentId, reason, notes }: UnassignPersonnelInput) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("personnel_project_assignments")
        .update({ 
          status: "unassigned",
          unassigned_at: new Date().toISOString(),
          unassigned_by: user?.id || null,
          unassigned_reason: reason,
          unassigned_notes: notes || null,
        })
        .eq("id", assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-project-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-with-assets"] });
      toast.success("Personnel unassigned from project");
    },
    onError: () => {
      toast.error("Failed to unassign personnel");
    },
  });
}

// Legacy: Remove personnel from a project (soft delete by changing status)
// Kept for backwards compatibility but prefer useUnassignPersonnelFromProject
export function useRemovePersonnelFromProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("personnel_project_assignments")
        .update({ 
          status: "removed",
          unassigned_at: new Date().toISOString(),
          unassigned_by: user?.id || null,
        })
        .eq("id", assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-project-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-with-assets"] });
      toast.success("Personnel removed from project");
    },
    onError: () => {
      toast.error("Failed to remove personnel");
    },
  });
}

// Bulk remove multiple personnel from a project
export function useBulkRemovePersonnelFromProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("personnel_project_assignments")
        .update({ 
          status: "removed",
          unassigned_at: new Date().toISOString(),
          unassigned_by: user?.id || null,
        })
        .in("id", assignmentIds);

      if (error) throw error;
      return { count: assignmentIds.length };
    },
    onSuccess: ({ count }) => {
      queryClient.invalidateQueries({ queryKey: ["personnel-project-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-with-assets"] });
      toast.success(`${count} personnel removed from project`);
    },
    onError: () => {
      toast.error("Failed to remove personnel");
    },
  });
}

// Get all projects assigned to a specific personnel member (includes rate bracket info)
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
          rate_bracket_id,
          created_at,
          updated_at,
          project_rate_brackets (
            id,
            name,
            bill_rate,
            overtime_multiplier
          ),
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
        project_rate_brackets: RateBracketInfo | null;
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


// Resend assignment SMS notification
export function useResendAssignmentSMS() {
  return useMutation({
    mutationFn: async ({
      personnelId,
      projectId,
      assignmentId,
      scheduledDate,
      scheduledStartTime
    }: {
      personnelId: string;
      projectId: string;
      assignmentId?: string;
      scheduledDate?: string;
      scheduledStartTime?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('send-assignment-sms', {
        body: {
          personnelId,
          projectId,
          assignmentId,
          scheduledDate,
          scheduledStartTime,
          force: true
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.skipped) {
        toast.info(data.reason || "SMS was already sent");
      } else {
        toast.success("Assignment SMS sent successfully");
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to send SMS: ${error.message}`);
    },
  });
}
