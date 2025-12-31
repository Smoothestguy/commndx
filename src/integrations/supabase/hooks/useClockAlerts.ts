import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ClockAlert {
  id: string;
  personnel_id: string | null;
  project_id: string | null;
  time_entry_id: string | null;
  alert_type: "missed_clock_in" | "auto_clock_out" | "geofence_violation";
  alert_date: string;
  sent_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  personnel?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  project?: {
    id: string;
    name: string;
  };
}

export function useClockAlerts(options?: { 
  alertType?: string; 
  resolved?: boolean;
  personnelId?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["clock-alerts", options],
    queryFn: async () => {
      let query = supabase
        .from("clock_alerts")
        .select(`
          id,
          personnel_id,
          project_id,
          time_entry_id,
          alert_type,
          alert_date,
          sent_at,
          resolved_at,
          resolved_by,
          notes,
          metadata,
          personnel:personnel(id, first_name, last_name),
          project:projects(id, name)
        `)
        .order("sent_at", { ascending: false });

      if (options?.alertType) {
        query = query.eq("alert_type", options.alertType);
      }
      if (options?.resolved !== undefined) {
        if (options.resolved) {
          query = query.not("resolved_at", "is", null);
        } else {
          query = query.is("resolved_at", null);
        }
      }
      if (options?.personnelId) {
        query = query.eq("personnel_id", options.personnelId);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ClockAlert[];
    },
  });
}

export function useResolveClockAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ alertId, notes }: { alertId: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("clock_alerts")
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          notes,
        })
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clock-alerts"] });
      toast.success("Alert resolved");
    },
    onError: (error: Error) => {
      toast.error("Failed to resolve alert: " + error.message);
    },
  });
}

export function useClearClockBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ timeEntryId, notes }: { timeEntryId: string; notes?: string }) => {
      // Clear the block on the time entry
      const { error } = await supabase
        .from("time_entries")
        .update({
          clock_blocked_until: null,
        })
        .eq("id", timeEntryId);

      if (error) throw error;

      // Resolve any related alerts
      await supabase
        .from("clock_alerts")
        .update({
          resolved_at: new Date().toISOString(),
          notes,
        })
        .eq("time_entry_id", timeEntryId)
        .is("resolved_at", null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clock-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["time_entries"] });
      toast.success("Clock block cleared - personnel can now clock in");
    },
    onError: (error: Error) => {
      toast.error("Failed to clear block: " + error.message);
    },
  });
}

export function useBlockedTimeEntries(personnelId?: string) {
  return useQuery({
    queryKey: ["blocked-time-entries", personnelId],
    queryFn: async () => {
      const now = new Date().toISOString();
      
      let query = supabase
        .from("time_entries")
        .select(`
          id,
          personnel_id,
          project_id,
          clock_in_at,
          clock_out_at,
          auto_clocked_out,
          auto_clock_out_reason,
          clock_blocked_until,
          personnel:personnel(id, first_name, last_name),
          project:projects(id, name)
        `)
        .gt("clock_blocked_until", now);

      if (personnelId) {
        query = query.eq("personnel_id", personnelId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}
