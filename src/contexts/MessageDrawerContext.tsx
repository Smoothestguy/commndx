import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { MessageDrawer } from "@/components/messaging/MessageDrawer";
import { useGetOrCreateConversation, Conversation } from "@/integrations/supabase/hooks/useConversations";
import { toast } from "sonner";

type ParticipantType = "personnel" | "customer" | "applicant" | "user";

interface OpenArgs {
  participantType: ParticipantType;
  participantId: string;
  participantName: string;
  participantPhone?: string | null;
}

interface Ctx {
  openConversationWith: (args: OpenArgs) => Promise<void>;
  openConversationById: (conversationId: string) => void;
  close: () => void;
}

const MessageDrawerContext = createContext<Ctx | null>(null);

export function useMessageDrawer() {
  const ctx = useContext(MessageDrawerContext);
  if (!ctx) throw new Error("useMessageDrawer must be used inside MessageDrawerProvider");
  return ctx;
}

export function MessageDrawerProvider({ children }: { children: ReactNode }) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [recipientPhone, setRecipientPhone] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const getOrCreate = useGetOrCreateConversation();

  const openConversationWith = useCallback(async (args: OpenArgs) => {
    try {
      const conv = await getOrCreate.mutateAsync({
        participantType: args.participantType,
        participantId: args.participantId,
      });
      // Build a minimal Conversation object that ConversationThread can consume
      const enriched: Conversation = {
        ...(conv as any),
        other_participant_name: args.participantName,
        other_participant_type: args.participantType,
      };
      setConversation(enriched);
      setConversationId(conv.id);
      setRecipientPhone(args.participantPhone ?? null);
      setOpen(true);
    } catch (e) {
      toast.error("Failed to open conversation");
    }
  }, [getOrCreate]);

  const openConversationById = useCallback((id: string) => {
    setConversationId(id);
    setConversation(null); // drawer will resolve from list
    setRecipientPhone(null);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return (
    <MessageDrawerContext.Provider value={{ openConversationWith, openConversationById, close }}>
      {children}
      <MessageDrawer
        open={open}
        onOpenChange={setOpen}
        conversationId={conversationId}
        seedConversation={conversation}
        recipientPhone={recipientPhone}
      />
    </MessageDrawerContext.Provider>
  );
}
