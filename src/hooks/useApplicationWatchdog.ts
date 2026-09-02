import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WatchdogSettings {
  id: number;
  enabled: boolean;
  auto_fix_enabled: boolean;
  auto_recovery_sms_enabled: boolean;
  cooldown_hours: number;
  alert_phone: string | null;
  alert_email: string | null;
  last_run_at: string | null;
}

export interface WatchdogIncident {
  id: string;
  job_posting_id: string | null;
  form_template_id: string | null;
  signature: string;
  event_type: string | null;
  stage: string | null;
  field_id: string | null;
  error_code: string | null;
  sample_message: string | null;
  diagnosis: string | null;
  recommended_action: Record<string, unknown> | null;
  severity: string;
  status: string;
  event_count: number;
  session_count: number;
  first_seen: string;
  last_seen: string;
}

export interface WatchdogAction {
  id: string;
  incident_id: string | null;
  action_type: string;
  target: Record<string, unknown> | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  undone_at: string | null;
  created_at: string;
}

export function useWatchdogSettings() {
  return useQuery({
    queryKey: ["watchdog-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("watchdog_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data as WatchdogSettings | null;
    },
  });
}

export function useUpdateWatchdogSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<WatchdogSettings>) => {
      const { error } = await supabase
        .from("watchdog_settings")
        .update(patch)
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchdog-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useWatchdogIncidents(statuses: string[] = ["open", "auto_fixed", "escalated"]) {
  return useQuery({
    queryKey: ["watchdog-incidents", statuses],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("watchdog_incidents")
        .select("*")
        .in("status", statuses)
        .order("last_seen", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as WatchdogIncident[];
    },
    refetchInterval: 60_000,
  });
}

/** Open/escalated incident counts per job posting, for posting badges. */
export function useWatchdogPostingAlerts() {
  return useQuery({
    queryKey: ["watchdog-posting-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("watchdog_incidents")
        .select("job_posting_id, severity, status")
        .in("status", ["open", "escalated"]);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of data ?? []) {
        const id = (row as { job_posting_id: string | null }).job_posting_id;
        if (!id) continue;
        map[id] = (map[id] ?? 0) + 1;
      }
      return map;
    },
    refetchInterval: 120_000,
  });
}

export function useWatchdogActions(incidentId?: string) {
  return useQuery({
    queryKey: ["watchdog-actions", incidentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("watchdog_actions")
        .select("*")
        .eq("incident_id", incidentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WatchdogAction[];
    },
    enabled: !!incidentId,
  });
}

export function useSetIncidentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "resolved" | "ignored" | "open" }) => {
      const { error } = await supabase
        .from("watchdog_incidents")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchdog-incidents"] });
      qc.invalidateQueries({ queryKey: ["watchdog-posting-alerts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Restores the template snapshot captured before an auto-fix was applied. */
export function useUndoWatchdogAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (incidentId: string) => {
      const { data: actions, error } = await supabase
        .from("watchdog_actions")
        .select("*")
        .eq("incident_id", incidentId)
        .is("undone_at", null)
        .in("action_type", ["set_template_setting", "make_field_optional"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const action = actions?.[0] as unknown as WatchdogAction | undefined;
      if (!action) throw new Error("Nothing to undo for this incident");

      const templateId = (action.target as { template_id?: string } | null)?.template_id;
      if (!templateId) throw new Error("Action has no template to restore");

      const before = (action.before ?? {}) as { settings?: unknown; fields?: unknown };
      const patch: Record<string, unknown> = {};
      if (before.settings !== undefined) patch.settings = before.settings;
      if (before.fields !== undefined) patch.fields = before.fields;
      if (!Object.keys(patch).length) throw new Error("No snapshot stored for this action");

      const { error: upErr } = await supabase
        .from("application_form_templates")
        .update(patch as never)
        .eq("id", templateId);
      if (upErr) throw upErr;

      await supabase
        .from("watchdog_actions")
        .update({ undone_at: new Date().toISOString() })
        .eq("id", action.id);

      await supabase
        .from("watchdog_incidents")
        .update({ status: "open" })
        .eq("id", incidentId);
    },
    onSuccess: () => {
      toast.success("Change reverted");
      qc.invalidateQueries({ queryKey: ["watchdog-incidents"] });
      qc.invalidateQueries({ queryKey: ["watchdog-actions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRunWatchdog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("application-watchdog", {
        body: { force: true },
      });
      if (error) throw error;
      return data as {
        incidents_created: number;
        incidents_updated: number;
        actions_taken: number;
        escalated: number;
        paused?: string;
      };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["watchdog-incidents"] });
      qc.invalidateQueries({ queryKey: ["watchdog-settings"] });
      qc.invalidateQueries({ queryKey: ["watchdog-posting-alerts"] });
      if (data?.paused) {
        toast.warning(`Watchdog paused: ${data.paused}`);
      } else {
        toast.success(
          `Scan complete — ${data?.incidents_created ?? 0} new, ${data?.actions_taken ?? 0} auto-fixed`
        );
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
