import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface UserDisplayPreferences {
  show_session_earnings: boolean;
}

export function useUserDisplayPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["user-display-preferences", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_display_preferences")
        .select("show_session_earnings")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const updatePreference = useMutation({
    mutationFn: async (updates: Partial<UserDisplayPreferences>) => {
      // Upsert: insert if not exists, update if exists
      const { error } = await supabase
        .from("user_display_preferences")
        .upsert(
          { user_id: user!.id, ...updates },
          { onConflict: "user_id" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["user-display-preferences", user?.id],
      });
    },
  });

  return {
    showSessionEarnings: preferences?.show_session_earnings ?? true,
    isLoading,
    updateShowSessionEarnings: (value: boolean) =>
      updatePreference.mutateAsync({ show_session_earnings: value }),
    isUpdating: updatePreference.isPending,
  };
}
