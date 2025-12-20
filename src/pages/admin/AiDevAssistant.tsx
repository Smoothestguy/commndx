import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useAiDevConversations } from "@/hooks/useAiDevConversations";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DevChatPanel } from "@/components/ai-dev/DevChatPanel";
import { ContextPicker, type ContextData } from "@/components/ai-dev/ContextPicker";
import { QuickCommands } from "@/components/ai-dev/QuickCommands";
import { ConversationSidebar } from "@/components/ai-dev/ConversationSidebar";

export default function AiDevAssistant() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const {
    conversations,
    currentConversation,
    messages,
    loading: conversationsLoading,
    createConversation,
    addMessage,
    deleteConversation,
    selectConversation,
  } = useAiDevConversations();

  const [goal, setGoal] = useState("");
  const [context, setContext] = useState<ContextData>({});
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle loading state
  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect non-admins
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const sendMessage = async (userGoal: string, command?: string) => {
    if (!userGoal.trim() && !command) return;

    setIsProcessing(true);
    
    try {
      // Create conversation if needed
      let convId = currentConversation?.id;
      if (!convId) {
        const newConv = await createConversation();
        if (!newConv) {
          throw new Error("Failed to create conversation");
        }
        convId = newConv.id;
      }

      // Add user message
      await addMessage(convId, "user", userGoal || command || "", context);

      // Call edge function
      const { data, error } = await supabase.functions.invoke("ai-dev-assistant", {
        body: {
          goal: userGoal,
          context,
          command,
        },
      });

      if (error) {
        throw error;
      }

      // Add assistant message with structured response
      await addMessage(
        convId,
        "assistant",
        "Response generated",
        undefined,
        data
      );

      setGoal("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get response",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickCommand = (commandId: string, commandGoal: string) => {
    if (commandId === "custom") {
      // Focus the input for custom task
      document.getElementById("goal-input")?.focus();
      return;
    }
    sendMessage(commandGoal, commandId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(goal);
  };

  const handleNewConversation = async () => {
    await createConversation();
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        currentConversation={currentConversation}
        onSelect={selectConversation}
        onNew={handleNewConversation}
        onDelete={deleteConversation}
        loading={conversationsLoading}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">AI Developer Assistant</h1>
              <p className="text-sm text-muted-foreground">
                Build features, debug issues, generate code patches
              </p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Panel */}
          <div className="flex-1 flex flex-col p-4">
            <DevChatPanel messages={messages} isLoading={isProcessing} />

            {/* Input Area */}
            <div className="mt-4 space-y-3">
              {/* Quick Commands */}
              <QuickCommands onCommand={handleQuickCommand} disabled={isProcessing} />

              {/* Goal Input */}
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  id="goal-input"
                  placeholder="Describe what you want to build or fix..."
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  disabled={isProcessing}
                  className="flex-1"
                />
                <Button type="submit" disabled={isProcessing || !goal.trim()}>
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </div>

          {/* Context Panel */}
          <div className="w-80 border-l p-4 overflow-auto">
            <ContextPicker onContextChange={setContext} />
          </div>
        </div>
      </div>
    </div>
  );
}
