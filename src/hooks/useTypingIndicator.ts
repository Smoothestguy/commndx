import { useCallback, useRef, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useTypingIndicator(conversationId: string | null) {
  const { user } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout>();

  const setTyping = useCallback(async () => {
    if (!conversationId || !user) return;

    // Fetch user's name from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();

    const userName = profile 
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User'
      : 'User';

    // Upsert typing status
    await supabase
      .from("typing_indicators")
      .upsert({
        conversation_id: conversationId,
        user_id: user.id,
        user_type: "user",
        user_name: userName,
        started_at: new Date().toISOString(),
      }, { onConflict: 'conversation_id,user_id,user_type' });

    // Clear previous timeout
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Auto-clear after 3 seconds of no typing
    timeoutRef.current = setTimeout(async () => {
      await supabase
        .from("typing_indicators")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id);
    }, 3000);
  }, [conversationId, user]);

  const clearTyping = useCallback(async () => {
    if (!conversationId || !user) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    await supabase
      .from("typing_indicators")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
  }, [conversationId, user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (conversationId && user) {
        supabase
          .from("typing_indicators")
          .delete()
          .eq("conversation_id", conversationId)
          .eq("user_id", user.id);
      }
    };
  }, [conversationId, user]);

  return { setTyping, clearTyping };
}

export function useTypingSubscription(conversationId: string | null) {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!conversationId) {
      setTypingUsers([]);
      return;
    }

    // Initial fetch
    const fetchTypingUsers = async () => {
      const { data } = await supabase
        .from("typing_indicators")
        .select("user_name, user_id")
        .eq("conversation_id", conversationId)
        .neq("user_id", user?.id || "");
      
      setTypingUsers(data?.map(t => t.user_name) || []);
    };

    fetchTypingUsers();

    // Subscribe to changes
    const channel = supabase
      .channel(`typing-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_indicators",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          fetchTypingUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user?.id]);

  return typingUsers;
}
