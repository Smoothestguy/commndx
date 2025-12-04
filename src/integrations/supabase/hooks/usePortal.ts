import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Reimbursement, PersonnelNotification, PersonnelNotificationPreferences, PersonnelInvitation } from "@/types/portal";

// Get current personnel record for logged-in user
export function useCurrentPersonnel() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["current-personnel", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("personnel")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}

// Get time entries for current personnel
export function usePersonnelTimeEntries(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["personnel-time-entries", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];
      
      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          *,
          project:projects(id, name)
        `)
        .eq("personnel_id", personnelId)
        .order("entry_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!personnelId,
  });
}

// Get project assignments for current personnel
export function usePersonnelAssignments(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["personnel-assignments", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];
      
      const { data, error } = await supabase
        .from("personnel_project_assignments")
        .select(`
          *,
          project:projects(id, name, status, start_date, end_date)
        `)
        .eq("personnel_id", personnelId)
        .eq("status", "active");
      
      if (error) throw error;
      return data;
    },
    enabled: !!personnelId,
  });
}

// Get reimbursements for current personnel
export function usePersonnelReimbursements(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["personnel-reimbursements", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];
      
      const { data, error } = await supabase
        .from("reimbursements")
        .select(`
          *,
          project:projects(id, name)
        `)
        .eq("personnel_id", personnelId)
        .order("submitted_at", { ascending: false });
      
      if (error) throw error;
      return data as Reimbursement[];
    },
    enabled: !!personnelId,
  });
}

// Add reimbursement
export function useAddReimbursement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (reimbursement: Omit<Reimbursement, "id" | "created_at" | "updated_at" | "submitted_at" | "reviewed_by" | "reviewed_at" | "paid_at">) => {
      const { data, error } = await supabase
        .from("reimbursements")
        .insert(reimbursement)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["personnel-reimbursements", variables.personnel_id] });
      toast.success("Reimbursement submitted successfully");
    },
    onError: (error) => {
      toast.error("Failed to submit reimbursement: " + error.message);
    },
  });
}

// Get notifications for current personnel
export function usePersonnelNotifications(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["personnel-notifications", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];
      
      const { data, error } = await supabase
        .from("personnel_notifications")
        .select("*")
        .eq("personnel_id", personnelId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as PersonnelNotification[];
    },
    enabled: !!personnelId,
  });
}

// Mark notification as read
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, personnelId }: { id: string; personnelId: string }) => {
      const { error } = await supabase
        .from("personnel_notifications")
        .update({ is_read: true })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["personnel-notifications", variables.personnelId] });
    },
  });
}

// Get notification preferences
export function usePersonnelNotificationPreferences(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["personnel-notification-preferences", personnelId],
    queryFn: async () => {
      if (!personnelId) return null;
      
      const { data, error } = await supabase
        .from("personnel_notification_preferences")
        .select("*")
        .eq("personnel_id", personnelId)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data as PersonnelNotificationPreferences | null;
    },
    enabled: !!personnelId,
  });
}

// Update notification preferences
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ personnelId, preferences }: { personnelId: string; preferences: Partial<PersonnelNotificationPreferences> }) => {
      const { data, error } = await supabase
        .from("personnel_notification_preferences")
        .upsert({
          personnel_id: personnelId,
          ...preferences,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["personnel-notification-preferences", variables.personnelId] });
      toast.success("Preferences updated");
    },
    onError: (error) => {
      toast.error("Failed to update preferences: " + error.message);
    },
  });
}

// ============ Admin hooks for invitations ============

// Get all personnel invitations (admin)
export function usePersonnelInvitations() {
  return useQuery({
    queryKey: ["personnel-invitations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel_invitations")
        .select(`
          *,
          personnel:personnel(id, first_name, last_name, email)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as PersonnelInvitation[];
    },
  });
}

// Send portal invitation
export function useSendPortalInvitation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ personnelId, email, personnelName }: { personnelId: string; email: string; personnelName: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      // Create the invitation record
      const { data, error } = await supabase
        .from("personnel_invitations")
        .insert({
          personnel_id: personnelId,
          email,
          invited_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Send the invitation email via edge function
      const { error: emailError } = await supabase.functions.invoke("send-portal-invitation", {
        body: {
          personnelId,
          personnelName,
          email,
          token: data.token,
        },
      });
      
      if (emailError) {
        console.error("Failed to send invitation email:", emailError);
        throw new Error("Invitation created but failed to send email");
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-invitations"] });
      toast.success("Portal invitation email sent");
    },
    onError: (error) => {
      toast.error("Failed to send invitation: " + error.message);
    },
  });
}

// Get invitation by token (public)
export function useInvitationByToken(token: string | undefined) {
  return useQuery({
    queryKey: ["personnel-invitation-token", token],
    queryFn: async () => {
      if (!token) return null;
      
      const { data, error } = await supabase
        .from("personnel_invitations")
        .select(`
          *,
          personnel:personnel(id, first_name, last_name, email)
        `)
        .eq("token", token)
        .eq("status", "pending")
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data as PersonnelInvitation | null;
    },
    enabled: !!token,
  });
}

// ============ Admin hooks for reimbursements ============

// Get all reimbursements (admin)
export function useAllReimbursements(status?: string) {
  return useQuery({
    queryKey: ["all-reimbursements", status],
    queryFn: async () => {
      let query = supabase
        .from("reimbursements")
        .select(`
          *,
          project:projects(id, name),
          personnel:personnel(id, first_name, last_name)
        `)
        .order("submitted_at", { ascending: false });
      
      if (status && status !== "all") {
        query = query.eq("status", status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// Update reimbursement status (admin)
export function useUpdateReimbursementStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const updateData: Record<string, unknown> = { status };
      
      if (status === "approved" || status === "rejected") {
        updateData.reviewed_by = user?.id;
        updateData.reviewed_at = new Date().toISOString();
      }
      
      if (status === "paid") {
        updateData.paid_at = new Date().toISOString();
      }
      
      if (notes) {
        updateData.notes = notes;
      }
      
      const { error } = await supabase
        .from("reimbursements")
        .update(updateData)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-reimbursements"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-reimbursements"] });
      toast.success("Reimbursement status updated");
    },
    onError: (error) => {
      toast.error("Failed to update status: " + error.message);
    },
  });
}

// Send notification to personnel (admin)
export function useSendPersonnelNotification() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (notification: { personnel_id: string; title: string; message: string; notification_type: string; metadata?: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from("personnel_notifications")
        .insert([{
          personnel_id: notification.personnel_id,
          title: notification.title,
          message: notification.message,
          notification_type: notification.notification_type,
          metadata: (notification.metadata || {}) as Record<string, unknown>,
        }] as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-notifications"] });
      toast.success("Notification sent");
    },
    onError: (error) => {
      toast.error("Failed to send notification: " + error.message);
    },
  });
}
