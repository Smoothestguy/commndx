import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type PersonnelCapability =
  Database["public"]["Tables"]["personnel_capabilities"]["Row"];
type PersonnelCapabilityInsert =
  Database["public"]["Tables"]["personnel_capabilities"]["Insert"];

export const usePersonnelCapabilities = (personnelId: string | undefined) => {
  return useQuery({
    queryKey: ["personnel-capabilities", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];

      const { data, error } = await supabase
        .from("personnel_capabilities")
        .select("*")
        .eq("personnel_id", personnelId)
        .order("capability", { ascending: true });

      if (error) throw error;
      return data as PersonnelCapability[];
    },
    enabled: !!personnelId,
  });
};

export const useAddCapability = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (capability: PersonnelCapabilityInsert) => {
      const { data, error } = await supabase
        .from("personnel_capabilities")
        .insert(capability)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["personnel-capabilities", data.personnel_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["personnel", data.personnel_id],
      });
      toast.success("Capability added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add capability: ${error.message}`);
    },
  });
};

export const useDeleteCapability = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, personnelId }: { id: string; personnelId: string }) => {
      const { error } = await supabase
        .from("personnel_capabilities")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return personnelId;
    },
    onSuccess: (personnelId) => {
      queryClient.invalidateQueries({
        queryKey: ["personnel-capabilities", personnelId],
      });
      queryClient.invalidateQueries({ queryKey: ["personnel", personnelId] });
      toast.success("Capability deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete capability: ${error.message}`);
    },
  });
};
