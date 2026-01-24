import { useEffect, useRef, useState } from "react";
import { format, isSameDay } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import {
  useConversationMessages,
  useSendConversationMessage,
  useMarkConversationAsRead,
  useDeleteConversationMessage,
  Conversation,
} from "@/integrations/supabase/hooks/useConversations";
import { useTypingIndicator, useTypingSubscription } from "@/hooks/useTypingIndicator";
import { toast } from "sonner";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Building2, User, ArrowLeft, PanelLeftClose, PanelLeftOpen, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConversationThreadProps {
  conversation: Conversation | null;
  onBack?: () => void;
  recipientPhone?: string | null;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export function ConversationThread({ conversation, onBack, recipientPhone, onToggleSidebar, isSidebarCollapsed }: ConversationThreadProps) {
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  const { data: messages, isLoading } = useConversationMessages(conversation?.id || null);
  const sendMessage = useSendConversationMessage();
  const markAsRead = useMarkConversationAsRead();
  const deleteMessage = useDeleteConversationMessage();
  const { setTyping, clearTyping } = useTypingIndicator(conversation?.id || null);
  const typingUsers = useTypingSubscription(conversation?.id || null);

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteMessage.mutateAsync(messageId);
      toast.success("Message deleted");
    } catch (error) {
      toast.error("Failed to delete message");
    }
  };

  // Mark as read when conversation is opened
  useEffect(() => {
    if (conversation?.id) {
      markAsRead.mutate(conversation.id);
    }
  }, [conversation?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages && messages.length > 0 && scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        setHasScrolledToBottom(true);
      }
    }
  }, [messages]);

  const handleSendMessage = async (content: string, sendViaSMS?: boolean) => {
    if (!conversation) return;

    // Get the other participant info
    const isParticipant1 = conversation.participant_1_type === "user";
    const otherType = isParticipant1 ? conversation.participant_2_type : conversation.participant_1_type;
    const otherId = isParticipant1 ? conversation.participant_2_id : conversation.participant_1_id;

    await sendMessage.mutateAsync({
      conversationId: conversation.id,
      content,
      sendViaSMS: sendViaSMS || false,
      recipientType: otherType,
      recipientId: otherId,
      recipientName: conversation.other_participant_name || "Unknown",
      recipientPhone: recipientPhone || undefined,
    });
  };

  const getParticipantIcon = (type: string | undefined) => {
    switch (type) {
      case "personnel":
        return <Users className="h-4 w-4" />;
      case "customer":
        return <Building2 className="h-4 w-4" />;
      case "applicant":
        return <ClipboardList className="h-4 w-4" />;
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

  const getParticipantTypeLabel = (type: string | undefined) => {
    switch (type) {
      case "personnel":
        return "Personnel";
      case "customer":
        return "Customer";
      case "applicant":
        return "Applicant";
      default:
        return "User";
    }
  };

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="rounded-full bg-muted p-6 mb-4">
          <User className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
        <p className="text-sm text-muted-foreground">
          Choose a conversation from the list or start a new one
        </p>
      </div>
    );
  }

  // Group messages by date
  const groupedMessages: { date: Date; messages: typeof messages }[] = [];
  messages?.forEach((message) => {
    const messageDate = new Date(message.created_at);
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    
    if (!lastGroup || !isSameDay(lastGroup.date, messageDate)) {
      groupedMessages.push({ date: messageDate, messages: [message] });
    } else {
      lastGroup.messages?.push(message);
    }
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-background">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        {onToggleSidebar && (
          <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="hidden md:flex">
            {isSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>
        )}
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(conversation.other_participant_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate">{conversation.other_participant_name}</h2>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {getParticipantIcon(conversation.other_participant_type)}
            <span>{getParticipantTypeLabel(conversation.other_participant_type)}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : ""}`}>
                <Skeleton className="h-16 w-48 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : messages?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Send a message to start the conversation
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedMessages.map((group, groupIndex) => (
              <div key={groupIndex}>
                {/* Date separator */}
                <div className="flex items-center justify-center my-4">
                  <Badge variant="secondary" className="text-xs font-normal">
                    {format(group.date, "MMMM d, yyyy")}
                  </Badge>
                </div>

                {/* Messages for this date */}
                <div className="space-y-3">
                  {group.messages?.map((message) => (
                    <MessageBubble
                      key={message.id}
                      content={message.content}
                      senderName={message.sender_name || "Unknown"}
                      timestamp={message.created_at}
                      isOwnMessage={message.sender_type === "user" && message.sender_id === user?.id}
                      isRead={!!message.read_at}
                      isDelivered={!!message.delivered_at}
                      messageType={message.message_type as "in_app" | "sms"}
                      messageId={message.id}
                      onDelete={handleDeleteMessage}
                      isDeleting={deleteMessage.isPending}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            <span className="ml-1">
              {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
            </span>
          </span>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t bg-background">
        <MessageInput
          onSend={handleSendMessage}
          isLoading={sendMessage.isPending}
          placeholder={`Message ${conversation.other_participant_name}...`}
          showSMSToggle={conversation.other_participant_type === "personnel" || conversation.other_participant_type === "customer" || conversation.other_participant_type === "applicant"}
          recipientPhone={recipientPhone}
          onTyping={setTyping}
          onStopTyping={clearTyping}
        />
      </div>
    </div>
  );
}
