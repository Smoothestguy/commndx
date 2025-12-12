import { useQuery } from "@tanstack/react-query";
import { supabase } from "../client";

export interface AuditLog {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  resource_number: string | null;
  changes_before: Record<string, unknown> | null;
  changes_after: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
}

interface AuditLogFilters {
  userId?: string;
  userEmail?: string;
  actionType?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
  success?: boolean;
  search?: string;
}

export const useAuditLogs = (filters: AuditLogFilters = {}, limit = 100) => {
  return useQuery({
    queryKey: ["audit_logs", filters, limit],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (filters.userId) {
        query = query.eq("user_id", filters.userId);
      }
      if (filters.userEmail) {
        query = query.ilike("user_email", `%${filters.userEmail}%`);
      }
      if (filters.actionType) {
        query = query.eq("action_type", filters.actionType);
      }
      if (filters.resourceType) {
        query = query.eq("resource_type", filters.resourceType);
      }
      if (filters.resourceId) {
        query = query.eq("resource_id", filters.resourceId);
      }
      if (filters.startDate) {
        query = query.gte("created_at", filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte("created_at", filters.endDate);
      }
      if (filters.success !== undefined) {
        query = query.eq("success", filters.success);
      }
      if (filters.search) {
        query = query.or(
          `user_email.ilike.%${filters.search}%,resource_number.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as AuditLog[];
    },
  });
};

export const useAuditLogsForResource = (
  resourceType: string,
  resourceId: string | undefined
) => {
  return useQuery({
    queryKey: ["audit_logs", "resource", resourceType, resourceId],
    queryFn: async () => {
      if (!resourceId) return [];

      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("resource_type", resourceType)
        .eq("resource_id", resourceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: !!resourceId,
  });
};
