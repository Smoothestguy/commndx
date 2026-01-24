import React from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAIAssistant } from "@/contexts/AIAssistantContext";
import { useDraggable } from "@/hooks/useDraggable";

export function FloatingChatButton() {
  const { isOpen, toggleOpen, messages } = useAIAssistant();
  const { position, isDragging, hasDragged, handleMouseDown, handleTouchStart } = useDraggable({
    storageKey: "ai-chat-button-position",
    bounds: { top: 80, right: 20, bottom: 80, left: 20 },
  });

  const handleClick = () => {
    // Only toggle if we didn't just drag
    if (!hasDragged()) {
      toggleOpen();
    }
  };

  return (
    <Button
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
      size="icon"
      style={{
        left: position.x,
        top: position.y,
        touchAction: 'none',
      }}
      className={cn(
        "fixed z-40 h-14 w-14 rounded-full shadow-lg",
        "transition-transform duration-150",
        isDragging ? "cursor-grabbing scale-110" : "cursor-grab hover:scale-105",
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
