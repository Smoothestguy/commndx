import { format, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";
import { useConversations, Conversation } from "@/integrations/supabase/hooks/useConversations";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, User, Users, Building2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ConversationListProps {
  selectedConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
}

export function ConversationList({ selectedConversationId, onSelectConversation }: ConversationListProps) {
  const { data: conversations, isLoading } = useConversations();

  const formatMessageTime = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, "h:mm a");
    }
    if (isYesterday(date)) {
      return "Yesterday";
    }
    return format(date, "MMM d");
  };

  const getParticipantIcon = (type: string | undefined) => {
    switch (type) {
      case "personnel":
        return <Users className="h-4 w-4" />;
      case "customer":
        return <Building2 className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm text-muted-foreground">No conversations yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Start a new conversation to begin messaging
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="divide-y">
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => onSelectConversation(conversation)}
            className={cn(
              "w-full flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors text-left",
              selectedConversationId === conversation.id && "bg-muted"
            )}
          >
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(conversation.other_participant_name)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-medium truncate">
                    {conversation.other_participant_name}
                  </span>
                  <span className="text-muted-foreground flex-shrink-0">
                    {getParticipantIcon(conversation.other_participant_type)}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatMessageTime(conversation.last_message_at)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-sm text-muted-foreground truncate">
                  {conversation.last_message_preview || "No messages yet"}
                </p>
                {(conversation.unread_count ?? 0) > 0 && (
                  <Badge
                    variant="default"
                    className="h-5 min-w-[20px] px-1.5 text-xs font-medium flex-shrink-0"
                  >
                    {conversation.unread_count}
                  </Badge>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
