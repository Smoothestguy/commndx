import React from "react";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import type { ChatMessage as ChatMessageType } from "@/contexts/AIAssistantContext";
import { useAIAssistant } from "@/contexts/AIAssistantContext";
import { EstimateFormInline } from "./forms/EstimateFormInline";
import { InvoiceFormInline } from "./forms/InvoiceFormInline";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const navigate = useNavigate();
  const { submitForm, isLoading } = useAIAssistant();
  const isUser = message.role === "user";

  const handleActionClick = (action: { type: string; path?: string }) => {
    if (action.type === "navigate" && action.path) {
      navigate(action.path);
    }
  };

  const handleFormSubmit = (data: {
    type: "create_estimate" | "create_invoice";
    customer_id: string;
    customer_name: string;
    line_items: Array<{ description: string; quantity: number; unit_price: number }>;
    notes?: string;
  }) => {
    submitForm(data);
  };

  // Simple markdown-like formatting
  const formatContent = (content: string) => {
    // Convert **bold** to strong
    let formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Convert *italic* to em
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Convert line breaks
    formatted = formatted.replace(/\n/g, '<br/>');
    return formatted;
  };

  return (
    <div
      className={cn(
        "flex gap-3 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          "rounded-2xl px-4 py-2.5",
          message.formRequest 
            ? "max-w-full w-full" 
            : "max-w-[80%]",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md"
        )}
      >
        <div
          className="text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
        />

        {/* Inline Form for Estimate */}
        {message.formRequest && message.formRequest.type === "create_estimate" && (
          <EstimateFormInline
            prefilled={message.formRequest.prefilled}
            onSubmit={handleFormSubmit}
            isSubmitting={isLoading}
          />
        )}

        {/* Inline Form for Invoice */}
        {message.formRequest && message.formRequest.type === "create_invoice" && (
          <InvoiceFormInline
            prefilled={message.formRequest.prefilled}
            onSubmit={handleFormSubmit}
            isSubmitting={isLoading}
          />
        )}

        {/* Action Buttons */}
        {message.actions && message.actions.length > 0 && !message.formRequest && (
          <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-border/20">
            {message.actions.map((action, index) => (
              <Button
                key={index}
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleActionClick(action)}
              >
                {action.type === "navigate" ? "View" : action.type}
              </Button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div
          className={cn(
            "text-[10px] mt-1 opacity-60",
            isUser ? "text-right" : "text-left"
          )}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}
