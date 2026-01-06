import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CombinedActivity {
  id: string;
  created_at: string;
  source: "audit" | "session";
  // Audit log fields
  action_type?: string;
  resource_type?: string;
  resource_id?: string | null;
  resource_number?: string | null;
  changes_before?: Record<string, unknown> | null;
  changes_after?: Record<string, unknown> | null;
  success?: boolean;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
  // Session activity fields
  activity_type?: string;
  route?: string;
  action_name?: string;
  context?: Record<string, unknown>;
}

interface UsePersonalActivityHistoryOptions {
  actionType?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  includeSession?: boolean;
}

export const usePersonalActivityHistory = (options: UsePersonalActivityHistoryOptions = {}) => {
  const { user } = useAuth();
  const { 
    actionType, 
    resourceType, 
    startDate, 
    endDate, 
    limit = 100,
    includeSession = true 
  } = options;

  return useQuery({
    queryKey: ["personal_activity_history", user?.id, actionType, resourceType, startDate, endDate, limit, includeSession],
    queryFn: async () => {
      if (!user?.id) return [];

      const activities: CombinedActivity[] = [];

      // Fetch audit logs
      let auditQuery = supabase
        .from("audit_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (actionType) {
        auditQuery = auditQuery.eq("action_type", actionType);
      }
      if (resourceType) {
        auditQuery = auditQuery.eq("resource_type", resourceType);
      }
      if (startDate) {
        auditQuery = auditQuery.gte("created_at", startDate);
      }
      if (endDate) {
        auditQuery = auditQuery.lte("created_at", endDate);
      }

      const { data: auditData, error: auditError } = await auditQuery;

      if (auditError) {
        console.error("Error fetching audit logs:", auditError);
      } else if (auditData) {
        auditData.forEach(log => {
          activities.push({
            id: log.id,
            created_at: log.created_at,
            source: "audit",
            action_type: log.action_type,
            resource_type: log.resource_type,
            resource_id: log.resource_id,
            resource_number: log.resource_number,
            changes_before: log.changes_before as Record<string, unknown> | null,
            changes_after: log.changes_after as Record<string, unknown> | null,
            success: log.success,
            error_message: log.error_message,
            metadata: log.metadata as Record<string, unknown> | null,
          });
        });
      }

      // Fetch session activities if enabled
      if (includeSession) {
        let sessionQuery = supabase
          .from("session_activity_log")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (startDate) {
          sessionQuery = sessionQuery.gte("created_at", startDate);
        }
        if (endDate) {
          sessionQuery = sessionQuery.lte("created_at", endDate);
        }

        const { data: sessionData, error: sessionError } = await sessionQuery;

        if (sessionError) {
          console.error("Error fetching session activities:", sessionError);
        } else if (sessionData) {
        sessionData.forEach(activity => {
            activities.push({
              id: activity.id,
              created_at: activity.created_at,
              source: "session",
              activity_type: activity.activity_type,
              route: activity.route,
              action_name: activity.action_name,
              context: activity.metadata as Record<string, unknown>,
            });
          });
        }
      }

      // Sort all activities by created_at descending
      activities.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Return limited results
      return activities.slice(0, limit);
    },
    enabled: !!user?.id,
  });
};

export const useRecentActivitySummary = (limit = 5) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["recent_activity_summary", user?.id, limit],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Error fetching recent activity:", error);
        return [];
      }

      return data.map(log => ({
        id: log.id,
        created_at: log.created_at,
        source: "audit" as const,
        action_type: log.action_type,
        resource_type: log.resource_type,
        resource_id: log.resource_id,
        resource_number: log.resource_number,
        changes_before: log.changes_before as Record<string, unknown> | null,
        changes_after: log.changes_after as Record<string, unknown> | null,
        success: log.success,
        error_message: log.error_message,
        metadata: log.metadata as Record<string, unknown> | null,
      }));
    },
    enabled: !!user?.id,
  });
};
