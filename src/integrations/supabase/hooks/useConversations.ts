import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

export interface Conversation {
  id: string;
  participant_1_type: "user" | "personnel" | "customer" | "applicant";
  participant_1_id: string;
  participant_2_type: "user" | "personnel" | "customer" | "applicant";
  participant_2_id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  other_participant_name?: string;
  other_participant_type?: string;
  unread_count?: number;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  sender_type: "user" | "personnel" | "customer" | "applicant";
  sender_id: string;
  content: string;
  message_type: "in_app" | "sms";
  read_at: string | null;
  delivered_at: string | null;
  created_at: string;
  // Joined data
  sender_name?: string;
}

export function useConversations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get conversations where user is a participant
      const { data: conversations, error } = await supabase
        .from("conversations")
        .select(`
          *,
          conversation_participants!inner (
            unread_count,
            participant_type,
            participant_id
          )
        `)
        .or(`and(participant_1_type.eq.user,participant_1_id.eq.${user.id}),and(participant_2_type.eq.user,participant_2_id.eq.${user.id})`)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Enrich with participant names
      const enrichedConversations = await Promise.all(
        (conversations || []).map(async (conv) => {
          // Determine the "other" participant
          const isParticipant1 = conv.participant_1_type === "user" && conv.participant_1_id === user.id;
          const otherType = isParticipant1 ? conv.participant_2_type : conv.participant_1_type;
          const otherId = isParticipant1 ? conv.participant_2_id : conv.participant_1_id;

          let otherName = "Unknown";

          if (otherType === "user") {
            const { data: profile } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("id", otherId)
              .single();
            if (profile) {
              otherName = `${profile.first_name} ${profile.last_name}`.trim() || "Unknown User";
            }
          } else if (otherType === "personnel") {
            const { data: personnel } = await supabase
              .from("personnel")
              .select("first_name, last_name")
              .eq("id", otherId)
              .single();
            if (personnel) {
              otherName = `${personnel.first_name} ${personnel.last_name}`.trim();
            }
          } else if (otherType === "customer") {
            const { data: customer } = await supabase
              .from("customers")
              .select("name")
              .eq("id", otherId)
              .single();
            if (customer) {
              otherName = customer.name;
            }
          } else if (otherType === "applicant") {
            const { data: applicant } = await supabase
              .from("applicants")
              .select("first_name, last_name")
              .eq("id", otherId)
              .single();
            if (applicant) {
              otherName = `${applicant.first_name} ${applicant.last_name}`.trim();
            }
          }

          // Get unread count for current user
          const participantRecord = conv.conversation_participants?.find(
            (p: any) => p.participant_type === "user" && p.participant_id === user.id
          );

          return {
            ...conv,
            other_participant_name: otherName,
            other_participant_type: otherType,
            unread_count: participantRecord?.unread_count || 0,
          };
        })
      );

      return enrichedConversations as Conversation[];
    },
    enabled: !!user,
  });

  // Set up realtime subscription for conversations
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("conversations-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_participants",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return query;
}

export function useConversationMessages(conversationId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["conversation-messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data: messages, error } = await supabase
        .from("conversation_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Enrich with sender names
      const enrichedMessages = await Promise.all(
        (messages || []).map(async (msg) => {
          let senderName = "Unknown";

          if (msg.sender_type === "user") {
            const { data: profile } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("id", msg.sender_id)
              .single();
            if (profile) {
              senderName = `${profile.first_name} ${profile.last_name}`.trim() || "Unknown User";
            }
          } else if (msg.sender_type === "personnel") {
            const { data: personnel } = await supabase
              .from("personnel")
              .select("first_name, last_name")
              .eq("id", msg.sender_id)
              .single();
            if (personnel) {
              senderName = `${personnel.first_name} ${personnel.last_name}`.trim();
            }
          } else if (msg.sender_type === "customer") {
            const { data: customer } = await supabase
              .from("customers")
              .select("name")
              .eq("id", msg.sender_id)
              .single();
            if (customer) {
              senderName = customer.name;
            }
          } else if (msg.sender_type === "applicant") {
            const { data: applicant } = await supabase
              .from("applicants")
              .select("first_name, last_name")
              .eq("id", msg.sender_id)
              .single();
            if (applicant) {
              senderName = `${applicant.first_name} ${applicant.last_name}`.trim();
            }
          }

          return {
            ...msg,
            sender_name: senderName,
          };
        })
      );

      return enrichedMessages as ConversationMessage[];
    },
    enabled: !!conversationId,
  });

  // Set up realtime subscription for messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`conversation-messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return query;
}

export function useSendConversationMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
      messageType = "in_app",
      sendViaSMS = false,
      recipientType,
      recipientId,
      recipientName,
      recipientPhone,
    }: {
      conversationId: string;
      content: string;
      messageType?: "in_app" | "sms";
      sendViaSMS?: boolean;
      recipientType?: string;
      recipientId?: string;
      recipientName?: string;
      recipientPhone?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Insert message into conversation_messages
      const { data, error } = await supabase
        .from("conversation_messages")
        .insert({
          conversation_id: conversationId,
          sender_type: "user",
          sender_id: user.id,
          content,
          message_type: sendViaSMS ? "sms" : messageType,
        })
        .select()
        .single();

      if (error) throw error;

      // If SMS delivery requested, send via edge function
      if (sendViaSMS && recipientPhone && recipientType && recipientId && recipientName) {
        try {
          const { error: smsError } = await supabase.functions.invoke("send-sms", {
            body: {
              recipientType,
              recipientId,
              recipientName,
              recipientPhone,
              content,
            },
          });

          if (smsError) {
            console.error("Failed to send SMS:", smsError);
            // Update message type back to in_app if SMS failed
            await supabase
              .from("conversation_messages")
              .update({ message_type: "in_app" })
              .eq("id", data.id);
          }
        } catch (smsErr) {
          console.error("SMS sending error:", smsErr);
        }
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["conversation-messages", variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useGetOrCreateConversation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      participantType,
      participantId,
    }: {
      participantType: "user" | "personnel" | "customer" | "applicant";
      participantId: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Check if conversation already exists (in either direction)
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("*")
        .or(
          `and(participant_1_type.eq.user,participant_1_id.eq.${user.id},participant_2_type.eq.${participantType},participant_2_id.eq.${participantId}),and(participant_1_type.eq.${participantType},participant_1_id.eq.${participantId},participant_2_type.eq.user,participant_2_id.eq.${user.id})`
        )
        .maybeSingle();

      if (existingConv) {
        return existingConv;
      }

      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .insert({
          participant_1_type: "user",
          participant_1_id: user.id,
          participant_2_type: participantType,
          participant_2_id: participantId,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Create participant records for tracking unread counts
      await supabase.from("conversation_participants").insert([
        {
          conversation_id: newConv.id,
          participant_type: "user",
          participant_id: user.id,
          unread_count: 0,
        },
        {
          conversation_id: newConv.id,
          participant_type: participantType,
          participant_id: participantId,
          unread_count: 0,
        },
      ]);

      return newConv;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useMarkConversationAsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!user) throw new Error("Not authenticated");

      const now = new Date().toISOString();

      // Update participant's unread count
      const { error: participantError } = await supabase
        .from("conversation_participants")
        .update({
          unread_count: 0,
          last_read_at: now,
        })
        .eq("conversation_id", conversationId)
        .eq("participant_type", "user")
        .eq("participant_id", user.id);

      if (participantError) throw participantError;

      // Mark all messages NOT sent by current user as read
      const { error: messagesError } = await supabase
        .from("conversation_messages")
        .update({ read_at: now })
        .eq("conversation_id", conversationId)
        .is("read_at", null)
        .neq("sender_id", user.id);

      if (messagesError) throw messagesError;
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
    },
  });
}

export function useTotalUnreadCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Subscribe to participant changes for live updates
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel('unread-count-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversation_participants',
        filter: `participant_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversation_messages',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      })
      .subscribe();
      
    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [user?.id, queryClient]);

  return useQuery({
    queryKey: ["unread-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;

      const { data, error } = await supabase
        .from("conversation_participants")
        .select("unread_count")
        .eq("participant_type", "user")
        .eq("participant_id", user.id);

      if (error) throw error;

      return data?.reduce((sum, p) => sum + (p.unread_count || 0), 0) || 0;
    },
    enabled: !!user,
  });
}

export function useDeleteConversationMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from("conversation_messages")
        .delete()
        .eq("id", messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation-messages"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useDeleteConversation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      // Delete messages first (foreign key constraint)
      const { error: messagesError } = await supabase
        .from("conversation_messages")
        .delete()
        .eq("conversation_id", conversationId);

      if (messagesError) throw messagesError;

      // Delete participants
      const { error: participantsError } = await supabase
        .from("conversation_participants")
        .delete()
        .eq("conversation_id", conversationId);

      if (participantsError) throw participantsError;

      // Delete the conversation
      const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
    },
  });
}
