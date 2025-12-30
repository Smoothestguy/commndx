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
    // Admins always have full access - can delete any CO regardless of status
    if (isAdmin) {
      return {
        canView: true,
        canEdit: true,
        canDelete: true, // Admin bypass: can delete any status
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

    // Managers have elevated access but can only delete drafts
    if (isManager) {
      const isDraft = changeOrder?.status === 'draft';
      const isEditable = changeOrder?.status !== 'approved' && changeOrder?.status !== 'invoiced';
      return {
        canView: true,
        canEdit: isEditable,
        canDelete: isDraft, // Managers can only delete drafts
        canApprove: true,
        canSubmitForApproval: isEditable,
        canConvertToPO: true,
        canCreateInvoice: true,
        canViewCosts: sensitivePerms?.can_view_cost_rates ?? true,
        canViewMargins: sensitivePerms?.can_view_margins ?? true,
        canEditLineItems: isEditable,
        canEditPricing: isEditable,
        canEditStatus: true,
        accessLevel: 'full_admin' as AccessLevel,
        loading,
      };
    }

    // Status-based restrictions for regular users
    const isDraft = changeOrder?.status === 'draft';
    const isApproved = changeOrder?.status === 'approved';
    const isInvoiced = changeOrder?.status === 'invoiced';
    const isEditable = !isApproved && !isInvoiced;

    // Determine access level
    let accessLevel: AccessLevel = 'read_only';
    if (canEdit && isEditable) {
      accessLevel = 'edit';
    } else if (canView && !canEdit) {
      accessLevel = 'read_only';
    }

    return {
      canView,
      canEdit: canEdit && isEditable, // Can edit unless approved/invoiced
      canDelete: canDelete && isDraft, // Can only delete drafts
      canApprove: false, // Only admins/managers can approve
      canSubmitForApproval: canEdit && isEditable,
      canConvertToPO: canAdd && isApproved,
      canCreateInvoice: canAdd && isApproved,
      canViewCosts: sensitivePerms?.can_view_cost_rates ?? false,
      canViewMargins: sensitivePerms?.can_view_margins ?? false,
      canEditLineItems: canEdit && isEditable,
      canEditPricing: canEdit && isEditable,
      canEditStatus: false, // Only admins/managers can change status
      accessLevel,
      loading,
    };
  }, [isAdmin, isManager, canView, canAdd, canEdit, canDelete, sensitivePerms, changeOrder?.status, loading]);
}
