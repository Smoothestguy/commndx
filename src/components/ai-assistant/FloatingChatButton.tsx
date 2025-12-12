import React from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAIAssistant } from "@/contexts/AIAssistantContext";

export function FloatingChatButton() {
  const { isOpen, toggleOpen, messages } = useAIAssistant();

  return (
    <Button
      onClick={toggleOpen}
      size="icon"
      className={cn(
        "fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg",
        "transition-all duration-300 hover:scale-105",
        "md:bottom-6 md:right-6",
        isOpen
          ? "bg-muted text-muted-foreground hover:bg-muted/90"
          : "bg-primary text-primary-foreground hover:bg-primary/90"
      )}
    >
      {isOpen ? (
        <X className="h-6 w-6" />
      ) : (
        <>
          <MessageCircle className="h-6 w-6" />
          {messages.length === 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-accent"></span>
            </span>
          )}
        </>
      )}
    </Button>
  );
}
