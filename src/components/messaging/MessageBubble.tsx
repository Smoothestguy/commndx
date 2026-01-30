import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Check, CheckCheck, Smartphone, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FailedMessageIndicator } from "./FailedMessageIndicator";
import { TranslateButton } from "./TranslateButton";
import { useMessageTranslation, LanguageCode } from "@/hooks/useMessageTranslation";

type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";

interface MessageBubbleProps {
  content: string;
  senderName: string;
  timestamp: string;
  isOwnMessage: boolean;
  isRead?: boolean;
  isDelivered?: boolean;
  messageType?: "in_app" | "sms";
  messageId?: string;
  onDelete?: (messageId: string) => void;
  isDeleting?: boolean;
  // New status-related props
  status?: MessageStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  onRetry?: (messageId: string) => void;
  isRetrying?: boolean;
  // Translation props
  defaultTranslationLanguage?: LanguageCode;
}

export function MessageBubble({
  content,
  senderName,
  timestamp,
  isOwnMessage,
  isRead,
  isDelivered,
  messageType = "in_app",
  messageId,
  onDelete,
  isDeleting,
  status,
  errorCode,
  errorMessage,
  onRetry,
  isRetrying,
  defaultTranslationLanguage = "en",
}: MessageBubbleProps) {
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const { translateMessage, isTranslating } = useMessageTranslation();

  const canDelete = isOwnMessage && messageId && onDelete;
  const canTranslate = !isOwnMessage; // Only translate incoming messages
  const isFailed = status === "failed";
  const isSending = status === "sending";

  // Determine effective status from legacy props if not provided
  const effectiveStatus = status || (isRead ? "read" : isDelivered ? "delivered" : "sent");

  const handleTranslate = async () => {
    if (translatedText) {
      // Already translated - clear it
      setTranslatedText(null);
      setDetectedLanguage(null);
      return;
    }

    const result = await translateMessage(content, defaultTranslationLanguage);
    if (result) {
      setTranslatedText(result.translatedText);
      setDetectedLanguage(result.detectedLanguage || null);
    }
  };

  const handleClearTranslation = () => {
    setTranslatedText(null);
    setDetectedLanguage(null);
  };

  const renderStatusIcon = () => {
    if (isSending) {
      return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
    }
    
    if (isFailed) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle className="h-3 w-3 text-destructive" />
            </TooltipTrigger>
            <TooltipContent side="left">
              <p className="text-xs">Failed to send - tap for details</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    switch (effectiveStatus) {
      case "read":
        return <CheckCheck className="h-3 w-3 text-primary" />;
      case "delivered":
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "sent":
      default:
        return <Check className="h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <div
      className={cn(
        "group flex flex-col max-w-[80%] sm:max-w-[70%]",
        isOwnMessage ? "ml-auto items-end" : "mr-auto items-start"
      )}
    >
      {!isOwnMessage && (
        <span className="text-xs text-muted-foreground mb-1 px-1">
          {senderName}
        </span>
      )}

      <div className="flex items-center gap-1">
        {/* Translate button for incoming messages - appears on left */}
        {canTranslate && (
          <TranslateButton
            onClick={handleTranslate}
            isTranslating={isTranslating}
            isTranslated={!!translatedText}
            onClearTranslation={translatedText ? handleClearTranslation : undefined}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          />
        )}

        {/* Delete button for own messages - appears on left */}
        {canDelete && isOwnMessage && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                disabled={isDeleting}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Message</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this message? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(messageId)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <div
          className={cn(
            "rounded-2xl px-4 py-2 break-words",
            isOwnMessage
              ? isFailed
                ? "bg-destructive/20 text-foreground rounded-br-md border border-destructive/30"
                : "bg-[#007AFF] text-white rounded-br-md" // iPad Messages blue
              : "bg-[#E9E9EB] dark:bg-[#3A3A3C] text-foreground rounded-bl-md", // iPad gray
            isSending && "opacity-70"
          )}
        >
          <p className="text-sm whitespace-pre-wrap">
            {translatedText || content}
          </p>
          
          {/* Show translation indicator */}
          {translatedText && detectedLanguage && (
            <p className="text-xs opacity-70 mt-1 italic">
              Translated from {detectedLanguage}
            </p>
          )}
        </div>
      </div>

      {/* Failed message details */}
      {isFailed && isOwnMessage && onRetry && messageId && (
        <FailedMessageIndicator
          errorCode={errorCode}
          errorMessage={errorMessage}
          onRetry={() => onRetry(messageId)}
          isRetrying={isRetrying}
          className="mt-1 max-w-full"
        />
      )}

      <div className="flex items-center gap-1 mt-1 px-1">
        <span className={cn(
          "text-xs",
          isFailed ? "text-destructive" : "text-muted-foreground"
        )}>
          {format(new Date(timestamp), "h:mm a")}
        </span>
        {messageType === "sms" && (
          <Smartphone className={cn(
            "h-3 w-3",
            isFailed ? "text-destructive" : "text-muted-foreground"
          )} />
        )}
        {isOwnMessage && (
          <span className="text-muted-foreground">
            {renderStatusIcon()}
          </span>
        )}
      </div>
    </div>
  );
}
