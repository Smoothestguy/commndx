import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentPersonnel } from "@/integrations/supabase/hooks/usePortal";
import { Loader2 } from "lucide-react";
import { PhotoUploadRequired } from "./PhotoUploadRequired";

interface PortalProtectedRouteProps {
  children: ReactNode;
}

export function PortalProtectedRoute({ children }: PortalProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { data: personnel, isLoading: personnelLoading } = useCurrentPersonnel();

  if (authLoading || personnelLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/portal/login" replace />;
  }

  if (!personnel) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">
            Your account is not linked to a personnel record.
          </p>
        </div>
      </div>
    );
  }

  // Require profile photo before allowing portal access
  if (!personnel.photo_url) {
    return <PhotoUploadRequired personnelId={personnel.id} />;
  }

  return <>{children}</>;
}
