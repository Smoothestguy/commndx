import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  DashboardLayout,
  DashboardWidget,
  DashboardTheme,
  DEFAULT_LAYOUT,
  DEFAULT_WIDGETS,
  DEFAULT_THEME,
} from "@/components/dashboard/widgets/types";
import type { Json } from "@/integrations/supabase/types";

export interface DashboardConfiguration {
  id: string;
  user_id: string;
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  theme: DashboardTheme;
  created_at: string;
  updated_at: string;
}

export function useDashboardConfig() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: config,
    isLoading: queryLoading,
    isFetching,
    error,
    isSuccess,
  } = useQuery({
    queryKey: ["dashboard-config", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("dashboard_configurations")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching dashboard config:", error);
        throw error;
      }

      if (!data) {
        return null;
      }

      // Parse JSONB fields with proper type casting
      return {
        ...data,
        layout: data.layout as unknown as DashboardLayout,
        widgets: data.widgets as unknown as DashboardWidget[],
        theme: data.theme as unknown as DashboardTheme,
      } as DashboardConfiguration;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });

  // Consider loading if:
  // 1. Auth is still initializing, OR
  // 2. Query is actively loading/fetching, OR
  // 3. User exists but query hasn't completed successfully yet (initial load)
  const isLoading =
    authLoading || queryLoading || isFetching || (!!user?.id && !isSuccess);

  const updateConfigMutation = useMutation({
    mutationFn: async (
      updates: Partial<
        Pick<DashboardConfiguration, "layout" | "widgets" | "theme">
      >
    ) => {
      if (!user?.id) throw new Error("User not authenticated");

      const { data: existing } = await supabase
        .from("dashboard_configurations")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      // Convert to JSON-compatible format
      const jsonUpdates: Record<string, Json | string> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.layout)
        jsonUpdates.layout = updates.layout as unknown as Json;
      if (updates.widgets)
        jsonUpdates.widgets = updates.widgets as unknown as Json;
      if (updates.theme) jsonUpdates.theme = updates.theme as unknown as Json;

      if (existing) {
        // Update existing config
        const { error } = await supabase
          .from("dashboard_configurations")
          .update(jsonUpdates)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Insert new config
        const { error } = await supabase
          .from("dashboard_configurations")
          .insert({
            user_id: user.id,
            layout: (updates.layout ?? DEFAULT_LAYOUT) as unknown as Json,
            widgets: (updates.widgets ?? DEFAULT_WIDGETS) as unknown as Json,
            theme: (updates.theme ?? DEFAULT_THEME) as unknown as Json,
          });

        if (error) throw error;
      }
    },
    onMutate: async (updates) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["dashboard-config", user?.id],
      });

      // Snapshot the previous value
      const previousConfig =
        queryClient.getQueryData<DashboardConfiguration | null>([
          "dashboard-config",
          user?.id,
        ]);

      // Optimistically update the cache
      queryClient.setQueryData<DashboardConfiguration | null>(
        ["dashboard-config", user?.id],
        (old) => {
          if (!old) {
            // If no existing config, create one with defaults merged with updates
            return {
              id: "temp",
              user_id: user?.id || "",
              layout: updates.layout ?? DEFAULT_LAYOUT,
              widgets: updates.widgets ?? DEFAULT_WIDGETS,
              theme: updates.theme ?? DEFAULT_THEME,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          }
          return {
            ...old,
            ...updates,
            updated_at: new Date().toISOString(),
          };
        }
      );

      // Return context with the previous value
      return { previousConfig };
    },
    onError: (error, _updates, context) => {
      // Roll back on error
      if (context?.previousConfig !== undefined) {
        queryClient.setQueryData(
          ["dashboard-config", user?.id],
          context.previousConfig
        );
      }
      console.error("Error updating dashboard config:", error);
      toast.error("Failed to save dashboard configuration");
    },
    onSettled: () => {
      // Refetch after error or success to ensure consistency
      queryClient.invalidateQueries({
        queryKey: ["dashboard-config", user?.id],
      });
    },
  });

  const resetToDefaultMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("dashboard_configurations")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["dashboard-config", user?.id],
      });
      toast.success("Dashboard reset to default");
    },
    onError: (error) => {
      console.error("Error resetting dashboard config:", error);
      toast.error("Failed to reset dashboard");
    },
  });

  // Get active configuration with defaults
  const activeLayout = config?.layout ?? DEFAULT_LAYOUT;
  const activeWidgets = config?.widgets ?? DEFAULT_WIDGETS;
  const activeTheme = config?.theme ?? DEFAULT_THEME;

  return {
    config,
    isLoading,
    error,
    activeLayout,
    activeWidgets,
    activeTheme,
    updateConfig: updateConfigMutation.mutate,
    updateConfigAsync: updateConfigMutation.mutateAsync,
    isUpdating: updateConfigMutation.isPending,
    resetToDefault: resetToDefaultMutation.mutate,
    isResetting: resetToDefaultMutation.isPending,
    hasCustomConfig: !!config,
  };
}
