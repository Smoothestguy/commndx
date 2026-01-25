import { useState } from "react";
import { usePersonnelCommunicationLog, CommunicationLogEntry } from "@/integrations/supabase/hooks/usePersonnelCommunicationLog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { MessageSquare, Mail, ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PersonnelCommunicationLogProps {
  personnelId: string;
}

export function PersonnelCommunicationLog({ personnelId }: PersonnelCommunicationLogProps) {
  const { data: messages, isLoading } = usePersonnelCommunicationLog(personnelId);
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredMessages = messages?.filter(msg => {
    if (directionFilter !== "all" && msg.direction !== directionFilter) return false;
    if (typeFilter !== "all" && msg.message_type !== typeFilter) return false;
    return true;
  }) || [];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'sms':
        return <Phone className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Delivered</Badge>;
      case 'sent':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Sent</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Failed</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No messages found for this personnel.</p>
        <p className="text-sm mt-1">Start a conversation to begin communicating.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Direction:</span>
          <Select value={directionFilter} onValueChange={setDirectionFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="inbound">Received</SelectItem>
              <SelectItem value="outbound">Sent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Type:</span>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground ml-auto">
          {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Messages Table */}
      <ScrollArea className="h-[400px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Date/Time</TableHead>
              <TableHead className="w-[100px]">Direction</TableHead>
              <TableHead className="w-[60px]">Type</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead className="min-w-[200px]">Message</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMessages.map((msg) => {
              const isExpanded = expandedRows.has(msg.id);
              const needsExpand = msg.content.length > 80;
              
              return (
                <TableRow 
                  key={msg.id}
                  className={cn(
                    "transition-colors",
                    msg.direction === 'inbound' 
                      ? "border-l-4 border-l-primary/40" 
                      : "border-l-4 border-l-success/40"
                  )}
                >
                  <TableCell className="text-sm">
                    {format(new Date(msg.created_at), "MMM d, yyyy")}
                    <br />
                    <span className="text-muted-foreground text-xs">
                      {format(new Date(msg.created_at), "h:mm a")}
                    </span>
                  </TableCell>
                  <TableCell>
                    {msg.direction === 'inbound' ? (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1">
                        <ArrowDownLeft className="h-3 w-3" />
                        Received
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1">
                        <ArrowUpRight className="h-3 w-3" />
                        Sent
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-muted-foreground" title={msg.message_type.toUpperCase()}>
                      {getTypeIcon(msg.message_type)}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {msg.sender_name}
                  </TableCell>
                  <TableCell className="text-sm">
                    {msg.recipient_name}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {isExpanded || !needsExpand ? (
                        msg.content
                      ) : (
                        <span>{msg.content.substring(0, 80)}...</span>
                      )}
                      {needsExpand && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 ml-1"
                          onClick={() => toggleRow(msg.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(msg.status)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
