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
  { 
    key: "products", 
    label: "Products", 
    category: "Core",
    description: "Manage products and services catalog",
    permissions: {
      can_view: "View products list and pricing",
      can_add: "Add new products to catalog",
      can_edit: "Update product details and pricing",
      can_delete: "Remove products from catalog"
    }
  },
  { 
    key: "customers", 
    label: "Customers", 
    category: "Core",
    description: "Manage customer information",
    permissions: {
      can_view: "View customer list and details",
      can_add: "Add new customers",
      can_edit: "Update customer information",
      can_delete: "Remove customers"
    }
  },
  { 
    key: "projects", 
    label: "Projects", 
    category: "Core",
    description: "Manage projects and job sites",
    permissions: {
      can_view: "View projects and job details",
      can_add: "Create new projects",
      can_edit: "Update project information",
      can_delete: "Remove projects"
    }
  },
  { 
    key: "personnel", 
    label: "Personnel", 
    category: "Core",
    description: "Manage team members and contractors",
    permissions: {
      can_view: "View personnel list and basic info (excludes pay rates)",
      can_add: "Add new team members",
      can_edit: "Update personnel information",
      can_delete: "Remove personnel records"
    }
  },
  { 
    key: "vendors", 
    label: "Vendors", 
    category: "Core",
    description: "Manage vendor/supplier relationships",
    permissions: {
      can_view: "View vendor list and details",
      can_add: "Add new vendors",
      can_edit: "Update vendor information",
      can_delete: "Remove vendors"
    }
  },
  // Sales
  { 
    key: "estimates", 
    label: "Estimates", 
    category: "Sales",
    description: "Create and manage customer estimates",
    permissions: {
      can_view: "View estimates and pricing",
      can_add: "Create new estimates",
      can_edit: "Modify existing estimates",
      can_delete: "Remove estimates"
    }
  },
  { 
    key: "job_orders", 
    label: "Job Orders", 
    category: "Sales",
    description: "Manage approved work orders",
    permissions: {
      can_view: "View job orders and work scopes",
      can_add: "Create job orders from estimates",
      can_edit: "Update job order details",
      can_delete: "Remove job orders"
    }
  },
  { 
    key: "change_orders", 
    label: "Change Orders", 
    category: "Sales",
    description: "Manage project change orders",
    permissions: {
      can_view: "View change orders and pricing",
      can_add: "Create new change orders",
      can_edit: "Modify draft change orders",
      can_delete: "Delete draft change orders"
    }
  },
  { 
    key: "purchase_orders", 
    label: "Purchase Orders", 
    category: "Sales",
    description: "Manage vendor purchase orders",
    permissions: {
      can_view: "View POs and vendor costs",
      can_add: "Create new purchase orders",
      can_edit: "Modify purchase orders",
      can_delete: "Remove purchase orders"
    }
  },
  { 
    key: "invoices", 
    label: "Invoices", 
    category: "Sales",
    description: "Manage customer invoices",
    permissions: {
      can_view: "View invoices and payment status",
      can_add: "Create new invoices",
      can_edit: "Update invoice details",
      can_delete: "Remove invoices"
    }
  },
  // Operations
  { 
    key: "time_tracking", 
    label: "Time Tracking", 
    category: "Operations",
    description: "Track employee hours and labor",
    permissions: {
      can_view: "View time entries for assigned projects",
      can_add: "Submit time entries",
      can_edit: "Modify own time entries",
      can_delete: "Remove time entries"
    }
  },
  { 
    key: "project_assignments", 
    label: "Project Assignments", 
    category: "Operations",
    description: "Assign personnel to projects",
    permissions: {
      can_view: "View project assignments",
      can_add: "Assign personnel to projects",
      can_edit: "Update assignments",
      can_delete: "Remove assignments"
    }
  },
  { 
    key: "messages", 
    label: "Messages", 
    category: "Operations",
    description: "Send SMS and notifications",
    permissions: {
      can_view: "View message history",
      can_add: "Send new messages",
      can_edit: "N/A",
      can_delete: "N/A"
    }
  },
  // CRM
  { 
    key: "activities", 
    label: "Activities", 
    category: "CRM",
    description: "Track customer interactions",
    permissions: {
      can_view: "View activity history",
      can_add: "Log new activities",
      can_edit: "Update activity records",
      can_delete: "Remove activities"
    }
  },
  { 
    key: "appointments", 
    label: "Appointments", 
    category: "CRM",
    description: "Schedule customer appointments",
    permissions: {
      can_view: "View appointment calendar",
      can_add: "Schedule appointments",
      can_edit: "Reschedule appointments",
      can_delete: "Cancel appointments"
    }
  },
  { 
    key: "tasks", 
    label: "Tasks", 
    category: "CRM",
    description: "Manage to-do items and tasks",
    permissions: {
      can_view: "View task list",
      can_add: "Create new tasks",
      can_edit: "Update task status",
      can_delete: "Remove tasks"
    }
  },
  { 
    key: "insurance_claims", 
    label: "Insurance Claims", 
    category: "CRM",
    description: "Track insurance claim progress",
    permissions: {
      can_view: "View claims and status",
      can_add: "File new claims",
      can_edit: "Update claim information",
      can_delete: "Remove claims"
    }
  },
  // Roofing Ops
  { 
    key: "inspections", 
    label: "Inspections", 
    category: "Roofing",
    description: "Manage roof inspections",
    permissions: {
      can_view: "View inspection reports",
      can_add: "Create inspection records",
      can_edit: "Update inspection data",
      can_delete: "Remove inspections"
    }
  },
  { 
    key: "measurements", 
    label: "Measurements", 
    category: "Roofing",
    description: "Track roof measurements",
    permissions: {
      can_view: "View measurement data",
      can_add: "Add new measurements",
      can_edit: "Update measurements",
      can_delete: "Remove measurements"
    }
  },
  { 
    key: "weather", 
    label: "Weather", 
    category: "Roofing",
    description: "Weather tracking for scheduling",
    permissions: {
      can_view: "View weather data",
      can_add: "N/A",
      can_edit: "N/A",
      can_delete: "N/A"
    }
  },
  { 
    key: "warranties", 
    label: "Warranties", 
    category: "Roofing",
    description: "Manage warranty information",
    permissions: {
      can_view: "View warranty records",
      can_add: "Create warranties",
      can_edit: "Update warranty details",
      can_delete: "Remove warranties"
    }
  },
  // Admin
  { 
    key: "user_management", 
    label: "User Management", 
    category: "Admin",
    description: "Manage users, roles, and invitations",
    permissions: {
      can_view: "View user list and roles",
      can_add: "Invite new users",
      can_edit: "Change user roles",
      can_delete: "Remove users"
    }
  },
  { 
    key: "permissions_management", 
    label: "Permissions Management", 
    category: "Admin",
    description: "Configure user permissions",
    permissions: {
      can_view: "View permission settings",
      can_add: "N/A",
      can_edit: "Modify user permissions",
      can_delete: "N/A"
    }
  },
  { 
    key: "audit_logs", 
    label: "Audit Logs", 
    category: "Admin",
    description: "View system audit trail",
    permissions: {
      can_view: "View audit logs",
      can_add: "N/A",
      can_edit: "N/A",
      can_delete: "N/A"
    }
  },
  { 
    key: "settings", 
    label: "Settings", 
    category: "Admin",
    description: "Manage company and system settings",
    permissions: {
      can_view: "View settings",
      can_add: "N/A",
      can_edit: "Modify settings",
      can_delete: "N/A"
    }
  },
  { 
    key: "document_center", 
    label: "Document Center", 
    category: "Admin",
    description: "View and manage all system documents and receipts",
    permissions: {
      can_view: "View all documents across the system",
      can_add: "N/A (documents added via their source modules)",
      can_edit: "Edit document metadata",
      can_delete: "Delete documents"
    }
  },
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
