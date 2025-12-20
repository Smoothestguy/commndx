import { useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bot, User, CheckCircle2, FileCode, HelpCircle, StickyNote } from "lucide-react";
import { CodePatchDisplay } from "./CodePatchDisplay";
import type { AiDevMessage } from "@/hooks/useAiDevConversations";

interface DevChatPanelProps {
  messages: AiDevMessage[];
  isLoading?: boolean;
}

export function DevChatPanel({ messages, isLoading }: DevChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <Bot className="h-12 w-12 mx-auto opacity-50" />
          <p>Start a conversation or use a quick command</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
      <div className="space-y-4 pb-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.role === "assistant" && (
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              </div>
            )}

            <Card
              className={`max-w-[85%] ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50"
              }`}
            >
              <CardContent className="p-3 space-y-3">
                {/* User message content */}
                {message.role === "user" && (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}

                {/* Assistant structured response */}
                {message.role === "assistant" && message.response_data && (
                  <>
                    {/* Plan */}
                    {message.response_data.plan && message.response_data.plan.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Plan
                        </h4>
                        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                          {message.response_data.plan.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Files to edit */}
                    {message.response_data.files_to_edit && message.response_data.files_to_edit.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <FileCode className="h-4 w-4" />
                          Files to Edit
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {message.response_data.files_to_edit.map((file, i) => (
                            <Badge key={i} variant="secondary" className="font-mono text-xs">
                              {file}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Code Patches */}
                    {message.response_data.patches && message.response_data.patches.length > 0 && (
                      <CodePatchDisplay patches={message.response_data.patches} />
                    )}

                    {/* Questions */}
                    {message.response_data.questions && message.response_data.questions.length > 0 && (
                      <div className="space-y-2 p-3 bg-yellow-500/10 rounded-md border border-yellow-500/20">
                        <h4 className="font-medium text-sm flex items-center gap-2 text-yellow-600">
                          <HelpCircle className="h-4 w-4" />
                          Need More Info
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {message.response_data.questions.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Notes */}
                    {message.response_data.notes && (
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <h4 className="font-medium flex items-center gap-2">
                          <StickyNote className="h-4 w-4" />
                          Notes
                        </h4>
                        <p className="whitespace-pre-wrap">{message.response_data.notes}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Fallback for assistant messages without structured data */}
                {message.role === "assistant" && !message.response_data?.plan?.length && !message.response_data?.patches?.length && (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
              </CardContent>
            </Card>

            {message.role === "user" && (
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary animate-pulse" />
              </div>
            </div>
            <Card className="bg-muted/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex gap-1">
                    <span className="animate-bounce">●</span>
                    <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>●</span>
                  </div>
                  Generating response...
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
