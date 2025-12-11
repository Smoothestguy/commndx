import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Calendar, FileText, User, Building2 } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { TMTicketWithLineItems } from "@/integrations/supabase/hooks/useTMTickets";

interface TMTicketCardProps {
  ticket: TMTicketWithLineItems;
  onClick?: () => void;
}

export function TMTicketCard({ ticket, onClick }: TMTicketCardProps) {
  return (
    <Card
      className="glass border-border cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-heading">{ticket.ticket_number}</CardTitle>
            <p className="text-sm text-muted-foreground line-clamp-1">
              {ticket.description || "No description"}
            </p>
          </div>
          <StatusBadge status={ticket.status as any} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span className="truncate">{ticket.project?.name || "Unknown Project"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span className="truncate">{ticket.customer?.name || "Unknown Customer"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Work Date: {format(new Date(ticket.work_date), "MMM dd, yyyy")}</span>
        </div>

        {ticket.created_in_field && (
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-primary font-medium">Created in Field</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-sm text-muted-foreground">
            {ticket.line_items?.length || 0} item(s)
          </span>
          <span className="text-lg font-bold text-primary">
            {formatCurrency(ticket.total)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
