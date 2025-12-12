import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface PaymentAttachment {
  id: string;
  payment_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
}

// Vendor Bill Payment Attachments
export const useVendorBillPaymentAttachments = (paymentId: string | undefined) => {
  return useQuery({
    queryKey: ["vendor-bill-payment-attachments", paymentId],
    queryFn: async () => {
      if (!paymentId) return [];
      const { data, error } = await supabase
        .from("vendor_bill_payment_attachments")
        .select("*")
        .eq("payment_id", paymentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PaymentAttachment[];
    },
    enabled: !!paymentId,
  });
};

export const useUploadVendorBillPaymentAttachment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      paymentId,
      file,
    }: {
      paymentId: string;
      file: File;
    }) => {
      const fileExt = file.name.split(".").pop();
      const filePath = `vendor-bill-payments/${paymentId}/${Date.now()}.${fileExt}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("document-attachments")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create database record
      const { data, error } = await supabase
        .from("vendor_bill_payment_attachments")
        .insert({
          payment_id: paymentId,
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
    onSuccess: (_, { paymentId }) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bill-payment-attachments", paymentId] });
      toast.success("File uploaded successfully");
    },
    onError: (error) => {
      toast.error("Failed to upload file");
      console.error(error);
    },
  });
};

export const useDeleteVendorBillPaymentAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      attachmentId,
      paymentId,
      filePath,
    }: {
      attachmentId: string;
      paymentId: string;
      filePath: string;
    }) => {
      // Delete from storage
      await supabase.storage.from("document-attachments").remove([filePath]);

      // Delete database record
      const { error } = await supabase
        .from("vendor_bill_payment_attachments")
        .delete()
        .eq("id", attachmentId);

      if (error) throw error;
    },
    onSuccess: (_, { paymentId }) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bill-payment-attachments", paymentId] });
      toast.success("File deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete file");
      console.error(error);
    },
  });
};

// Invoice Payment Attachments
export const useInvoicePaymentAttachments = (paymentId: string | undefined) => {
  return useQuery({
    queryKey: ["invoice-payment-attachments", paymentId],
    queryFn: async () => {
      if (!paymentId) return [];
      const { data, error } = await supabase
        .from("invoice_payment_attachments")
        .select("*")
        .eq("payment_id", paymentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PaymentAttachment[];
    },
    enabled: !!paymentId,
  });
};

export const useUploadInvoicePaymentAttachment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      paymentId,
      file,
    }: {
      paymentId: string;
      file: File;
    }) => {
      const fileExt = file.name.split(".").pop();
      const filePath = `invoice-payments/${paymentId}/${Date.now()}.${fileExt}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("document-attachments")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create database record
      const { data, error } = await supabase
        .from("invoice_payment_attachments")
        .insert({
          payment_id: paymentId,
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
    onSuccess: (_, { paymentId }) => {
      queryClient.invalidateQueries({ queryKey: ["invoice-payment-attachments", paymentId] });
      toast.success("File uploaded successfully");
    },
    onError: (error) => {
      toast.error("Failed to upload file");
      console.error(error);
    },
  });
};

export const useDeleteInvoicePaymentAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      attachmentId,
      paymentId,
      filePath,
    }: {
      attachmentId: string;
      paymentId: string;
      filePath: string;
    }) => {
      // Delete from storage
      await supabase.storage.from("document-attachments").remove([filePath]);

      // Delete database record
      const { error } = await supabase
        .from("invoice_payment_attachments")
        .delete()
        .eq("id", attachmentId);

      if (error) throw error;
    },
    onSuccess: (_, { paymentId }) => {
      queryClient.invalidateQueries({ queryKey: ["invoice-payment-attachments", paymentId] });
      toast.success("File deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete file");
      console.error(error);
    },
  });
};
