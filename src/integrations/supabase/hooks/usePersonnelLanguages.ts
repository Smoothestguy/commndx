import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type PersonnelLanguage =
  Database["public"]["Tables"]["personnel_languages"]["Row"];
type PersonnelLanguageInsert =
  Database["public"]["Tables"]["personnel_languages"]["Insert"];

export const usePersonnelLanguages = (personnelId: string | undefined) => {
  return useQuery({
    queryKey: ["personnel-languages", personnelId],
    queryFn: async () => {
      if (!personnelId) return [];

      const { data, error } = await supabase
        .from("personnel_languages")
        .select("*")
        .eq("personnel_id", personnelId)
        .order("language", { ascending: true });

      if (error) throw error;
      return data as PersonnelLanguage[];
    },
    enabled: !!personnelId,
  });
};

export const useAddLanguage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (language: PersonnelLanguageInsert) => {
      const { data, error } = await supabase
        .from("personnel_languages")
        .insert(language)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["personnel-languages", data.personnel_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["personnel", data.personnel_id],
      });
      toast.success("Language added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add language: ${error.message}`);
    },
  });
};

export const useDeleteLanguage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, personnelId }: { id: string; personnelId: string }) => {
      const { error } = await supabase
        .from("personnel_languages")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return personnelId;
    },
    onSuccess: (personnelId) => {
      queryClient.invalidateQueries({
        queryKey: ["personnel-languages", personnelId],
      });
      queryClient.invalidateQueries({ queryKey: ["personnel", personnelId] });
      toast.success("Language deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete language: ${error.message}`);
    },
  });
};
