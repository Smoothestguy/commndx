import { useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";
import { useConversations, useDeleteConversation, Conversation } from "@/integrations/supabase/hooks/useConversations";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, User, Users, Building2, Trash2, Search, ClipboardList } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface ConversationListProps {
  selectedConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  onConversationDeleted?: (conversationId: string) => void;
}

export function ConversationList({ 
  selectedConversationId, 
  onSelectConversation,
  onConversationDeleted 
}: ConversationListProps) {
  const { data: conversations, isLoading } = useConversations();
  const deleteConversation = useDeleteConversation();
  const { toast } = useToast();
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter conversations based on search
  const filteredConversations = conversations?.filter((conv) =>
    conv.other_participant_name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

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
        return <Users className="h-3.5 w-3.5 text-blue-500" />;
      case "customer":
        return <Building2 className="h-3.5 w-3.5 text-green-500" />;
      case "applicant":
        return <ClipboardList className="h-3.5 w-3.5 text-purple-500" />;
      default:
        return <User className="h-3.5 w-3.5 text-muted-foreground" />;
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

  const handleDeleteClick = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    setConversationToDelete(conversationId);
  };

  const handleConfirmDelete = async () => {
    if (!conversationToDelete) return;
    
    try {
      await deleteConversation.mutateAsync(conversationToDelete);
      toast({ title: "Conversation deleted" });
      onConversationDeleted?.(conversationToDelete);
    } catch (error) {
      toast({ 
        title: "Failed to delete conversation", 
        variant: "destructive" 
      });
    } finally {
      setConversationToDelete(null);
    }
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
    <>
      {/* iPad-style Search Bar */}
      <div className="p-3 border-b flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 rounded-full bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-[#007AFF]"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 w-full">
        <div className="divide-y w-full">
          {filteredConversations.length === 0 && searchQuery && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No conversations found
            </div>
          )}
          {filteredConversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelectConversation(conversation)}
              className={cn(
                "w-full grid grid-cols-[48px_1fr_auto] gap-3 p-4 hover:bg-muted/30 transition-colors text-left group",
                selectedConversationId === conversation.id && "bg-[#007AFF]/10 border-l-2 border-l-[#007AFF]"
              )}
            >
              {/* Column 1: Avatar - fixed 48px */}
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-[#007AFF]/10 text-[#007AFF] text-sm font-medium">
                  {getInitials(conversation.other_participant_name)}
                </AvatarFallback>
              </Avatar>

              {/* Column 2: Name + Preview - takes remaining space, truncates */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium truncate">
                    {conversation.other_participant_name}
                  </span>
                  <span className="text-muted-foreground flex-shrink-0">
                    {getParticipantIcon(conversation.other_participant_type)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {conversation.last_message_preview || "No messages yet"}
                </p>
              </div>

              {/* Column 3: Time + Delete + Badge - auto width, never clips */}
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatMessageTime(conversation.last_message_at)}
                  </span>
                  <button
                    onClick={(e) => handleDeleteClick(e, conversation.id)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    title="Delete conversation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {(conversation.unread_count ?? 0) > 0 && (
                  <Badge variant="default" className="h-5 min-w-[20px] px-1.5 text-xs font-medium">
                    {conversation.unread_count}
                  </Badge>
                )}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>

      <AlertDialog open={!!conversationToDelete} onOpenChange={() => setConversationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this conversation and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
