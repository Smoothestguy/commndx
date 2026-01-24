import { useState } from "react";
import { useMessages, useDeleteMessage, Message } from "@/integrations/supabase/hooks/useMessages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { 
  History, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  MessageSquare,
  Trash2,
  User,
  Users,
  Phone,
  MessageCircle
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export function LegacySMSHistory() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: messages, isLoading } = useMessages();
  const deleteMessage = useDeleteMessage();
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);

  const handleDelete = () => {
    if (deleteMessageId) {
      deleteMessage.mutate(deleteMessageId);
      setDeleteMessageId(null);
    }
  };

  const getStatusBadge = (status: Message["status"]) => {
    switch (status) {
      case "sent":
        return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" />Sent</Badge>;
      case "delivered":
        return <Badge className="bg-green-600 gap-1"><CheckCircle className="h-3 w-3" />Delivered</Badge>;
      case "failed":
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Failed</Badge>;
      case "pending":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!messages?.length && !isLoading) {
    return null;
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4" />
                  Legacy SMS History
                  <Badge variant="secondary" className="ml-2">{messages?.length || 0}</Badge>
                </CardTitle>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {messages?.map((message) => (
                      <div
                        key={message.id}
                        className="p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {message.recipient_type === "customer" ? (
                                <User className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Users className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="font-medium truncate">{message.recipient_name}</span>
                              {getStatusBadge(message.status)}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              <Phone className="h-3 w-3" />
                              <span>{message.recipient_phone}</span>
                              <span>•</span>
                              <span>{format(new Date(message.created_at), "MMM d, yyyy h:mm a")}</span>
                            </div>
                            <p className="text-sm line-clamp-2">{message.content}</p>
                            {message.has_response && message.response_content && (
                              <div className="mt-2 p-2 bg-primary/5 rounded border-l-2 border-primary">
                                <div className="flex items-center gap-1 text-xs text-primary mb-1">
                                  <MessageCircle className="h-3 w-3" />
                                  Response received
                                </div>
                                <p className="text-sm">{message.response_content}</p>
                              </div>
                            )}
                            {message.error_message && (
                              <p className="text-sm text-destructive mt-1">{message.error_message}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteMessageId(message.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
              {!isLoading && messages?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No legacy messages</p>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <AlertDialog open={!!deleteMessageId} onOpenChange={() => setDeleteMessageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
