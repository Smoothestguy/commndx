import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [isVendor, setIsVendor] = useState(false);
  const [isPersonnel, setIsPersonnel] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserRole() {
      if (!user) {
        setRole(null);
        setIsVendor(false);
        setIsPersonnel(false);
        setLoading(false);
        return;
      }

      try {
        // Check user_roles table for role
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (roleError && roleError.code !== "PGRST116") {
          console.error("Error fetching user role:", roleError);
        }
        
        setRole(roleData?.role || null);

        // Check if user is linked to a vendor (vendors don't use user_roles)
        const { data: vendorData, error: vendorError } = await supabase
          .from("vendors")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (vendorError) {
          console.error("Error checking vendor link:", vendorError);
        }
        
        setIsVendor(!!vendorData);

        // Check if user is linked to personnel (personnel don't use user_roles)
        const { data: personnelData, error: personnelError } = await supabase
          .from("personnel")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (personnelError) {
          console.error("Error checking personnel link:", personnelError);
        }
        
        setIsPersonnel(!!personnelData);
      } catch (error) {
        console.error("Error fetching user role:", error);
        setRole(null);
        setIsVendor(false);
        setIsPersonnel(false);
      } finally {
        setLoading(false);
      }
    }

    fetchUserRole();
  }, [user]);

  return {
    role,
    loading,
    isAdmin: role === "admin",
    isManager: role === "manager",
    isUser: role === "user",
    isPersonnel, // Now checks personnel table directly, not user_roles
    isVendor, // Now checks vendors table directly, not user_roles
  };
}
