import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentVendor } from "@/integrations/supabase/hooks/useVendorPortal";
import { Loader2 } from "lucide-react";

interface VendorProtectedRouteProps {
  children: ReactNode;
}

export function VendorProtectedRoute({ children }: VendorProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { data: vendor, isLoading: vendorLoading } = useCurrentVendor();

  if (authLoading || vendorLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/vendor/login" replace />;
  }

  if (!vendor) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">
            Your account is not linked to a vendor record.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
