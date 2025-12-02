import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type EmergencyContact = Database["public"]["Tables"]["emergency_contacts"]["Row"];
type EmergencyContactInsert =
  Database["public"]["Tables"]["emergency_contacts"]["Insert"];
type EmergencyContactUpdate =
  Database["public"]["Tables"]["emergency_contacts"]["Update"];

export const useEmergencyContacts = (personnelId: string | undefined) => {
  return useQuery({
    queryKey: ["emergency-contacts", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];

      const { data, error } = await supabase
        .from("emergency_contacts")
        .select("*")
        .eq("personnel_id", personnelId)
        .order("is_primary", { ascending: false });

      if (error) throw error;
      return data as EmergencyContact[];
    },
    enabled: !!personnelId,
  });
};

export const useAddEmergencyContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contact: EmergencyContactInsert) => {
      const { data, error } = await supabase
        .from("emergency_contacts")
        .insert(contact)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["emergency-contacts", data.personnel_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["personnel", data.personnel_id],
      });
      toast.success("Emergency contact added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add emergency contact: ${error.message}`);
    },
  });
};

export const useUpdateEmergencyContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: EmergencyContactUpdate;
    }) => {
      const { data, error } = await supabase
        .from("emergency_contacts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["emergency-contacts", data.personnel_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["personnel", data.personnel_id],
      });
      toast.success("Emergency contact updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update emergency contact: ${error.message}`);
    },
  });
};

export const useDeleteEmergencyContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, personnelId }: { id: string; personnelId: string }) => {
      const { error } = await supabase
        .from("emergency_contacts")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return personnelId;
    },
    onSuccess: (personnelId) => {
      queryClient.invalidateQueries({
        queryKey: ["emergency-contacts", personnelId],
      });
      queryClient.invalidateQueries({ queryKey: ["personnel", personnelId] });
      toast.success("Emergency contact deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete emergency contact: ${error.message}`);
    },
  });
};
