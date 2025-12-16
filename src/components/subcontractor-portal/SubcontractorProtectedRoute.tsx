import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentSubcontractor } from "@/integrations/supabase/hooks/useSubcontractorPortal";
import { Loader2 } from "lucide-react";

interface SubcontractorProtectedRouteProps {
  children: ReactNode;
}

export function SubcontractorProtectedRoute({ children }: SubcontractorProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { data: subcontractor, isLoading: subcontractorLoading } = useCurrentSubcontractor();

  if (authLoading || subcontractorLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/subcontractor/login" replace />;
  }

  if (!subcontractor) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">
            Your account is not linked to a subcontractor record.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
