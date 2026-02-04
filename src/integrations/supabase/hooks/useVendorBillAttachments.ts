import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

// Sync attachment to QuickBooks (can be used for initial upload or retry)
export const syncAttachmentToQuickBooks = async (
  attachmentId: string,
  billId: string
): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      return { success: false, error: "Not authenticated" };
    }

    console.log("Syncing attachment to QuickBooks:", { attachmentId, billId });
    
    const response = await supabase.functions.invoke("quickbooks-sync-bill-attachment", {
      body: {
        attachmentId,
        billId,
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (response.error) {
      console.error("QuickBooks attachment sync error:", response.error);
      const errorDetails = response.error.message || response.error.name || "Unknown error";
      return { success: false, error: `Sync failed: ${errorDetails}` };
    }

    if (response.data?.success) {
      return { success: true, message: response.data.message || "Synced to QuickBooks" };
    } else {
      return { 
        success: false, 
        error: response.data?.error || response.data?.message || "Sync failed" 
      };
    }
  } catch (err: any) {
    console.error("QuickBooks attachment sync exception:", err);
    return { success: false, error: err.message || "Sync failed" };
  }
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

      // Sync to QuickBooks (non-blocking, with user feedback)
      syncAttachmentToQuickBooks(data.id, billId).then((result) => {
        if (result.success) {
          toast.success("Synced to QuickBooks", {
            description: result.message,
          });
        } else if (result.error) {
          // Only show warning if it's not a "not synced yet" case
          if (!result.error.includes("not synced") && !result.error.includes("not fully synced")) {
            toast.warning("QuickBooks sync failed", {
              description: result.error,
              action: {
                label: "Retry",
                onClick: () => {
                  syncAttachmentToQuickBooks(data.id, billId).then((retryResult) => {
                    if (retryResult.success) {
                      toast.success("Synced to QuickBooks");
                    } else {
                      toast.error("Retry failed", { description: retryResult.error });
                    }
                  });
                },
              },
            });
          } else {
            console.log("Bill not synced to QuickBooks yet, attachment sync skipped");
          }
        }
      });

      return data;
    },
    onSuccess: (_, { billId }) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bill-attachments", billId] });
    },
  });
};

export const useRetrySyncAttachment = () => {
  return useMutation({
    mutationFn: async ({
      attachmentId,
      billId,
    }: {
      attachmentId: string;
      billId: string;
    }) => {
      const result = await syncAttachmentToQuickBooks(attachmentId, billId);
      if (!result.success) {
        throw new Error(result.error || "Sync failed");
      }
      return result;
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