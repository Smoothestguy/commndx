import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ConversationList } from "@/components/messaging/ConversationList";
import { ConversationThread } from "@/components/messaging/ConversationThread";
import { NewConversationDialog } from "@/components/messaging/NewConversationDialog";
import { OnboardingReminderDialog } from "@/components/messaging/OnboardingReminderDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useConversations,
  useAllConversations,
  Conversation,
} from "@/integrations/supabase/hooks/useConversations";
import { useUserRole } from "@/hooks/useUserRole";
import { Plus, MessageCircle, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function MessagesInbox() {
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationId = searchParams.get("conversation");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [onboardingReminderOpen, setOnboardingReminderOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { isAdmin, isManager } = useUserRole();
  const canSeeAll = isAdmin || isManager;
  const [mode, setMode] = useState<"my" | "all">("my");

  const { data: myConversations } = useConversations();
  const { data: allConversations } = useAllConversations(canSeeAll);

  const activeList = mode === "all" && canSeeAll ? allConversations : myConversations;

  // Fetch recipient phone number when a conversation is selected
  const { data: recipientPhone } = useQuery({
    queryKey: ["recipient-phone", selectedConversation?.id],
    queryFn: async () => {
      if (!selectedConversation) return null;
      const otherType = selectedConversation.other_participant_type;
      const isParticipant1 = selectedConversation.participant_1_type === "user";
      const otherId = isParticipant1
        ? selectedConversation.participant_2_id
        : selectedConversation.participant_1_id;

      if (otherType === "personnel") {
        const { data: personnel } = await supabase
          .from("personnel")
          .select("phone")
          .eq("id", otherId)
          .single();
        return personnel?.phone || null;
      } else if (otherType === "customer") {
        const { data: customer } = await supabase
          .from("customers")
          .select("phone")
          .eq("id", otherId)
          .single();
        return customer?.phone || null;
      }
      return null;
    },
    enabled: !!selectedConversation,
  });

  // Sync selected conversation with URL parameter — search both lists
  useEffect(() => {
    if (!conversationId) return;
    const found =
      myConversations?.find((c) => c.id === conversationId) ||
      allConversations?.find((c) => c.id === conversationId);
    if (found) setSelectedConversation(found);
  }, [conversationId, myConversations, allConversations]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setSearchParams((prev) => {
      prev.set("conversation", conversation.id);
      prev.delete("tab");
      return prev;
    });
  };

  const handleConversationCreated = (conversationId: string) => {
    setSearchParams((prev) => {
      prev.set("conversation", conversationId);
      prev.delete("tab");
      return prev;
    });
  };

  const handleBack = () => {
    setSelectedConversation(null);
    setSearchParams((prev) => {
      prev.delete("conversation");
      return prev;
    });
  };

  const handleConversationDeleted = (deletedId: string) => {
    if (selectedConversation?.id === deletedId) {
      handleBack();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Conversations</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setOnboardingReminderOpen(true)}
            variant="outline"
            size="sm"
          >
            <ClipboardList className="h-4 w-4 mr-2" />
            Onboarding Reminders
          </Button>
          <Button onClick={() => setNewConversationOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Message
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden border rounded-lg bg-background">
        <div
          className={cn(
            "border-r bg-background flex-shrink-0 flex flex-col overflow-hidden transition-all duration-200",
            selectedConversation ? "hidden md:flex md:w-80" : "w-full md:w-80",
            isSidebarCollapsed ? "md:w-0 md:border-r-0" : "md:w-80"
          )}
        >
          {canSeeAll && (
            <div className="p-2 border-b flex-shrink-0">
              <Tabs value={mode} onValueChange={(v) => setMode(v as "my" | "all")}>
                <TabsList className="grid w-full grid-cols-2 h-8">
                  <TabsTrigger value="my" className="text-xs">My Messages</TabsTrigger>
                  <TabsTrigger value="all" className="text-xs">All Messages</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}
          <ConversationList
            conversations={activeList}
            mode={mode}
            selectedConversationId={selectedConversation?.id || null}
            onSelectConversation={handleSelectConversation}
            onConversationDeleted={handleConversationDeleted}
          />
        </div>

        <div className={cn("flex-1 flex flex-col min-w-0", !selectedConversation && "hidden md:flex")}>
          <ConversationThread
            conversation={selectedConversation}
            onBack={handleBack}
            recipientPhone={recipientPhone}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        </div>
      </div>

      <NewConversationDialog
        open={newConversationOpen}
        onOpenChange={setNewConversationOpen}
        onConversationCreated={handleConversationCreated}
      />

      <OnboardingReminderDialog
        open={onboardingReminderOpen}
        onOpenChange={setOnboardingReminderOpen}
      />
    </div>
  );
}
