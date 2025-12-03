import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Message } from "@/integrations/supabase/hooks/useMessages";
import { MessageSquare, Phone, User, Clock, AlertCircle, CheckCircle } from "lucide-react";

interface MessageCardProps {
  message: Message;
}

export function MessageCard({ message }: MessageCardProps) {
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

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium truncate">{message.recipient_name}</span>
              {getRecipientTypeBadge()}
              {getStatusBadge()}
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
