import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

export interface Message {
  id: string;
  recipient_type: 'customer' | 'personnel';
  recipient_id: string;
  recipient_name: string;
  recipient_phone: string;
  message_type: 'sms' | 'email';
  content: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  external_id: string | null;
  error_message: string | null;
  sent_by: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  // Response tracking fields
  has_response: boolean | null;
  response_content: string | null;
  response_received_at: string | null;
  direction: 'inbound' | 'outbound' | null;
  parent_message_id: string | null;
}

interface SendSMSParams {
  recipientType: 'customer' | 'personnel';
  recipientId: string;
  recipientName: string;
  recipientPhone: string;
  content: string;
}

export function useMessages(filters?: {
  recipientType?: 'customer' | 'personnel';
  recipientId?: string;
  status?: string;
  hasResponse?: boolean;
  direction?: 'inbound' | 'outbound';
}) {
  return useQuery({
    queryKey: ["messages", filters],
    queryFn: async () => {
      let query = supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.recipientType) {
        query = query.eq("recipient_type", filters.recipientType);
      }
      if (filters?.recipientId) {
        query = query.eq("recipient_id", filters.recipientId);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.hasResponse !== undefined) {
        query = query.eq("has_response", filters.hasResponse);
      }
      if (filters?.direction) {
        query = query.eq("direction", filters.direction);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Message[];
    },
  });
}

export function useMessagesByRecipient(recipientType: 'customer' | 'personnel', recipientId: string) {
  return useQuery({
    queryKey: ["messages", recipientType, recipientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("recipient_type", recipientType)
        .eq("recipient_id", recipientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!recipientId,
  });
}

export function useSendSMS() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SendSMSParams) => {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: params,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      toast({
        title: "SMS Sent",
        description: "Your message has been sent successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Send SMS",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useMessageStats() {
  return useQuery({
    queryKey: ["messages", "stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("status");

      if (error) throw error;

      const stats = {
        total: data.length,
        sent: data.filter(m => m.status === 'sent').length,
        delivered: data.filter(m => m.status === 'delivered').length,
        failed: data.filter(m => m.status === 'failed').length,
        pending: data.filter(m => m.status === 'pending').length,
      };

      return stats;
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      toast({
        title: "Message Deleted",
        description: "The message has been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Delete",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
