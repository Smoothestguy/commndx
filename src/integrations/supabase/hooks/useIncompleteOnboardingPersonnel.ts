import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface IncompleteOnboardingPersonnel {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  onboarding_status: string | null;
}

export function useIncompleteOnboardingPersonnel() {
  return useQuery({
    queryKey: ["personnel", "incomplete-onboarding"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel")
        .select("id, first_name, last_name, phone, email, onboarding_status")
        .eq("status", "active")
        .or("onboarding_status.is.null,onboarding_status.eq.pending,onboarding_status.eq.revoked")
        .order("first_name");

      if (error) throw error;
      return data as IncompleteOnboardingPersonnel[];
    },
  });
}
