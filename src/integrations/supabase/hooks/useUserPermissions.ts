import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UserPermission {
  id: string;
  user_id: string;
  module: string;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export const MODULES = [
  // Core
  { key: "products", label: "Products", category: "Core" },
  { key: "customers", label: "Customers", category: "Core" },
  { key: "projects", label: "Projects", category: "Core" },
  { key: "personnel", label: "Personnel", category: "Core" },
  { key: "vendors", label: "Vendors", category: "Core" },
  // Sales
  { key: "estimates", label: "Estimates", category: "Sales" },
  { key: "job_orders", label: "Job Orders", category: "Sales" },
  { key: "purchase_orders", label: "Purchase Orders", category: "Sales" },
  { key: "invoices", label: "Invoices", category: "Sales" },
  // Operations
  { key: "time_tracking", label: "Time Tracking", category: "Operations" },
  { key: "project_assignments", label: "Project Assignments", category: "Operations" },
  { key: "messages", label: "Messages", category: "Operations" },
  // CRM
  { key: "activities", label: "Activities", category: "CRM" },
  { key: "appointments", label: "Appointments", category: "CRM" },
  { key: "tasks", label: "Tasks", category: "CRM" },
  { key: "insurance_claims", label: "Insurance Claims", category: "CRM" },
  // Roofing Ops
  { key: "inspections", label: "Inspections", category: "Roofing" },
  { key: "measurements", label: "Measurements", category: "Roofing" },
  { key: "weather", label: "Weather", category: "Roofing" },
  { key: "warranties", label: "Warranties", category: "Roofing" },
] as const;

export type ModuleKey = typeof MODULES[number]["key"];

export function useUserPermissions(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-permissions", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", userId);

      if (error) throw error;
      return data as UserPermission[];
    },
    enabled: !!userId,
  });
}

export function useUpdateUserPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      permissions,
    }: {
      userId: string;
      permissions: Array<{
        module: string;
        can_view: boolean;
        can_add: boolean;
        can_edit: boolean;
        can_delete: boolean;
      }>;
    }) => {
      // Delete existing permissions for this user
      const { error: deleteError } = await supabase
        .from("user_permissions")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      // Insert new permissions (only non-empty ones)
      const permissionsToInsert = permissions
        .filter(p => p.can_view || p.can_add || p.can_edit || p.can_delete)
        .map(p => ({
          user_id: userId,
          module: p.module,
          can_view: p.can_view,
          can_add: p.can_add,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
        }));

      if (permissionsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("user_permissions")
          .insert(permissionsToInsert);

        if (insertError) throw insertError;
      }

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-permissions", variables.userId] });
      toast.success("Permissions updated successfully");
    },
    onError: (error) => {
      console.error("Error updating permissions:", error);
      toast.error("Failed to update permissions");
    },
  });
}

export function useMyPermissions() {
  return useQuery({
    queryKey: ["my-permissions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      return data as UserPermission[];
    },
  });
}
