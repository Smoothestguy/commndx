import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useAuth } from "@/contexts/AuthContext";

interface Session {
  id: string;
  user_id: string;
  session_start: string;
  session_end: string | null;
  total_active_seconds: number;
  total_idle_seconds: number;
  is_active: boolean;
  clock_in_type: string;
}

interface UpdateSessionParams {
  sessionId: string;
  sessionStart: string;
  sessionEnd: string | null;
  originalSession: Session;
}

interface CreateSessionParams {
  userId: string;
  userEmail: string;
  sessionStart: string;
  sessionEnd: string | null;
}

export function useSessionEdit() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();
  const { user } = useAuth();

  const calculateActiveSeconds = (
    start: string,
    end: string | null,
    idleSeconds: number = 0
  ): number => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const totalSeconds = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);
    return Math.max(0, totalSeconds - idleSeconds);
  };

  const updateSessionMutation = useMutation({
    mutationFn: async ({ sessionId, sessionStart, sessionEnd, originalSession }: UpdateSessionParams) => {
      const isActive = sessionEnd === null;
      const totalActiveSeconds = calculateActiveSeconds(
        sessionStart,
        sessionEnd,
        originalSession.total_idle_seconds
      );

      const { data, error } = await supabase
        .from("user_work_sessions")
        .update({
          session_start: sessionStart,
          session_end: sessionEnd,
          is_active: isActive,
          total_active_seconds: totalActiveSeconds,
          clock_in_type: "admin_edit",
        })
        .eq("id", sessionId)
        .select()
        .single();

      if (error) throw error;

      // Log to audit trail
      await logAction({
        actionType: "update",
        resourceType: "user_work_session",
        resourceId: sessionId,
        changesBefore: {
          session_start: originalSession.session_start,
          session_end: originalSession.session_end,
          total_active_seconds: originalSession.total_active_seconds,
          clock_in_type: originalSession.clock_in_type,
        },
        changesAfter: {
          session_start: sessionStart,
          session_end: sessionEnd,
          total_active_seconds: totalActiveSeconds,
          clock_in_type: "admin_edit",
        },
        metadata: {
          edit_type: "session_time_adjustment",
          target_user_id: originalSession.user_id,
          admin_user_id: user?.id,
        },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-history"] });
      queryClient.invalidateQueries({ queryKey: ["session-stats"] });
      queryClient.invalidateQueries({ queryKey: ["today-sessions"] });
      toast({
        title: "Session updated",
        description: "Session times have been updated successfully.",
      });
    },
    onError: (error) => {
      console.error("Error updating session:", error);
      toast({
        title: "Error",
        description: "Failed to update session times.",
        variant: "destructive",
      });
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: async ({ userId, userEmail, sessionStart, sessionEnd }: CreateSessionParams) => {
      const isActive = sessionEnd === null;
      const totalActiveSeconds = calculateActiveSeconds(sessionStart, sessionEnd, 0);

      const { data, error } = await supabase
        .from("user_work_sessions")
        .insert({
          user_id: userId,
          user_email: userEmail,
          session_start: sessionStart,
          session_end: sessionEnd,
          is_active: isActive,
          total_active_seconds: totalActiveSeconds,
          total_idle_seconds: 0,
          clock_in_type: "admin_manual",
        })
        .select()
        .single();

      if (error) throw error;

      // Log to audit trail
      await logAction({
        actionType: "create",
        resourceType: "user_work_session",
        resourceId: data.id,
        changesAfter: {
          session_start: sessionStart,
          session_end: sessionEnd,
          total_active_seconds: totalActiveSeconds,
          clock_in_type: "admin_manual",
        },
        metadata: {
          edit_type: "session_manual_add",
          target_user_id: userId,
          admin_user_id: user?.id,
        },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-history"] });
      queryClient.invalidateQueries({ queryKey: ["session-stats"] });
      queryClient.invalidateQueries({ queryKey: ["today-sessions"] });
      toast({
        title: "Session created",
        description: "New session has been added successfully.",
      });
    },
    onError: (error) => {
      console.error("Error creating session:", error);
      toast({
        title: "Error",
        description: "Failed to create session.",
        variant: "destructive",
      });
    },
  });

  return {
    updateSession: updateSessionMutation.mutate,
    createSession: createSessionMutation.mutateAsync,
    isUpdating: updateSessionMutation.isPending,
    isCreating: createSessionMutation.isPending,
  };
}
