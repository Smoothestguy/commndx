import React, { useRef, useEffect } from "react";
import { Bot, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAIAssistant } from "@/contexts/AIAssistantContext";
import { useAuth } from "@/contexts/AuthContext";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { QuickActions } from "./QuickActions";
import { useIsMobile } from "@/hooks/use-mobile";

export function ChatInterface() {
  const { user } = useAuth();
  const { messages, isLoading, isOpen, setOpen, sendMessage, clearHistory } =
    useAIAssistant();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Don't show chatbot when user is not authenticated
  if (!user) {
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={`p-0 flex flex-col ${
          isMobile ? "h-[85vh] rounded-t-2xl" : "w-[400px] sm:max-w-[400px]"
        }`}
      >
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-base font-semibold">
                  AI Assistant
                </SheetTitle>
                <p className="text-xs text-muted-foreground">Powered by AI</p>
              </div>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearHistory}
                className="h-8 w-8"
                title="Clear chat history"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Messages Area */}
        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="py-6">
              {/* Welcome Message */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">
                  How can I help you?
                </h3>
                <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
                  I can search records, create estimates, find invoices, and
                  answer questions about your data.
                </p>
              </div>

              {/* Quick Actions */}
              <QuickActions onAction={sendMessage} />
            </div>
          ) : (
            <div className="py-4 space-y-4">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-3 items-start animate-fade-in">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <Bot className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span
                        className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <ChatInput
          onSend={sendMessage}
          isLoading={isLoading}
          placeholder="Ask me anything..."
        />
      </SheetContent>
    </Sheet>
  );
}
