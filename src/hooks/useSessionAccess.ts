import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Shared hook to check if user has access to session tracking features.
 * Access is granted to admins, managers, or users with user_management permission.
 */
export function useSessionAccess() {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!user) {
      setHasAccess(false);
      setIsChecking(false);
      return;
    }

    let isMounted = true;

    const checkAccess = async () => {
      try {
        // Check if user is admin or manager
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (!isMounted) return;

        if (roleData?.role === "admin" || roleData?.role === "manager") {
          setHasAccess(true);
          setIsChecking(false);
          return;
        }

        // Check if user has user_management permission
        const { data: permData } = await supabase
          .from("user_permissions")
          .select("can_view")
          .eq("user_id", user.id)
          .eq("module", "user_management")
          .single();

        if (!isMounted) return;

        setHasAccess(permData?.can_view === true);
      } catch (e) {
        console.error("Error checking session access:", e);
        if (isMounted) setHasAccess(false);
      }
      if (isMounted) setIsChecking(false);
    };

    checkAccess();

    return () => {
      isMounted = false;
    };
  }, [user]);

  return { hasAccess, isChecking };
}
