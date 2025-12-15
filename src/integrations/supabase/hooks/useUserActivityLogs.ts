import { useQuery } from "@tanstack/react-query";
import { supabase } from "../client";
import type { AuditLog } from "./useAuditLogs";

interface UseUserActivityLogsOptions {
  userId?: string;
  personnelId?: string;
  vendorId?: string;
  limit?: number;
}

export const useUserActivityLogs = ({
  userId,
  personnelId,
  vendorId,
  limit = 50,
}: UseUserActivityLogsOptions) => {
  return useQuery({
    queryKey: ["user_activity_logs", userId, personnelId, vendorId, limit],
    queryFn: async () => {
      const logs: AuditLog[] = [];

      // Fetch logs by user_id if provided
      if (userId) {
        const { data: userLogs, error: userError } = await supabase
          .from("audit_logs")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (userError) throw userError;
        if (userLogs) logs.push(...(userLogs as AuditLog[]));
      }

      // Fetch logs related to personnel record
      if (personnelId) {
        const { data: personnelLogs, error: personnelError } = await supabase
          .from("audit_logs")
          .select("*")
          .eq("resource_type", "personnel")
          .eq("resource_id", personnelId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (personnelError) throw personnelError;
        if (personnelLogs) logs.push(...(personnelLogs as AuditLog[]));

        // Also fetch time entry logs for this personnel
        const { data: timeEntryLogs, error: timeError } = await supabase
          .from("audit_logs")
          .select("*")
          .eq("resource_type", "time_entry")
          .ilike("metadata->>personnel_id", personnelId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (!timeError && timeEntryLogs) {
          logs.push(...(timeEntryLogs as AuditLog[]));
        }
      }

      // Fetch logs related to vendor record
      if (vendorId) {
        const { data: vendorLogs, error: vendorError } = await supabase
          .from("audit_logs")
          .select("*")
          .eq("resource_type", "vendor")
          .eq("resource_id", vendorId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (vendorError) throw vendorError;
        if (vendorLogs) logs.push(...(vendorLogs as AuditLog[]));

        // Fetch purchase order logs for this vendor
        const { data: poLogs, error: poError } = await supabase
          .from("audit_logs")
          .select("*")
          .eq("resource_type", "purchase_order")
          .ilike("metadata->>vendor_id", vendorId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (!poError && poLogs) {
          logs.push(...(poLogs as AuditLog[]));
        }

        // Fetch vendor bill logs for this vendor
        const { data: billLogs, error: billError } = await supabase
          .from("audit_logs")
          .select("*")
          .eq("resource_type", "vendor_bill")
          .ilike("metadata->>vendor_id", vendorId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (!billError && billLogs) {
          logs.push(...(billLogs as AuditLog[]));
        }
      }

      // Deduplicate by id and sort by created_at
      const uniqueLogs = Array.from(
        new Map(logs.map((log) => [log.id, log])).values()
      ).sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return uniqueLogs.slice(0, limit);
    },
    enabled: !!(userId || personnelId || vendorId),
  });
};
