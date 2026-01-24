import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MessageInputProps {
  onSend: (content: string, sendViaSMS?: boolean) => Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
  showSMSToggle?: boolean;
  recipientPhone?: string | null;
  onTyping?: () => void;
  onStopTyping?: () => void;
}

export function MessageInput({
  onSend,
  isLoading,
  placeholder = "Type a message...",
  showSMSToggle = false,
  recipientPhone,
  onTyping,
  onStopTyping,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [sendViaSMS, setSendViaSMS] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasSMSCapability = showSMSToggle && recipientPhone;

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isLoading) return;

    try {
      onStopTyping?.();
      await onSend(trimmedMessage, !!(sendViaSMS && hasSMSCapability));
      setMessage("");
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    onTyping?.();

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  const toggleSMS = () => {
    if (hasSMSCapability) {
      setSendViaSMS(!sendViaSMS);
    }
  };

  return (
    <div className="flex items-end gap-2">
      <Textarea
        ref={textareaRef}
        value={message}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="min-h-[44px] max-h-[120px] resize-none py-3"
        rows={1}
        disabled={isLoading}
      />
      {showSMSToggle && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={sendViaSMS ? "default" : "outline"}
                size="icon"
                className={cn(
                  "h-11 w-11 shrink-0 transition-colors",
                  !hasSMSCapability && "opacity-50 cursor-not-allowed"
                )}
                onClick={toggleSMS}
                disabled={!hasSMSCapability}
              >
                <Smartphone className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {hasSMSCapability
                ? sendViaSMS
                  ? "SMS delivery enabled"
                  : "Click to also send via SMS"
                : "No phone number available"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      <Button
        onClick={handleSend}
        disabled={!message.trim() || isLoading}
        size="icon"
        className="h-11 w-11 shrink-0"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Send className="h-5 w-5" />
        )}
      </Button>
    </div>
  );
}
