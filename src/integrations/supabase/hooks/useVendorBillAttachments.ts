import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface VendorBillAttachment {
  id: string;
  bill_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
}

export const useVendorBillAttachments = (billId: string) => {
  return useQuery({
    queryKey: ["vendor-bill-attachments", billId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_bill_attachments")
        .select("*")
        .eq("bill_id", billId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as VendorBillAttachment[];
    },
    enabled: !!billId,
  });
};

export const useUploadVendorBillAttachment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      billId,
      file,
      filePath,
    }: {
      billId: string;
      file: File;
      filePath: string;
    }) => {
      const { data, error } = await supabase
        .from("vendor_bill_attachments")
        .insert({
          bill_id: billId,
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
    onSuccess: (_, { billId }) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bill-attachments", billId] });
    },
  });
};

export const useDeleteVendorBillAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      attachmentId,
      billId,
    }: {
      attachmentId: string;
      billId: string;
    }) => {
      const { error } = await supabase
        .from("vendor_bill_attachments")
        .delete()
        .eq("id", attachmentId);

      if (error) throw error;
    },
    onSuccess: (_, { billId }) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bill-attachments", billId] });
    },
  });
};