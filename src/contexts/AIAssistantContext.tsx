import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface FormRequestPrefilled {
  customer_name?: string;
  customer_id?: string;
  project_id?: string;
  line_items?: Array<{ description: string; quantity: number; unit_price: number }>;
}

export interface FormRequest {
  type: "create_estimate" | "create_invoice";
  prefilled?: FormRequestPrefilled;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actions?: Array<{ type: string; path?: string; label?: string }>;
  formRequest?: FormRequest;
}

interface FormSubmission {
  type: "create_estimate" | "create_invoice";
  customer_id: string;
  customer_name: string;
  line_items: Array<{ description: string; quantity: number; unit_price: number }>;
  notes?: string;
}

interface AIAssistantContextType {
  messages: ChatMessage[];
  isLoading: boolean;
  isOpen: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  submitForm: (data: FormSubmission) => Promise<void>;
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
        formRequest: data.formRequest,
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

  const submitForm = useCallback(async (data: FormSubmission) => {
    setIsLoading(true);
    setError(null);

    // Add a user message showing what they submitted
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: `Creating ${data.type === "create_estimate" ? "estimate" : "invoice"} for ${data.customer_name} with ${data.line_items.length} item(s)`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const { data: response, error: invokeError } = await supabase.functions.invoke("ai-assistant", {
        body: { 
          formSubmission: {
            type: data.type,
            customer_id: data.customer_id,
            customer_name: data.customer_name,
            line_items: data.line_items,
            notes: data.notes,
          }
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (response?.error) {
        throw new Error(response.error);
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.content || "Done!",
        timestamp: new Date(),
        actions: response.actions,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Handle navigation
      if (response.actions && response.actions.length > 0) {
        for (const action of response.actions) {
          if (action.type === "navigate" && action.path) {
            toast({
              title: "Success!",
              description: `${data.type === "create_estimate" ? "Estimate" : "Invoice"} created`,
            });
            setTimeout(() => {
              navigate(action.path);
              setIsOpen(false);
            }, 1000);
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create";
      setError(errorMessage);
      
      const errorAssistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Sorry, I couldn't create that: ${errorMessage}`,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorAssistantMessage]);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [navigate, toast]);

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
        submitForm,
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
