import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CommunicationLogEntry {
  id: string;
  content: string;
  message_type: 'sms' | 'email' | 'in_app';
  direction: 'inbound' | 'outbound';
  status: string;
  created_at: string;
  sender_name: string;
  sender_type: 'user' | 'personnel' | 'customer';
  recipient_name: string;
  source: 'conversation' | 'legacy';
}

export function usePersonnelCommunicationLog(personnelId: string | undefined) {
  return useQuery({
    queryKey: ["personnel-communication-log", personnelId],
    queryFn: async (): Promise<CommunicationLogEntry[]> => {
      if (!personnelId) return [];

      // Get personnel info for name resolution
      const { data: personnel } = await supabase
        .from("personnel")
        .select("first_name, last_name")
        .eq("id", personnelId)
        .single();

      const personnelName = personnel 
        ? `${personnel.first_name} ${personnel.last_name}`.trim() 
        : "Personnel";

      // Fetch conversation messages where personnel is a participant
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id, participant_1_type, participant_1_id, participant_2_type, participant_2_id")
        .or(`and(participant_1_type.eq.personnel,participant_1_id.eq.${personnelId}),and(participant_2_type.eq.personnel,participant_2_id.eq.${personnelId})`);

      const conversationIds = conversations?.map(c => c.id) || [];
      
      let conversationMessages: CommunicationLogEntry[] = [];
      
      if (conversationIds.length > 0) {
        const { data: messages } = await supabase
          .from("conversation_messages")
          .select("id, content, message_type, status, created_at, sender_type, sender_id, conversation_id")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false });

        if (messages) {
          // Get unique sender IDs for name resolution
          const userSenderIds = [...new Set(messages.filter(m => m.sender_type === 'user').map(m => m.sender_id))];
          
          // Fetch user profiles
          let profileMap: Record<string, string> = {};
          if (userSenderIds.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, first_name, last_name")
              .in("id", userSenderIds);
            
            if (profiles) {
              profileMap = profiles.reduce((acc, p) => {
                acc[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || "User";
                return acc;
              }, {} as Record<string, string>);
            }
          }

          conversationMessages = messages.map(msg => {
            const isPersonnelSender = msg.sender_type === 'personnel' && msg.sender_id === personnelId;
            const conversation = conversations?.find(c => c.id === msg.conversation_id);
            
            // Determine the other participant name
            let otherParticipantName = "Unknown";
            if (conversation) {
              const isParticipant1 = conversation.participant_1_type === 'personnel' && conversation.participant_1_id === personnelId;
              if (isParticipant1 && conversation.participant_2_type === 'user') {
                otherParticipantName = profileMap[conversation.participant_2_id] || "User";
              } else if (!isParticipant1 && conversation.participant_1_type === 'user') {
                otherParticipantName = profileMap[conversation.participant_1_id] || "User";
              }
            }

            return {
              id: msg.id,
              content: msg.content,
              message_type: (msg.message_type as 'sms' | 'email' | 'in_app') || 'sms',
              direction: isPersonnelSender ? 'inbound' : 'outbound',
              status: msg.status || 'sent',
              created_at: msg.created_at || new Date().toISOString(),
              sender_name: isPersonnelSender ? personnelName : (profileMap[msg.sender_id] || "User"),
              sender_type: msg.sender_type as 'user' | 'personnel',
              recipient_name: isPersonnelSender ? otherParticipantName : personnelName,
              source: 'conversation' as const,
            };
          });
        }
      }

      // Fetch legacy messages
      const { data: legacyMessages } = await supabase
        .from("messages")
        .select("id, content, message_type, status, created_at, sent_by, recipient_name, direction")
        .eq("recipient_type", "personnel")
        .eq("recipient_id", personnelId)
        .order("created_at", { ascending: false });

      let legacyEntries: CommunicationLogEntry[] = [];
      
      if (legacyMessages && legacyMessages.length > 0) {
        // Get sender profiles for legacy messages
        const senderIds = [...new Set(legacyMessages.filter(m => m.sent_by).map(m => m.sent_by!))];
        let senderProfileMap: Record<string, string> = {};
        
        if (senderIds.length > 0) {
          const { data: senderProfiles } = await supabase
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", senderIds);
          
          if (senderProfiles) {
            senderProfileMap = senderProfiles.reduce((acc, p) => {
              acc[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || "User";
              return acc;
            }, {} as Record<string, string>);
          }
        }

        legacyEntries = legacyMessages.map(msg => ({
          id: msg.id,
          content: msg.content,
          message_type: (msg.message_type as 'sms' | 'email') || 'sms',
          direction: (msg.direction === 'inbound' ? 'inbound' : 'outbound') as 'inbound' | 'outbound',
          status: msg.status || 'sent',
          created_at: msg.created_at,
          sender_name: msg.direction === 'inbound' ? personnelName : (msg.sent_by ? senderProfileMap[msg.sent_by] || "User" : "System"),
          sender_type: msg.direction === 'inbound' ? 'personnel' : 'user',
          recipient_name: msg.direction === 'inbound' ? (msg.sent_by ? senderProfileMap[msg.sent_by] || "User" : "System") : personnelName,
          source: 'legacy' as const,
        }));
      }

      // Merge and deduplicate by content + timestamp proximity (within 1 second)
      const allMessages = [...conversationMessages, ...legacyEntries];
      
      // Sort by created_at descending
      allMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Deduplicate based on content and close timestamp
      const seen = new Set<string>();
      const deduplicated = allMessages.filter(msg => {
        const key = `${msg.content.substring(0, 50)}-${Math.floor(new Date(msg.created_at).getTime() / 5000)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return deduplicated;
    },
    enabled: !!personnelId,
  });
}
