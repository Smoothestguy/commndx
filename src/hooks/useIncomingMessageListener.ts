import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMessageBanner, playBannerSound } from "@/contexts/MessageBannerContext";

/**
 * Global listener: subscribes to new conversation_messages inserts and
 * surfaces an iPhone-style banner when the current user is a participant
 * of the conversation, is not the sender, and does not currently have
 * that conversation open on screen.
 */
export function useIncomingMessageListener() {
  const { user } = useAuth();
  const { push, muted } = useMessageBanner();
  const mutedRef = useRef(muted);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    // Cache participation checks + resolved conversations for this session.
    const participationCache = new Map<string, boolean>();

    const isConversationOpen = (conversationId: string): boolean => {
      if (typeof window === "undefined") return false;
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const openId =
        (path.startsWith("/messages") && params.get("conversation")) ||
        (path.startsWith("/conversations") && params.get("id"));
      // Also require the tab to be visible; otherwise still show banner.
      if (openId !== conversationId) return false;
      return document.visibilityState === "visible";
    };

    const resolveSender = async (senderType: string, senderId: string) => {
      try {
        if (senderType === "user") {
          const { data } = await supabase.from("profiles")
            .select("first_name,last_name").eq("id", senderId).maybeSingle();
          return { name: `${data?.first_name ?? ""} ${data?.last_name ?? ""}`.trim() || "New message", photo: null as string | null };
        }
        if (senderType === "personnel") {
          const { data } = await supabase.from("personnel")
            .select("first_name,last_name,photo_url").eq("id", senderId).maybeSingle();
          return { name: `${data?.first_name ?? ""} ${data?.last_name ?? ""}`.trim() || "Personnel", photo: data?.photo_url ?? null };
        }
        if (senderType === "customer") {
          const { data } = await supabase.from("customers")
            .select("name").eq("id", senderId).maybeSingle();
          return { name: data?.name || "Customer", photo: null };
        }
        if (senderType === "applicant") {
          const { data } = await supabase.from("applicants")
            .select("first_name,last_name,photo_url").eq("id", senderId).maybeSingle();
          return { name: `${data?.first_name ?? ""} ${data?.last_name ?? ""}`.trim() || "Applicant", photo: data?.photo_url ?? null };
        }
      } catch { /* ignore */ }
      return { name: "New message", photo: null };
    };

    const channel = supabase
      .channel(`incoming-messages-banner-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_messages" },
        async (payload) => {
          if (cancelled) return;
          const msg: any = payload.new;
          if (!msg?.id || !msg?.conversation_id) return;

          // Skip self-sent messages.
          if (msg.sender_type === "user" && msg.sender_id === user.id) return;

          // Skip if conversation is already open + visible.
          if (isConversationOpen(msg.conversation_id)) return;

          // Verify user participates in this conversation (cached).
          let participates = participationCache.get(msg.conversation_id);
          if (participates === undefined) {
            const { data } = await supabase
              .from("conversation_participants")
              .select("id")
              .eq("conversation_id", msg.conversation_id)
              .eq("participant_type", "user")
              .eq("participant_id", user.id)
              .maybeSingle();
            participates = !!data;
            participationCache.set(msg.conversation_id, participates);
          }
          if (!participates) return;

          const { name, photo } = await resolveSender(msg.sender_type, msg.sender_id);

          push({
            id: msg.id,
            conversationId: msg.conversation_id,
            senderName: name,
            senderPhotoUrl: photo,
            preview: (msg.content || "").toString(),
            timestamp: msg.created_at || new Date().toISOString(),
          });

          if (!mutedRef.current) playBannerSound();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id, push]);
}
