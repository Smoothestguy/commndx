import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BulkSMSParams {
  projectId?: string;
  projectName?: string;
  content: string;
  recipientIds: string[];
  messageContext?: string;
}

interface RecipientResult {
  personnelId: string;
  personnelName: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
}

interface BulkSMSResponse {
  success: boolean;
  batchId: string;
  totalSent: number;
  totalFailed: number;
  totalSkipped: number;
  results: RecipientResult[];
}

export function useSendBulkSMS() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: BulkSMSParams): Promise<BulkSMSResponse> => {
      const { data, error } = await supabase.functions.invoke("send-bulk-sms", {
        body: params,
      });

      if (error) {
        throw new Error(error.message || "Failed to send bulk SMS");
      }

      if (!data.success) {
        throw new Error(data.error || "Bulk SMS failed");
      }

      return data as BulkSMSResponse;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["message-stats"] });

      const { totalSent, totalFailed, totalSkipped } = data;

      if (totalFailed === 0 && totalSkipped === 0) {
        toast({
          title: "SMS Sent Successfully",
          description: `Message sent to ${totalSent} personnel`,
        });
      } else if (totalSent > 0) {
        toast({
          title: "Bulk SMS Complete",
          description: `${totalSent} sent, ${totalFailed} failed, ${totalSkipped} skipped`,
          variant: totalFailed > 0 ? "destructive" : "default",
        });
      } else {
        toast({
          title: "SMS Sending Failed",
          description: `All ${totalFailed + totalSkipped} messages failed or were skipped`,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Bulk SMS Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
