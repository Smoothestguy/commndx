import { useUserRole } from "@/hooks/useUserRole";
import { useMyPermissions, type ModuleKey } from "@/integrations/supabase/hooks/useUserPermissions";

export interface PermissionCheckResult {
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  loading: boolean;
}

/**
 * Hook to check if the current user has permissions for a specific module.
 * Admins and managers always have full access.
 * Regular users check against their user_permissions entries.
 */
export function usePermissionCheck(module: ModuleKey): PermissionCheckResult {
  const { isAdmin, isManager, loading: roleLoading } = useUserRole();
  const { data: permissions, isLoading: permLoading } = useMyPermissions();

  // While loading, return safe defaults (no access)
  if (roleLoading || permLoading) {
    return {
      canView: false,
      canAdd: false,
      canEdit: false,
      canDelete: false,
      loading: true,
    };
  }

  // Admins always have full access
  if (isAdmin) {
    return {
      canView: true,
      canAdd: true,
      canEdit: true,
      canDelete: true,
      loading: false,
    };
  }

  // Managers also have full access
  if (isManager) {
    return {
      canView: true,
      canAdd: true,
      canEdit: true,
      canDelete: true,
      loading: false,
    };
  }

  // Check granular permissions for regular users
  const modulePermission = permissions?.find(p => p.module === module);

  return {
    canView: modulePermission?.can_view ?? false,
    canAdd: modulePermission?.can_add ?? false,
    canEdit: modulePermission?.can_edit ?? false,
    canDelete: modulePermission?.can_delete ?? false,
    loading: false,
  };
}

/**
 * Hook to check if the user has access to any admin-level feature.
 * Returns true for admins/managers OR users with specific admin module permissions.
 */
export function useHasAdminAccess(): { hasAccess: boolean; loading: boolean } {
  const { isAdmin, isManager, loading: roleLoading } = useUserRole();
  const { data: permissions, isLoading: permLoading } = useMyPermissions();

  if (roleLoading || permLoading) {
    return { hasAccess: false, loading: true };
  }

  if (isAdmin || isManager) {
    return { hasAccess: true, loading: false };
  }

  // Check if user has any admin module permissions
  const adminModules = ['user_management', 'permissions_management', 'audit_logs'];
  const hasAdminPermission = permissions?.some(
    p => adminModules.includes(p.module) && p.can_view
  );

  return { hasAccess: hasAdminPermission ?? false, loading: false };
}
