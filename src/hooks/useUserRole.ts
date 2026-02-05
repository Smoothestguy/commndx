import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

// Timeout wrapper for Supabase queries (which are PromiseLike but need .then() to become real Promises)
const withTimeout = <T>(
  queryBuilder: PromiseLike<T>,
  ms: number
): Promise<T> => {
  const promise = Promise.resolve(queryBuilder);
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Query timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
};

interface RoleQueryResult {
  data: { role: AppRole } | null;
  error: { code?: string; message?: string } | null;
}

interface IdQueryResult {
  data: { id: string } | null;
  error: { message?: string } | null;
}

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [isVendor, setIsVendor] = useState(false);
  const [isPersonnel, setIsPersonnel] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Don't fetch until auth is done loading
    if (authLoading) {
      return; // Keep loading = true while auth is loading
    }

    async function fetchUserRole() {
      if (!user) {
        setRole(null);
        setIsVendor(false);
        setIsPersonnel(false);
        setLoading(false); // Safe to set false now - auth is done and no user
        return;
      }

      try {
        // Run all queries in parallel with timeout to prevent hanging
        const [roleResult, vendorResult, personnelResult] = await Promise.all<
          [Promise<RoleQueryResult>, Promise<IdQueryResult>, Promise<IdQueryResult>]
        >([
          withTimeout(
            supabase.from("user_roles").select("role").eq("user_id", user.id).single(),
            5000
          ).catch((err) => {
            console.warn("Role query failed:", err);
            return { data: null, error: err } as RoleQueryResult;
          }) as Promise<RoleQueryResult>,
          withTimeout(
            supabase.from("vendors").select("id").eq("user_id", user.id).maybeSingle(),
            5000
          ).catch((err) => {
            console.warn("Vendor query failed:", err);
            return { data: null, error: err } as IdQueryResult;
          }) as Promise<IdQueryResult>,
          withTimeout(
            supabase.from("personnel").select("id").eq("user_id", user.id).maybeSingle(),
            5000
          ).catch((err) => {
            console.warn("Personnel query failed:", err);
            return { data: null, error: err } as IdQueryResult;
          }) as Promise<IdQueryResult>,
        ]);

        if (!mounted) return;

        // Process role result
        if (roleResult.error && roleResult.error.code !== "PGRST116") {
          console.error("Error fetching user role:", roleResult.error);
        }
        setRole(roleResult.data?.role || null);

        // Process vendor result
        if (vendorResult.error) {
          console.error("Error checking vendor link:", vendorResult.error);
        }
        setIsVendor(!!vendorResult.data);

        // Process personnel result
        if (personnelResult.error) {
          console.error("Error checking personnel link:", personnelResult.error);
        }
        setIsPersonnel(!!personnelResult.data);
      } catch (error) {
        console.error("Error fetching user role:", error);
        if (mounted) {
          setRole(null);
          setIsVendor(false);
          setIsPersonnel(false);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchUserRole();

    return () => {
      mounted = false;
    };
  }, [user, authLoading]);

  return {
    role,
    loading,
    isAdmin: role === "admin",
    isManager: role === "manager",
    isUser: role === "user",
    isAccounting: role === "accounting",
    isPersonnel, // Now checks personnel table directly, not user_roles
    isVendor, // Now checks vendors table directly, not user_roles
  };
}
