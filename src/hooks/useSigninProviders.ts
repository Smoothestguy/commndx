import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PublicSigninProviders {
  google_client_id: string | null;
  facebook_app_id: string | null;
  apply_google_enabled: boolean;
  apply_facebook_enabled: boolean;
  staff_google_enabled: boolean;
  staff_facebook_enabled: boolean;
}

const EMPTY: PublicSigninProviders = {
  google_client_id: null,
  facebook_app_id: null,
  apply_google_enabled: false,
  apply_facebook_enabled: false,
  staff_google_enabled: false,
  staff_facebook_enabled: false,
};

/**
 * Public (anon-safe) sign-in provider configuration. Returns all-disabled
 * defaults on any error so no surface ever breaks when unconfigured.
 */
export function usePublicSigninProviders() {
  return useQuery({
    queryKey: ["public-signin-providers"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PublicSigninProviders> => {
      try {
        const { data, error } = await supabase.rpc("get_public_signin_providers");
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        return { ...EMPTY, ...(row as Partial<PublicSigninProviders> | null) };
      } catch (err) {
        console.warn("[SigninProviders] falling back to disabled", err);
        return EMPTY;
      }
    },
  });
}
