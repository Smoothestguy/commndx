import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface POAddendumAttachment {
  id: string;
  addendum_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
}

export const usePOAddendumAttachments = (addendumId: string | undefined) => {
  return useQuery({
    queryKey: ["po-addendum-attachments", addendumId],
    queryFn: async () => {
      if (!addendumId) return [];
      
      const { data, error } = await supabase
        .from("po_addendum_attachments")
        .select("*")
        .eq("addendum_id", addendumId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as POAddendumAttachment[];
    },
    enabled: !!addendumId,
  });
};

export const useUploadPOAddendumAttachment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      addendumId,
      file,
      filePath,
    }: {
      addendumId: string;
      file: File;
      filePath: string;
    }) => {
      const { data, error } = await supabase
        .from("po_addendum_attachments")
        .insert({
          addendum_id: addendumId,
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
    onSuccess: (_, { addendumId }) => {
      queryClient.invalidateQueries({ queryKey: ["po-addendum-attachments", addendumId] });
    },
  });
};

export const useDeletePOAddendumAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      attachmentId,
      addendumId,
      filePath,
    }: {
      attachmentId: string;
      addendumId: string;
      filePath: string;
    }) => {
      // Delete from storage
      await supabase.storage
        .from("document-attachments")
        .remove([filePath]);

      // Delete from database
      const { error } = await supabase
        .from("po_addendum_attachments")
        .delete()
        .eq("id", attachmentId);

      if (error) throw error;
    },
    onSuccess: (_, { addendumId }) => {
      queryClient.invalidateQueries({ queryKey: ["po-addendum-attachments", addendumId] });
    },
  });
};
