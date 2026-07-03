import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalLink, X } from "lucide-react";
import { ConversationThread } from "./ConversationThread";
import {
  Conversation,
  useConversations,
} from "@/integrations/supabase/hooks/useConversations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MessageDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  seedConversation: Conversation | null;
  recipientPhone: string | null;
}

export function MessageDrawer({
  open,
  onOpenChange,
  conversationId,
  seedConversation,
  recipientPhone,
}: MessageDrawerProps) {
  const { data: conversations } = useConversations();

  // Prefer enriched conversation from list (has other_participant_name); fall back to seed
  const conversation: Conversation | null = useMemo(() => {
    if (!conversationId) return null;
    const found = conversations?.find((c) => c.id === conversationId);
    return found || seedConversation;
  }, [conversationId, conversations, seedConversation]);

  // Lookup phone if not provided
  const { data: fetchedPhone } = useQuery({
    queryKey: ["drawer-recipient-phone", conversation?.id],
    queryFn: async () => {
      if (!conversation) return null;
      const isP1 = conversation.participant_1_type === "user";
      const otherType = isP1 ? conversation.participant_2_type : conversation.participant_1_type;
      const otherId = isP1 ? conversation.participant_2_id : conversation.participant_1_id;
      if (otherType === "personnel") {
        const { data } = await supabase.from("personnel").select("phone").eq("id", otherId).maybeSingle();
        return data?.phone || null;
      } else if (otherType === "customer") {
        const { data } = await supabase.from("customers").select("phone").eq("id", otherId).maybeSingle();
        return data?.phone || null;
      } else if (otherType === "applicant") {
        const { data } = await supabase.from("applicants").select("phone").eq("id", otherId).maybeSingle();
        return data?.phone || null;
      }
      return null;
    },
    enabled: open && !!conversation && !recipientPhone,
  });

  const phone = recipientPhone || fetchedPhone || null;

  const openFullPage = () => {
    if (!conversationId) return;
    window.open(`/messages?conversation=${conversationId}`, "_blank", "noopener,noreferrer");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col gap-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Open-in-new-tab sits to the left of Sheet's built-in close button */}
        <button
          type="button"
          onClick={openFullPage}
          disabled={!conversationId}
          title="Open in new tab"
          aria-label="Open in new tab"
          className="absolute right-12 top-4 z-10 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-30"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
        <div className="flex-1 min-h-0 pt-2">
          <ConversationThread
            conversation={conversation}
            recipientPhone={phone}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
