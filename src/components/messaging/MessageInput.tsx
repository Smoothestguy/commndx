import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Smartphone, Globe, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMessageTranslation, SUPPORTED_LANGUAGES, LanguageCode } from "@/hooks/useMessageTranslation";
import { MessageTranslationPreview } from "./MessageTranslationPreview";

interface MessageInputProps {
  onSend: (content: string, sendViaSMS?: boolean) => Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
  showSMSToggle?: boolean;
  recipientPhone?: string | null;
  onTyping?: () => void;
  onStopTyping?: () => void;
  showTranslation?: boolean;
}

export function MessageInput({
  onSend,
  isLoading,
  placeholder = "Type a message...",
  showSMSToggle = false,
  recipientPhone,
  onTyping,
  onStopTyping,
  showTranslation = true,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [sendViaSMS, setSendViaSMS] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Translation state
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode | null>(null);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslationMode, setIsTranslationMode] = useState(false);
  const { translateMessage, isTranslating } = useMessageTranslation();

  const hasSMSCapability = showSMSToggle && recipientPhone;

  const handleSend = async (textToSend?: string) => {
    const finalMessage = textToSend || message;
    const trimmedMessage = finalMessage.trim();
    if (!trimmedMessage || isLoading) return;

    try {
      onStopTyping?.();
      await onSend(trimmedMessage, !!(sendViaSMS && hasSMSCapability));
      setMessage("");
      setTranslatedText(null);
      setIsTranslationMode(false);
      setSelectedLanguage(null);
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift) - but not if in translation mode
    if (e.key === "Enter" && !e.shiftKey && !isTranslationMode) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    onTyping?.();
    
    // Clear translation when message changes
    if (translatedText) {
      setTranslatedText(null);
      setIsTranslationMode(false);
    }

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

  const handleLanguageSelect = async (langCode: LanguageCode) => {
    if (!message.trim()) return;
    
    setSelectedLanguage(langCode);
    setIsTranslationMode(true);
    
    const result = await translateMessage(message, langCode);
    if (result) {
      setTranslatedText(result.translatedText);
    }
  };

  const handleSendTranslated = () => {
    if (translatedText) {
      handleSend(translatedText);
    }
  };

  const handleCancelTranslation = () => {
    setTranslatedText(null);
    setIsTranslationMode(false);
    setSelectedLanguage(null);
  };

  const handleEditTranslation = (text: string) => {
    setTranslatedText(text);
  };

  return (
    <div className="space-y-2">
      {/* Translation preview */}
      {isTranslationMode && selectedLanguage && (
        <MessageTranslationPreview
          originalText={message}
          translatedText={translatedText || ""}
          targetLanguage={selectedLanguage}
          isTranslating={isTranslating}
          onSendTranslated={handleSendTranslated}
          onCancel={handleCancelTranslation}
          onEditTranslation={handleEditTranslation}
        />
      )}

      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[44px] max-h-[120px] resize-none py-3"
          rows={1}
          disabled={isLoading || isTranslationMode}
        />
        
        {/* Translation dropdown */}
        {showTranslation && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  "h-11 w-11 shrink-0",
                  !message.trim() && "opacity-50"
                )}
                disabled={!message.trim() || isLoading || isTranslationMode}
              >
                <Globe className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
              {SUPPORTED_LANGUAGES.filter(l => l.code !== 'en').map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => handleLanguageSelect(lang.code)}
                >
                  <span className="mr-2">{lang.flag}</span>
                  {lang.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
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
                    ? "SMS delivery enabled (default)"
                    : "Click to disable SMS delivery"
                  : "No phone number available"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <Button
          onClick={() => handleSend()}
          disabled={!message.trim() || isLoading || isTranslationMode}
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
    </div>
  );
}
