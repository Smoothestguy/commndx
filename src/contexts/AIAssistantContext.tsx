import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actions?: Array<{ type: string; path?: string; label?: string }>;
}

interface AIAssistantContextType {
  messages: ChatMessage[];
  isLoading: boolean;
  isOpen: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearHistory: () => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
}

const AIAssistantContext = createContext<AIAssistantContextType | undefined>(undefined);

export function AIAssistantProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      // Build message history for context (last 10 messages)
      const messageHistory = [...messages, userMessage].slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const { data, error: invokeError } = await supabase.functions.invoke("ai-assistant", {
        body: { messages: messageHistory },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content || "I processed your request.",
        timestamp: new Date(),
        actions: data.actions,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Handle any navigation actions
      if (data.actions && data.actions.length > 0) {
        for (const action of data.actions) {
          if (action.type === "navigate" && action.path) {
            toast({
              title: "Navigating...",
              description: `Going to ${action.path}`,
            });
            setTimeout(() => {
              navigate(action.path);
              setIsOpen(false);
            }, 1000);
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to get response";
      setError(errorMessage);
      
      const errorAssistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorAssistantMessage]);
      
      toast({
        title: "AI Assistant Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [messages, navigate, toast]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return (
    <AIAssistantContext.Provider
      value={{
        messages,
        isLoading,
        isOpen,
        error,
        sendMessage,
        clearHistory,
        toggleOpen,
        setOpen: setIsOpen,
      }}
    >
      {children}
    </AIAssistantContext.Provider>
  );
}

export function useAIAssistant() {
  const context = useContext(AIAssistantContext);
  if (context === undefined) {
    throw new Error("useAIAssistant must be used within an AIAssistantProvider");
  }
  return context;
}
