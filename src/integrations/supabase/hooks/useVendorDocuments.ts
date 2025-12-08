import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

export interface VendorDocument {
  id: string;
  vendor_id: string;
  document_type: string;
  document_name: string;
  document_url: string;
  expiry_date: string | null;
  uploaded_at: string;
  created_at: string;
}

export const useVendorDocuments = (vendorId: string) => {
  return useQuery({
    queryKey: ["vendor-documents", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_documents")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return data as VendorDocument[];
    },
    enabled: !!vendorId,
  });
};

// Hook to fetch ALL vendor documents (for dashboard)
export const useAllVendorDocuments = () => {
  return useQuery({
    queryKey: ["vendor-documents-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_documents")
        .select("*")
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return data as VendorDocument[];
    },
  });
};

export const useUploadVendorDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vendorId,
      file,
      documentType,
      expiryDate,
    }: {
      vendorId: string;
      file: File;
      documentType: string;
      expiryDate?: string;
    }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${vendorId}/${documentType}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('vendor-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('vendor-documents')
        .getPublicUrl(fileName);

      const { data, error } = await supabase
        .from("vendor_documents")
        .insert([{
          vendor_id: vendorId,
          document_type: documentType,
          document_name: file.name,
          document_url: publicUrl,
          expiry_date: expiryDate || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-documents", variables.vendorId] });
      toast.success("Document uploaded successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload document: ${error.message}`);
    },
  });
};

export const useDeleteVendorDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, vendorId }: { id: string; vendorId: string }) => {
      const { error } = await supabase
        .from("vendor_documents")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-documents", variables.vendorId] });
      toast.success("Document deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete document: ${error.message}`);
    },
  });
};
