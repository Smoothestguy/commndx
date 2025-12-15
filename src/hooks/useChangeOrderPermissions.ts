import { useMemo } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissionCheck } from "@/hooks/usePermissionCheck";
import { useMySensitivePermissions } from "@/integrations/supabase/hooks/useSensitivePermissions";
import { ChangeOrderWithLineItems, ChangeOrderStatus } from "@/integrations/supabase/hooks/useChangeOrders";

export type AccessLevel = 'read_only' | 'edit' | 'full_admin';

export interface ChangeOrderPermissions {
  // Actions
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canSubmitForApproval: boolean;
  canConvertToPO: boolean;
  canCreateInvoice: boolean;
  
  // Field-level access
  canViewCosts: boolean;
  canViewMargins: boolean;
  canEditLineItems: boolean;
  canEditPricing: boolean;
  canEditStatus: boolean;
  
  // Access level indicator
  accessLevel: AccessLevel;
  loading: boolean;
}

export function useChangeOrderPermissions(changeOrder?: ChangeOrderWithLineItems): ChangeOrderPermissions {
  const { isAdmin, isManager, loading: roleLoading } = useUserRole();
  const { canView, canAdd, canEdit, canDelete, loading: permLoading } = usePermissionCheck('change_orders');
  const { data: sensitivePerms, isLoading: sensitiveLoading } = useMySensitivePermissions();

  const loading = roleLoading || permLoading || sensitiveLoading;

  return useMemo(() => {
    // Admins always have full access
    if (isAdmin) {
      return {
        canView: true,
        canEdit: true,
        canDelete: true,
        canApprove: true,
        canSubmitForApproval: true,
        canConvertToPO: true,
        canCreateInvoice: true,
        canViewCosts: true,
        canViewMargins: true,
        canEditLineItems: true,
        canEditPricing: true,
        canEditStatus: true,
        accessLevel: 'full_admin' as AccessLevel,
        loading,
      };
    }

    // Managers have elevated access
    if (isManager) {
      return {
        canView: true,
        canEdit: true,
        canDelete: true,
        canApprove: true,
        canSubmitForApproval: true,
        canConvertToPO: true,
        canCreateInvoice: true,
        canViewCosts: sensitivePerms?.can_view_cost_rates ?? true,
        canViewMargins: sensitivePerms?.can_view_margins ?? true,
        canEditLineItems: true,
        canEditPricing: true,
        canEditStatus: true,
        accessLevel: 'full_admin' as AccessLevel,
        loading,
      };
    }

    // Status-based restrictions for regular users
    const isDraft = changeOrder?.status === 'draft';
    const isPendingApproval = changeOrder?.status === 'pending_approval';
    const isApproved = changeOrder?.status === 'approved';

    // Determine access level
    let accessLevel: AccessLevel = 'read_only';
    if (canEdit && isDraft) {
      accessLevel = 'edit';
    } else if (canView && !canEdit) {
      accessLevel = 'read_only';
    }

    return {
      canView,
      canEdit: canEdit && isDraft, // Can only edit draft change orders
      canDelete: canDelete && isDraft, // Can only delete drafts
      canApprove: false, // Only admins/managers can approve
      canSubmitForApproval: canEdit && isDraft,
      canConvertToPO: canAdd && isApproved,
      canCreateInvoice: canAdd && isApproved,
      canViewCosts: sensitivePerms?.can_view_cost_rates ?? false,
      canViewMargins: sensitivePerms?.can_view_margins ?? false,
      canEditLineItems: canEdit && isDraft,
      canEditPricing: canEdit && isDraft,
      canEditStatus: false, // Only admins/managers can change status
      accessLevel,
      loading,
    };
  }, [isAdmin, isManager, canView, canAdd, canEdit, canDelete, sensitivePerms, changeOrder?.status, loading]);
}
