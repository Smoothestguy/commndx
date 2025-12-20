import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface AiDevConversation {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiDevMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  context?: {
    route?: string;
    code?: string;
    error?: string;
    schema?: string;
  };
  response_data?: {
    plan?: string[];
    files_to_edit?: string[];
    patches?: Array<{
      file: string;
      explanation: string;
      code: string;
    }>;
    questions?: string[];
    notes?: string;
  };
  created_at: string;
}

export function useAiDevConversations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<AiDevConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<AiDevConversation | null>(null);
  const [messages, setMessages] = useState<AiDevMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all conversations
  const fetchConversations = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("ai_dev_conversations")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching conversations:", error);
      return;
    }

    setConversations(data || []);
    setLoading(false);
  };

  // Fetch messages for a conversation
  const fetchMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from("ai_dev_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      return;
    }

    setMessages((data || []) as AiDevMessage[]);
  };

  // Create a new conversation
  const createConversation = async (title?: string): Promise<AiDevConversation | null> => {
    if (!user) return null;

    const { data, error } = await supabase
      .from("ai_dev_conversations")
      .insert({
        user_id: user.id,
        title: title || "New Conversation",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating conversation:", error);
      toast({
        title: "Error",
        description: "Failed to create conversation",
        variant: "destructive",
      });
      return null;
    }

    setConversations((prev) => [data, ...prev]);
    setCurrentConversation(data);
    setMessages([]);
    return data;
  };

  // Add a message to a conversation
  const addMessage = async (
    conversationId: string,
    role: "user" | "assistant",
    content: string,
    context?: AiDevMessage["context"],
    responseData?: AiDevMessage["response_data"]
  ): Promise<AiDevMessage | null> => {
    const { data, error } = await supabase
      .from("ai_dev_messages")
      .insert({
        conversation_id: conversationId,
        role,
        content,
        context: context || {},
        response_data: responseData || {},
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding message:", error);
      return null;
    }

    const newMessage = data as AiDevMessage;
    setMessages((prev) => [...prev, newMessage]);

    // Update conversation title if it's the first user message
    if (role === "user" && messages.length === 0) {
      const shortTitle = content.slice(0, 50) + (content.length > 50 ? "..." : "");
      await supabase
        .from("ai_dev_conversations")
        .update({ title: shortTitle, updated_at: new Date().toISOString() })
        .eq("id", conversationId);
      
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, title: shortTitle } : c
        )
      );
    } else {
      // Just update the timestamp
      await supabase
        .from("ai_dev_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    return newMessage;
  };

  // Delete a conversation
  const deleteConversation = async (conversationId: string) => {
    const { error } = await supabase
      .from("ai_dev_conversations")
      .delete()
      .eq("id", conversationId);

    if (error) {
      console.error("Error deleting conversation:", error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive",
      });
      return;
    }

    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    if (currentConversation?.id === conversationId) {
      setCurrentConversation(null);
      setMessages([]);
    }
  };

  // Select a conversation
  const selectConversation = async (conversation: AiDevConversation) => {
    setCurrentConversation(conversation);
    await fetchMessages(conversation.id);
  };

  useEffect(() => {
    fetchConversations();
  }, [user]);

  return {
    conversations,
    currentConversation,
    messages,
    loading,
    createConversation,
    addMessage,
    deleteConversation,
    selectConversation,
    setCurrentConversation,
    setMessages,
  };
}
