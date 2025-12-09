import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

export interface POAddendum {
  id: string;
  purchase_order_id: string;
  description: string;
  amount: number;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
}

export const usePOAddendums = (purchaseOrderId: string) => {
  return useQuery({
    queryKey: ["po_addendums", purchaseOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("po_addendums")
        .select("*")
        .eq("purchase_order_id", purchaseOrderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as POAddendum[];
    },
    enabled: !!purchaseOrderId,
  });
};

export const useAddPOAddendum = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      purchaseOrderId: string;
      description: string;
      amount: number;
      file: File;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Upload file to storage
      const fileExt = data.file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `po-addendums/${data.purchaseOrderId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("document-attachments")
        .upload(filePath, data.file);

      if (uploadError) throw uploadError;

      // Insert addendum record
      const { data: addendum, error } = await supabase
        .from("po_addendums")
        .insert({
          purchase_order_id: data.purchaseOrderId,
          description: data.description,
          amount: data.amount,
          file_name: data.file.name,
          file_path: filePath,
          file_type: data.file.type,
          file_size: data.file.size,
          uploaded_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return addendum;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["po_addendums", variables.purchaseOrderId] });
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Addendum added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add addendum: ${error.message}`);
    },
  });
};

export const useDeletePOAddendum = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; purchaseOrderId: string; filePath: string }) => {
      // Delete file from storage
      const { error: deleteFileError } = await supabase.storage
        .from("document-attachments")
        .remove([data.filePath]);

      if (deleteFileError) {
        console.warn("Failed to delete file:", deleteFileError);
      }

      // Delete addendum record
      const { error } = await supabase
        .from("po_addendums")
        .delete()
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["po_addendums", variables.purchaseOrderId] });
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Addendum deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete addendum: ${error.message}`);
    },
  });
};
