import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Check, CheckCheck, Smartphone, Trash2 } from "lucide-react";
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
}: MessageBubbleProps) {
  const canDelete = isOwnMessage && messageId && onDelete;

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
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted rounded-bl-md"
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 mt-1 px-1">
        <span className="text-xs text-muted-foreground">
          {format(new Date(timestamp), "h:mm a")}
        </span>
        {messageType === "sms" && (
          <Smartphone className="h-3 w-3 text-muted-foreground" />
        )}
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
