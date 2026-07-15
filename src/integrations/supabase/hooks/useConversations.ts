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
  other_participant_photo_url?: string | null;
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
  metadata?: {
    is_blast?: boolean;
    bulk_batch_id?: string;
    project_id?: string | null;
    project_name?: string | null;
    recipient_count?: number;
    [key: string]: unknown;
  } | null;
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

      // Get conversations where the user has a participant row. This supports
      // shared inbox conversations routed to multiple internal users.
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
        .eq("conversation_participants.participant_type", "user")
        .eq("conversation_participants.participant_id", user.id)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Enrich with participant names
      const enrichedConversations = await Promise.all(
        (conversations || []).map(async (conv) => {
          // Determine the "other" participant
          const isParticipant1 = conv.participant_1_type === "user" && conv.participant_1_id === user.id;
          const isParticipant2 = conv.participant_2_type === "user" && conv.participant_2_id === user.id;
          let otherType = isParticipant1 ? conv.participant_2_type : conv.participant_1_type;
          let otherId = isParticipant1 ? conv.participant_2_id : conv.participant_1_id;

          if (!isParticipant1 && !isParticipant2) {
            if (conv.participant_1_type !== "user") {
              otherType = conv.participant_1_type;
              otherId = conv.participant_1_id;
            } else if (conv.participant_2_type !== "user") {
              otherType = conv.participant_2_type;
              otherId = conv.participant_2_id;
            }
          }

          let otherName = "Unknown";
          let otherPhotoUrl: string | null = null;

          if (otherType === "user") {
            const { data: profile } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("id", otherId)
              .maybeSingle();
            if (profile) {
              otherName = `${profile.first_name} ${profile.last_name}`.trim() || "Unknown User";
            }
          } else if (otherType === "personnel") {
            const { data: personnel } = await supabase
              .from("personnel")
              .select("first_name, last_name, photo_url")
              .eq("id", otherId)
              .maybeSingle();
            if (personnel) {
              otherName = `${personnel.first_name} ${personnel.last_name}`.trim();
              otherPhotoUrl = personnel.photo_url || null;
            }
          } else if (otherType === "customer") {
            const { data: customer } = await supabase
              .from("customers")
              .select("name")
              .eq("id", otherId)
              .maybeSingle();
            if (customer) {
              otherName = customer.name;
            }
          } else if (otherType === "applicant") {
            const { data: applicant } = await supabase
              .from("applicants")
              .select("first_name, last_name, photo_url")
              .eq("id", otherId)
              .maybeSingle();
            if (applicant) {
              otherName = `${applicant.first_name} ${applicant.last_name}`.trim();
              otherPhotoUrl = applicant.photo_url || null;
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
            other_participant_photo_url: otherPhotoUrl,
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
      .channel(`conversations-changes-${user.id}-${Math.random().toString(36).slice(2)}`)
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

/**
 * Admin/manager view of ALL conversations (no participant filter).
 * RLS gates access; only render for admin/manager.
 */
export function useAllConversations(enabled: boolean = true) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["conversations", "all"],
    queryFn: async () => {
      const { data: conversations, error } = await supabase
        .from("conversations")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (error) throw error;

      const userIds = new Set<string>();
      const personnelIds = new Set<string>();
      const customerIds = new Set<string>();
      const applicantIds = new Set<string>();
      (conversations || []).forEach((c) => {
        [
          [c.participant_1_type, c.participant_1_id],
          [c.participant_2_type, c.participant_2_id],
        ].forEach(([t, id]) => {
          if (!id) return;
          if (t === "user") userIds.add(id as string);
          else if (t === "personnel") personnelIds.add(id as string);
          else if (t === "customer") customerIds.add(id as string);
          else if (t === "applicant") applicantIds.add(id as string);
        });
      });

      const [profilesRes, personnelRes, customersRes, applicantsRes] = await Promise.all([
        userIds.size
          ? supabase.from("profiles").select("id, first_name, last_name").in("id", Array.from(userIds))
          : Promise.resolve({ data: [] as any[] }),
        personnelIds.size
          ? supabase.from("personnel").select("id, first_name, last_name, photo_url").in("id", Array.from(personnelIds))
          : Promise.resolve({ data: [] as any[] }),
        customerIds.size
          ? supabase.from("customers").select("id, name").in("id", Array.from(customerIds))
          : Promise.resolve({ data: [] as any[] }),
        applicantIds.size
          ? supabase.from("applicants").select("id, first_name, last_name, photo_url").in("id", Array.from(applicantIds))
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profileMap = new Map<string, string>((profilesRes.data || []).map((p: any) => [p.id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Unknown User"]));
      const personnelMap = new Map<string, { name: string; photo: string | null }>((personnelRes.data || []).map((p: any) => [p.id, { name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(), photo: p.photo_url || null }]));
      const customerMap = new Map<string, string>((customersRes.data || []).map((c: any) => [c.id, c.name]));
      const applicantMap = new Map<string, { name: string; photo: string | null }>((applicantsRes.data || []).map((a: any) => [a.id, { name: `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim(), photo: a.photo_url || null }]));

      const resolve = (type: string, id: string): { name: string; photo: string | null } => {
        if (type === "user") return { name: profileMap.get(id) || "Unknown User", photo: null };
        if (type === "personnel") return personnelMap.get(id) || { name: "Unknown", photo: null };
        if (type === "customer") return { name: customerMap.get(id) || "Unknown", photo: null };
        if (type === "applicant") return applicantMap.get(id) || { name: "Unknown", photo: null };
        return { name: "Unknown", photo: null };
      };

      return (conversations || []).map((conv) => {
        const isMineP1 = conv.participant_1_type === "user" && conv.participant_1_id === user?.id;
        let otherType = conv.participant_2_type;
        let otherId = conv.participant_2_id;
        if (conv.participant_1_type !== "user") {
          otherType = conv.participant_1_type;
          otherId = conv.participant_1_id;
        }
        const other = resolve(otherType, otherId);
        const owner = resolve(conv.participant_1_type, conv.participant_1_id);
        return {
          ...conv,
          other_participant_name: other.name,
          other_participant_type: otherType,
          other_participant_photo_url: other.photo,
          unread_count: 0,
          owner_id: conv.participant_1_id,
          owner_name: owner.name,
          is_owned_by_me: isMineP1,
        } as Conversation & { owner_id: string; owner_name: string; is_owned_by_me: boolean };
      });
    },
    enabled: enabled && !!user,
  });

  useEffect(() => {
    if (!enabled || !user) return;
    const channel = supabase
      .channel(`all-conversations-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        queryClient.invalidateQueries({ queryKey: ["conversations", "all"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["conversations", "all"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, user, queryClient]);

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
              .maybeSingle();
            if (profile) {
              senderName = `${profile.first_name} ${profile.last_name}`.trim() || "Unknown User";
            }
          } else if (msg.sender_type === "personnel") {
            const { data: personnel } = await supabase
              .from("personnel")
              .select("first_name, last_name")
              .eq("id", msg.sender_id)
              .maybeSingle();
            if (personnel) {
              senderName = `${personnel.first_name} ${personnel.last_name}`.trim();
            }
          } else if (msg.sender_type === "customer") {
            const { data: customer } = await supabase
              .from("customers")
              .select("name")
              .eq("id", msg.sender_id)
              .maybeSingle();
            if (customer) {
              senderName = customer.name;
            }
          } else if (msg.sender_type === "applicant") {
            const { data: applicant } = await supabase
              .from("applicants")
              .select("first_name, last_name")
              .eq("id", msg.sender_id)
              .maybeSingle();
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

      // Ensure current user has a participant row on this conversation
      // (covers admins replying inside threads they don't own).
      try {
        const { data: existingParticipant } = await supabase
          .from("conversation_participants")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("participant_type", "user")
          .eq("participant_id", user.id)
          .maybeSingle();
        if (!existingParticipant) {
          await supabase.from("conversation_participants").insert({
            conversation_id: conversationId,
            participant_type: "user",
            participant_id: user.id,
            unread_count: 0,
          });
        }
      } catch (e) {
        // Ignore duplicate-key or race errors
      }

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
      queryClient.invalidateQueries({ queryKey: ["conversations", "all"] });
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
      .channel(`unread-count-realtime-${user.id}-${Math.random().toString(36).slice(2)}`)
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
