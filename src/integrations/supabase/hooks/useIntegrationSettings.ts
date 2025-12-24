import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

interface IntegrationSetting {
  id: string;
  setting_key: string;
  setting_value: Json;
  created_at: string;
  updated_at: string;
}

/**
 * Hook to get a specific integration setting by key
 */
export function useIntegrationSetting(settingKey: string) {
  return useQuery({
    queryKey: ["integration-setting", settingKey],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("integration_settings")
          .select("*")
          .eq("setting_key", settingKey)
          .maybeSingle();

        if (error) {
          console.error("Error fetching integration setting:", error);
          return null;
        }
        return data as IntegrationSetting | null;
      } catch (err) {
        console.error("Exception fetching integration setting:", err);
        return null;
      }
    },
    retry: false,
  });
}

/**
 * Hook to get the auto-sync personnel to QB setting
 */
export function useAutoSyncPersonnelToQB() {
  const query = useIntegrationSetting("auto_sync_personnel_to_qb");
  
  return {
    ...query,
    isEnabled: (query.data?.setting_value as { enabled?: boolean } | null)?.enabled ?? false,
  };
}

/**
 * Hook to update an integration setting
 */
export function useUpdateIntegrationSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      settingKey,
      settingValue,
    }: {
      settingKey: string;
      settingValue: Json;
    }) => {
      const { data, error } = await supabase
        .from("integration_settings")
        .update({ setting_value: settingValue })
        .eq("setting_key", settingKey)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["integration-setting", variables.settingKey],
      });
    },
    onError: (error: Error) => {
      console.error("Failed to update integration setting:", error);
      toast.error("Failed to update setting");
    },
  });
}

/**
 * Hook to toggle auto-sync personnel to QB
 */
export function useToggleAutoSyncPersonnelToQB() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data, error } = await supabase
        .from("integration_settings")
        .update({ setting_value: { enabled } as Json })
        .eq("setting_key", "auto_sync_personnel_to_qb")
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["integration-setting", "auto_sync_personnel_to_qb"],
      });
    },
    onError: (error: Error) => {
      console.error("Failed to toggle auto-sync setting:", error);
      toast.error("Failed to update setting");
    },
  });
}
