import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  full_name?: string;
}

export const useProfile = () => {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        return null;
      }

      return data;
    },
  });
};

export const useProfiles = () => {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .order("first_name", { ascending: true });

      if (error) {
        console.error("Error fetching profiles:", error);
        return [];
      }

      return data.map(p => ({
        ...p,
        full_name: [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
      }));
    },
  });
};
