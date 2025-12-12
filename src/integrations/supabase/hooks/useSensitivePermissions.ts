import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SensitivePermission {
  id: string;
  user_id: string;
  can_view_billing_rates: boolean;
  can_view_cost_rates: boolean;
  can_view_margins: boolean;
  can_view_personnel_pay_rates: boolean;
  created_at: string;
  updated_at: string;
}

export const SENSITIVE_PERMISSIONS = [
  {
    key: "can_view_billing_rates",
    label: "Billing Rates",
    description: "View what customers are charged (e.g., $35/hr shown on estimates/invoices)"
  },
  {
    key: "can_view_cost_rates",
    label: "Cost Rates",
    description: "View vendor/material costs on purchase orders and bills"
  },
  {
    key: "can_view_margins",
    label: "Profit Margins",
    description: "View markup percentages and profit calculations"
  },
  {
    key: "can_view_personnel_pay_rates",
    label: "Personnel Pay Rates",
    description: "View hourly pay rates for team members (e.g., $15/hr)"
  },
] as const;

export type SensitivePermissionKey = typeof SENSITIVE_PERMISSIONS[number]["key"];

export function useSensitivePermissions(userId: string | undefined) {
  return useQuery({
    queryKey: ["sensitive-permissions", userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from("user_sensitive_permissions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return data as SensitivePermission | null;
    },
    enabled: !!userId,
  });
}

export function useUpdateSensitivePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      permissions,
    }: {
      userId: string;
      permissions: {
        can_view_billing_rates: boolean;
        can_view_cost_rates: boolean;
        can_view_margins: boolean;
        can_view_personnel_pay_rates: boolean;
      };
    }) => {
      const { error } = await supabase
        .from("user_sensitive_permissions")
        .upsert({
          user_id: userId,
          ...permissions,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sensitive-permissions", variables.userId] });
    },
    onError: (error) => {
      console.error("Error updating sensitive permissions:", error);
      toast.error("Failed to update sensitive data permissions");
    },
  });
}

export function useMySensitivePermissions() {
  return useQuery({
    queryKey: ["my-sensitive-permissions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("user_sensitive_permissions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as SensitivePermission | null;
    },
  });
}
