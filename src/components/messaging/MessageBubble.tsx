import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Check, CheckCheck } from "lucide-react";

interface MessageBubbleProps {
  content: string;
  senderName: string;
  timestamp: string;
  isOwnMessage: boolean;
  isRead?: boolean;
  isDelivered?: boolean;
}

export function MessageBubble({
  content,
  senderName,
  timestamp,
  isOwnMessage,
  isRead,
  isDelivered,
}: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "flex flex-col max-w-[80%] sm:max-w-[70%]",
        isOwnMessage ? "ml-auto items-end" : "mr-auto items-start"
      )}
    >
      {!isOwnMessage && (
        <span className="text-xs text-muted-foreground mb-1 px-1">
          {senderName}
        </span>
      )}
      
      <div
        className={cn(
          "rounded-2xl px-4 py-2 break-words",
          isOwnMessage
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted rounded-bl-md"
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </div>

      <div className="flex items-center gap-1 mt-1 px-1">
        <span className="text-xs text-muted-foreground">
          {format(new Date(timestamp), "h:mm a")}
        </span>
        {isOwnMessage && (
          <span className="text-muted-foreground">
            {isRead ? (
              <CheckCheck className="h-3 w-3 text-primary" />
            ) : isDelivered ? (
              <CheckCheck className="h-3 w-3" />
            ) : (
              <Check className="h-3 w-3" />
            )}
          </span>
        )}
      </div>
    </div>
  );
}
