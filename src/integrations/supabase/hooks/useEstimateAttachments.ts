import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface EstimateAttachment {
  id: string;
  estimate_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
}

export const useEstimateAttachments = (estimateId: string) => {
  return useQuery({
    queryKey: ["estimate-attachments", estimateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimate_attachments")
        .select("*")
        .eq("estimate_id", estimateId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as EstimateAttachment[];
    },
    enabled: !!estimateId,
  });
};

export const useUploadEstimateAttachment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      estimateId,
      file,
      filePath,
    }: {
      estimateId: string;
      file: File;
      filePath: string;
    }) => {
      const { data, error } = await supabase
        .from("estimate_attachments")
        .insert({
          estimate_id: estimateId,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { estimateId }) => {
      queryClient.invalidateQueries({ queryKey: ["estimate-attachments", estimateId] });
    },
  });
};

export const useDeleteEstimateAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      attachmentId,
      estimateId,
    }: {
      attachmentId: string;
      estimateId: string;
    }) => {
      const { error } = await supabase
        .from("estimate_attachments")
        .delete()
        .eq("id", attachmentId);

      if (error) throw error;
    },
    onSuccess: (_, { estimateId }) => {
      queryClient.invalidateQueries({ queryKey: ["estimate-attachments", estimateId] });
    },
  });
};