import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

// Timeout wrapper that PRESERVES the underlying error instead of masking it as a timeout.
// If the query resolves (even with an error payload) we always return that. The timeout is
// only used as a last-resort fallback for a truly hung network request.
const withTimeout = <T>(
  queryBuilder: PromiseLike<T>,
  ms: number
): Promise<{ value: T | null; timedOut: boolean; error: unknown | null }> => {
  const promise = Promise.resolve(queryBuilder).then(
    (value) => ({ value, timedOut: false, error: null as unknown | null }),
    (error) => ({ value: null as T | null, timedOut: false, error })
  );
  const timeout = new Promise<{ value: T | null; timedOut: boolean; error: unknown | null }>(
    (resolve) =>
      setTimeout(
        () => resolve({ value: null, timedOut: true, error: new Error(`Query timed out after ${ms}ms`) }),
        ms
      )
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
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (authLoading) {
      return;
    }

    async function fetchUserRole() {
      if (!user) {
        setRole(null);
        setIsVendor(false);
        setIsPersonnel(false);
        setHasError(false);
        setLoading(false);
        return;
      }

      // Longer ceiling so slow-but-successful queries aren't nuked at 5s.
      const TIMEOUT_MS = 15000;
      let sawError = false;

      const [roleWrapped, vendorWrapped, personnelWrapped] = await Promise.all([
        withTimeout(
          supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
          TIMEOUT_MS
        ),
        withTimeout(
          supabase.from("vendors").select("id").eq("user_id", user.id).maybeSingle(),
          TIMEOUT_MS
        ),
        withTimeout(
          supabase.from("personnel").select("id").eq("user_id", user.id).maybeSingle(),
          TIMEOUT_MS
        ),
      ]);

      if (!mounted) return;

      // Role
      const roleRes = roleWrapped.value as RoleQueryResult | null;
      if (roleWrapped.timedOut) {
        console.error("[useUserRole] user_roles query timed out", roleWrapped.error);
        sawError = true;
      } else if (roleRes?.error && roleRes.error.code !== "PGRST116") {
        console.error("[useUserRole] user_roles query error:", roleRes.error);
        sawError = true;
      }
      setRole(roleRes?.data?.role ?? null);

      // Vendor
      const vendorRes = vendorWrapped.value as IdQueryResult | null;
      if (vendorWrapped.timedOut) {
        console.error("[useUserRole] vendors query timed out", vendorWrapped.error);
        sawError = true;
      } else if (vendorRes?.error) {
        console.error("[useUserRole] vendors query error:", vendorRes.error);
        sawError = true;
      }
      setIsVendor(!!vendorRes?.data);

      // Personnel
      const personnelRes = personnelWrapped.value as IdQueryResult | null;
      if (personnelWrapped.timedOut) {
        console.error("[useUserRole] personnel query timed out", personnelWrapped.error);
        sawError = true;
      } else if (personnelRes?.error) {
        console.error("[useUserRole] personnel query error:", personnelRes.error);
        sawError = true;
      }
      setIsPersonnel(!!personnelRes?.data);

      setHasError(sawError);
      setLoading(false);
    }

    fetchUserRole();

    return () => {
      mounted = false;
    };
  }, [user, authLoading]);

  return {
    role,
    loading,
    hasError,
    isAdmin: role === "admin",
    isManager: role === "manager",
    isUser: role === "user",
    isAccounting: role === "accounting",
    isPersonnel,
    isVendor,
  };
}
