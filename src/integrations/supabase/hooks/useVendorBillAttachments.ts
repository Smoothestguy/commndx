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
      // Insert attachment record
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

      // Check if bill is synced to QuickBooks and sync attachment
      const { data: qbMapping } = await supabase
        .from("quickbooks_bill_mappings")
        .select("quickbooks_bill_id, sync_status")
        .eq("bill_id", billId)
        .maybeSingle();

      if (qbMapping && qbMapping.sync_status === "synced" && qbMapping.quickbooks_bill_id) {
        // Get current session to forward auth header
        const { data: { session } } = await supabase.auth.getSession();
        
        // Trigger attachment sync to QuickBooks (non-blocking)
        supabase.functions.invoke("quickbooks-sync-bill-attachment", {
          body: {
            attachmentId: data.id,
            billId: billId,
            qbBillId: qbMapping.quickbooks_bill_id,
          },
          headers: session?.access_token ? {
            Authorization: `Bearer ${session.access_token}`,
          } : undefined,
        }).then((response) => {
          if (response.error) {
            console.warn("QuickBooks attachment sync failed:", response.error);
          } else if (response.data?.success) {
            console.log("Attachment synced to QuickBooks:", response.data.message);
          } else if (response.data?.error) {
            console.warn("QuickBooks attachment sync returned error:", response.data.error);
          }
        }).catch((err) => {
          console.warn("QuickBooks attachment sync error:", err);
        });
      }

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