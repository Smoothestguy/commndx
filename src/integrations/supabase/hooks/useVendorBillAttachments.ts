import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
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
  const queryClient = useQueryClient();

  // Subscribe to realtime changes on vendor_bill_attachments for this bill
  useEffect(() => {
    if (!billId) return;

    const channel = supabase
      .channel(`vendor-bill-attachments-${billId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vendor_bill_attachments",
          filter: `bill_id=eq.${billId}`,
        },
        (payload) => {
          console.log("[Realtime] Attachment change detected:", payload.eventType);
          // Invalidate the query to refetch fresh data
          queryClient.invalidateQueries({ queryKey: ["vendor-bill-attachments", billId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [billId, queryClient]);

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

    // Defensive: avoid ever sending an empty/invalid token header.
    // supabase.functions.invoke will automatically attach the current session JWT.
    const tokenPreview = `${session.access_token.slice(0, 10)}...${session.access_token.slice(-6)}`;

    console.log("Syncing attachment to QuickBooks:", { attachmentId, billId });
    console.log("Auth token preview (client):", tokenPreview);
    
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
      // Insert attachment record (NO auto-sync to QuickBooks - will sync when bill is saved)
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

      // NOTE: Attachment sync to QuickBooks is now deferred until bill is saved
      // This prevents sync failures when uploading while the form has unsaved changes

      return data;
    },
    onSuccess: (_, { billId }) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bill-attachments", billId] });
      toast.success("Attachment added", {
        description: "It will sync to QuickBooks when you save the bill.",
      });
    },
  });
};

// Hook to sync all pending attachments after bill save
export const useSyncPendingAttachments = () => {
  return useMutation({
    mutationFn: async ({ billId }: { billId: string }) => {
      // Get all attachments for this bill
      const { data: attachments, error } = await supabase
        .from("vendor_bill_attachments")
        .select("id")
        .eq("bill_id", billId);

      if (error) throw error;
      if (!attachments || attachments.length === 0) return { synced: 0, failed: 0 };

      let synced = 0;
      let failed = 0;

      // Sync each attachment
      for (const attachment of attachments) {
        const result = await syncAttachmentToQuickBooks(attachment.id, billId);
        if (result.success) {
          synced++;
        } else {
          // Don't count as failed if bill isn't synced yet
          if (!result.error?.includes("not synced") && !result.error?.includes("not fully synced")) {
            failed++;
            console.warn(`Attachment ${attachment.id} sync failed:`, result.error);
          }
        }
      }

      return { synced, failed };
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

// Delete attachment from QuickBooks
const deleteAttachmentFromQuickBooks = async (
  attachmentId: string,
  billId: string
): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      return { success: false, error: "Not authenticated" };
    }

    console.log("Deleting attachment from QuickBooks:", { attachmentId, billId });
    
    const response = await supabase.functions.invoke("quickbooks-delete-bill-attachment", {
      body: { attachmentId, billId },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (response.error) {
      console.error("QuickBooks attachment delete error:", response.error);
      return { success: false, error: response.error.message || "Delete failed" };
    }

    if (response.data?.success) {
      return { success: true, message: response.data.message };
    } else {
      return { success: false, error: response.data?.error || "Delete failed" };
    }
  } catch (err: any) {
    console.error("QuickBooks attachment delete exception:", err);
    return { success: false, error: err.message || "Delete failed" };
  }
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

      // Delete from QuickBooks (async, non-blocking)
      deleteAttachmentFromQuickBooks(attachmentId, billId)
        .then((result) => {
          if (result.success) {
            console.log("Attachment deleted from QuickBooks:", result.message);
            toast.success("Deleted from QuickBooks", {
              description: result.message || "Attachment removed from QuickBooks",
            });
          } else if (result.error && !result.error.includes("never synced")) {
            console.warn("QuickBooks delete warning:", result.error);
            toast.warning("QuickBooks sync", {
              description: result.error,
            });
          }
        })
        .catch((err) => {
          console.error("QuickBooks delete failed:", err);
        });
    },
    onSuccess: (_, { billId }) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-bill-attachments", billId] });
      toast.success("Attachment deleted");
    },
  });
};