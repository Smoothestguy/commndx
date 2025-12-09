import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

export interface POAddendum {
  id: string;
  purchase_order_id: string;
  number: string | null;
  description: string;
  subtotal: number;
  amount: number;
  file_name: string | null;
  file_path: string | null;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface POAddendumLineItem {
  id: string;
  po_addendum_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  markup: number;
  total: number;
  sort_order: number;
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

export const usePOAddendumLineItems = (addendumId: string) => {
  return useQuery({
    queryKey: ["po_addendum_line_items", addendumId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("po_addendum_line_items")
        .select("*")
        .eq("po_addendum_id", addendumId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as POAddendumLineItem[];
    },
    enabled: !!addendumId,
  });
};

interface AddAddendumData {
  purchaseOrderId: string;
  number: string;
  description: string;
  subtotal: number;
  amount: number;
  lineItems: {
    productId: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    markup: number;
    total: number;
    sortOrder: number;
  }[];
  file?: File;
}

export const useAddPOAddendum = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddAddendumData) => {
      const { data: { user } } = await supabase.auth.getUser();

      let filePath: string | null = null;
      let fileName: string | null = null;
      let fileType: string | null = null;
      let fileSize: number | null = null;

      // Upload file if provided
      if (data.file) {
        const fileExt = data.file.name.split('.').pop();
        const uploadFileName = `${crypto.randomUUID()}.${fileExt}`;
        filePath = `po-addendums/${data.purchaseOrderId}/${uploadFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("document-attachments")
          .upload(filePath, data.file);

        if (uploadError) throw uploadError;

        fileName = data.file.name;
        fileType = data.file.type;
        fileSize = data.file.size;
      }

      // Insert addendum record
      const { data: addendum, error } = await supabase
        .from("po_addendums")
        .insert({
          purchase_order_id: data.purchaseOrderId,
          number: data.number,
          description: data.description,
          subtotal: data.subtotal,
          amount: data.amount,
          file_name: fileName,
          file_path: filePath,
          file_type: fileType,
          file_size: fileSize,
          uploaded_by: user?.id,
        } as never)
        .select()
        .single();

      if (error) throw error;

      // Insert line items
      if (data.lineItems.length > 0) {
        const lineItemsToInsert = data.lineItems.map(item => ({
          po_addendum_id: addendum.id,
          product_id: item.productId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          markup: item.markup,
          total: item.total,
          sort_order: item.sortOrder,
        }));

        const { error: lineItemsError } = await supabase
          .from("po_addendum_line_items")
          .insert(lineItemsToInsert as never);

        if (lineItemsError) throw lineItemsError;
      }

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
    mutationFn: async (data: { id: string; purchaseOrderId: string; filePath: string | null }) => {
      // Delete file from storage if exists
      if (data.filePath) {
        const { error: deleteFileError } = await supabase.storage
          .from("document-attachments")
          .remove([data.filePath]);

        if (deleteFileError) {
          console.warn("Failed to delete file:", deleteFileError);
        }
      }

      // Delete addendum record (line items will cascade)
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
