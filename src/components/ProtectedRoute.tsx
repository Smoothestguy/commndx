import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { isPersonnel, isVendor, isAdmin, isManager, isUser, role, loading: roleLoading } = useUserRole();

  if (authLoading || roleLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Allow admins and managers to access main dashboard even if linked to personnel/vendor
  const hasAdminAccess = isAdmin || isManager;

  // Redirect personnel users to the portal (unless they have admin/manager role)
  if (isPersonnel && !hasAdminAccess) {
    return <Navigate to="/portal" replace />;
  }

  // Redirect vendor users to vendor portal (unless they have admin/manager role)
  if (isVendor && !hasAdminAccess) {
    return <Navigate to="/vendor" replace />;
  }

  // Check if user is authorized (has a valid role or is personnel/vendor)
  const isAuthorized = hasAdminAccess || isUser || isPersonnel || isVendor || role !== null;
  
  if (!isAuthorized) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
