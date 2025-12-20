import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import type { AiDevConversation } from "@/hooks/useAiDevConversations";

interface ConversationSidebarProps {
  conversations: AiDevConversation[];
  currentConversation: AiDevConversation | null;
  onSelect: (conversation: AiDevConversation) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}

export function ConversationSidebar({
  conversations,
  currentConversation,
  onSelect,
  onNew,
  onDelete,
  loading,
}: ConversationSidebarProps) {
  return (
    <div className="w-64 border-r flex flex-col h-full">
      <div className="p-3 border-b">
        <Button onClick={onNew} className="w-full gap-2" size="sm">
          <Plus className="h-4 w-4" />
          New Conversation
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No conversations yet
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group relative rounded-md transition-colors ${
                  currentConversation?.id === conv.id
                    ? "bg-primary/10"
                    : "hover:bg-muted/50"
                }`}
              >
                <button
                  onClick={() => onSelect(conv)}
                  className="w-full text-left p-2 pr-8"
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {conv.title || "Untitled"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(conv.updated_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
