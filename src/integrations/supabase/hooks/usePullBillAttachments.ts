import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PullResult {
  success: boolean;
  imported: number;
  skipped: number;
  failed: number;
  message: string;
  details?: Array<{ fileName: string; success: boolean; error?: string }>;
  error?: string;
}

export const usePullBillAttachments = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ billId }: { billId: string }): Promise<PullResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      console.log("Pulling attachments from QuickBooks for bill:", billId);

      const response = await supabase.functions.invoke("quickbooks-pull-bill-attachments", {
        body: { billId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to pull attachments");
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || "Failed to pull attachments");
      }

      return response.data as PullResult;
    },
    onSuccess: (_, { billId }) => {
      // Invalidate attachments query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["vendor-bill-attachments", billId] });
    },
  });
};
