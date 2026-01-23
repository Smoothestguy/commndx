import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ConversationList } from "@/components/messaging/ConversationList";
import { ConversationThread } from "@/components/messaging/ConversationThread";
import { NewConversationDialog } from "@/components/messaging/NewConversationDialog";
import { Button } from "@/components/ui/button";
import { useConversations, Conversation } from "@/integrations/supabase/hooks/useConversations";
import { Plus, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Conversations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const { data: conversations } = useConversations();

  // Handle URL params for conversation ID
  useEffect(() => {
    const conversationId = searchParams.get("id");
    if (conversationId && conversations) {
      const conv = conversations.find((c) => c.id === conversationId);
      if (conv) {
        setSelectedConversation(conv);
      }
    }
  }, [searchParams, conversations]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setSearchParams({ id: conversation.id });
  };

  const handleConversationCreated = (conversationId: string) => {
    setSearchParams({ id: conversationId });
    // The conversation will be selected via the useEffect above
  };

  const handleBack = () => {
    setSelectedConversation(null);
    setSearchParams({});
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">Messages</h1>
        </div>
        <Button onClick={() => setShowNewDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Message
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation list - hidden on mobile when a conversation is selected */}
        <div
          className={cn(
            "w-full md:w-80 lg:w-96 border-r bg-background flex-shrink-0",
            selectedConversation && "hidden md:block"
          )}
        >
          <ConversationList
            selectedConversationId={selectedConversation?.id || null}
            onSelectConversation={handleSelectConversation}
          />
        </div>

        {/* Conversation thread - full width on mobile when selected */}
        <div
          className={cn(
            "flex-1 bg-muted/30",
            !selectedConversation && "hidden md:block"
          )}
        >
          <ConversationThread
            conversation={selectedConversation}
            onBack={handleBack}
          />
        </div>
      </div>

      {/* New conversation dialog */}
      <NewConversationDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  );
}
