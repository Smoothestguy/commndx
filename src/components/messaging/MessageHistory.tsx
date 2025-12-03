import { useState } from "react";
import { useMessages, Message } from "@/integrations/supabase/hooks/useMessages";
import { MessageCard } from "./MessageCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";

interface MessageHistoryProps {
  recipientType?: 'customer' | 'personnel';
  recipientId?: string;
}

export function MessageHistory({ recipientType, recipientId }: MessageHistoryProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: messages, isLoading } = useMessages({
    recipientType: recipientType || (typeFilter !== "all" ? typeFilter as 'customer' | 'personnel' : undefined),
    recipientId,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const filteredMessages = messages?.filter((message) => {
    const matchesSearch =
      message.recipient_name.toLowerCase().includes(search.toLowerCase()) ||
      message.content.toLowerCase().includes(search.toLowerCase()) ||
      message.recipient_phone.includes(search);
    return matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!recipientId && (
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              placeholder="Search messages..."
              value={search}
              onChange={setSearch}
            />
          </div>

          {!recipientType && (
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="customer">Customers</SelectItem>
                <SelectItem value="personnel">Personnel</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {filteredMessages && filteredMessages.length > 0 ? (
        <div className="space-y-3">
          {filteredMessages.map((message) => (
            <MessageCard key={message.id} message={message} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-muted-foreground">No messages yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {recipientId
              ? "No messages have been sent to this recipient."
              : "Start sending SMS messages to customers and personnel."}
          </p>
        </div>
      )}
    </div>
  );
}
