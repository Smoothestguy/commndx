import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface InvoiceAttachment {
  id: string;
  invoice_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
}

export const useInvoiceAttachments = (invoiceId: string) => {
  return useQuery({
    queryKey: ["invoice-attachments", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_attachments")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as InvoiceAttachment[];
    },
    enabled: !!invoiceId,
  });
};

export const useUploadInvoiceAttachment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      file,
      filePath,
    }: {
      invoiceId: string;
      file: File;
      filePath: string;
    }) => {
      const { data, error } = await supabase
        .from("invoice_attachments")
        .insert({
          invoice_id: invoiceId,
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
    onSuccess: (_, { invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: ["invoice-attachments", invoiceId] });
    },
  });
};

export const useDeleteInvoiceAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      attachmentId,
      invoiceId,
    }: {
      attachmentId: string;
      invoiceId: string;
    }) => {
      const { error } = await supabase
        .from("invoice_attachments")
        .delete()
        .eq("id", attachmentId);

      if (error) throw error;
    },
    onSuccess: (_, { invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: ["invoice-attachments", invoiceId] });
    },
  });
};