import { format } from "date-fns";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Message } from "@/integrations/supabase/hooks/useMessages";
import { MessageSquare, Phone, User, Clock, AlertCircle, CheckCircle, Reply, ChevronDown, ChevronUp, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageCardProps {
  message: Message;
}

export function MessageCard({ message }: MessageCardProps) {
  const [showResponse, setShowResponse] = useState(false);
  
  const getStatusBadge = () => {
    switch (message.status) {
      case 'sent':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="mr-1 h-3 w-3" />
            Sent
          </Badge>
        );
      case 'delivered':
        return (
          <Badge variant="default" className="bg-blue-500">
            <CheckCircle className="mr-1 h-3 w-3" />
            Delivered
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      default:
        return null;
    }
  };

  const getRecipientTypeBadge = () => {
    return message.recipient_type === 'customer' ? (
      <Badge variant="outline" className="text-blue-600 border-blue-600">
        Customer
      </Badge>
    ) : (
      <Badge variant="outline" className="text-purple-600 border-purple-600">
        Personnel
      </Badge>
    );
  };

  const getDirectionBadge = () => {
    if (message.direction === 'inbound') {
      return (
        <Badge variant="outline" className="text-green-600 border-green-600">
          <ArrowDownLeft className="mr-1 h-3 w-3" />
          Inbound
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <ArrowUpRight className="mr-1 h-3 w-3" />
        Outbound
      </Badge>
    );
  };

  return (
    <Card className={cn(
      "hover:shadow-md transition-shadow",
      message.has_response && "border-l-4 border-l-blue-500"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium truncate">{message.recipient_name}</span>
              {getRecipientTypeBadge()}
              {getDirectionBadge()}
              {getStatusBadge()}
              {message.has_response && (
                <Badge variant="default" className="bg-blue-500">
                  <Reply className="mr-1 h-3 w-3" />
                  Replied
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Phone className="h-3 w-3" />
              <span>{message.recipient_phone}</span>
            </div>

            <div className="flex items-start gap-2 mt-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-sm text-foreground line-clamp-2">{message.content}</p>
            </div>

            {message.error_message && (
              <div className="mt-2 p-2 bg-destructive/10 rounded text-sm text-destructive">
                {message.error_message}
              </div>
            )}

            {/* Response Section */}
            {message.has_response && message.response_content && (
              <div className="mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                  onClick={() => setShowResponse(!showResponse)}
                >
                  {showResponse ? (
                    <>
                      <ChevronUp className="mr-1 h-3 w-3" />
                      Hide Response
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-1 h-3 w-3" />
                      View Response
                    </>
                  )}
                </Button>
                
                {showResponse && (
                  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Reply className="h-3 w-3" />
                      <span>
                        Response received {message.response_received_at && 
                          format(new Date(message.response_received_at), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{message.response_content}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="text-right text-xs text-muted-foreground flex-shrink-0">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(message.created_at), "MMM d, yyyy")}
            </div>
            <div>{format(new Date(message.created_at), "h:mm a")}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
