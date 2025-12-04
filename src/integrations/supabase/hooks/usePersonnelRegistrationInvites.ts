import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";

export interface PersonnelRegistrationInvite {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  token: string;
  status: "pending" | "completed" | "expired";
  invited_by: string;
  expires_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const usePersonnelRegistrationInvites = () => {
  return useQuery({
    queryKey: ["personnel-registration-invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel_registration_invites")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PersonnelRegistrationInvite[];
    },
  });
};

export const usePersonnelRegistrationInviteByToken = (token: string | undefined) => {
  return useQuery({
    queryKey: ["personnel-registration-invite", token],
    queryFn: async () => {
      if (!token) return null;

      const { data, error } = await supabase
        .from("personnel_registration_invites")
        .select("*")
        .eq("token", token)
        .single();

      if (error) throw error;
      return data as PersonnelRegistrationInvite;
    },
    enabled: !!token,
  });
};

export const useSendPersonnelRegistrationInvite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      email,
      firstName,
      lastName,
    }: {
      email: string;
      firstName?: string;
      lastName?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke(
        "send-personnel-registration-invite",
        {
          body: { email, firstName, lastName },
        }
      );

      if (response.error) {
        throw new Error(response.error.message || "Failed to send invitation");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-registration-invites"] });
    },
  });
};

export const useCompletePersonnelRegistrationInvite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase
        .from("personnel_registration_invites")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("token", token)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel-registration-invites"] });
    },
  });
};
