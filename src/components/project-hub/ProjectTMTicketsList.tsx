import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Receipt, Plus, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { TMTicketWithLineItems } from "@/integrations/supabase/hooks/useTMTickets";

interface ProjectTMTicketsListProps {
  tickets: TMTicketWithLineItems[];
  projectId: string;
  onAddNew?: () => void;
  onTicketClick?: (ticket: TMTicketWithLineItems) => void;
}

export function ProjectTMTicketsList({ 
  tickets, 
  projectId,
  onAddNew,
  onTicketClick
}: ProjectTMTicketsListProps) {
  const approvedTotal = tickets
    .filter(t => t.status === 'approved' || t.status === 'signed' || t.status === 'invoiced')
    .reduce((sum, t) => {
      const changeType = (t as any).change_type || 'additive';
      return changeType === 'deductive' ? sum - t.total : sum + t.total;
    }, 0);

  return (
    <Card className="glass border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="font-heading flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            T&M Tickets ({tickets.length})
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Approved/Signed Total: {formatCurrency(approvedTotal)}
          </p>
        </div>
        {onAddNew && (
          <Button variant="outline" size="sm" onClick={onAddNew}>
            <Plus className="h-4 w-4 mr-1" />
            Add T&M
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {tickets.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            No T&M tickets for this project yet.
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                onClick={() => onTicketClick?.(ticket)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{ticket.ticket_number}</span>
                    <StatusBadge status={ticket.status as any} />
                    {ticket.created_in_field && (
                      <span className="text-xs bg-orange-500/20 text-orange-500 px-2 py-0.5 rounded">
                        Field
                      </span>
                    )}
                    {(ticket as any).change_type === 'deductive' && (
                      <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded">
                        Credit
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-1">
                    {ticket.description || "No description"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Work Date: {format(new Date(ticket.work_date), "MMM dd, yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-bold ${(ticket as any).change_type === 'deductive' ? 'text-destructive' : 'text-primary'}`}>
                    {(ticket as any).change_type === 'deductive' ? '-' : ''}{formatCurrency(ticket.total)}
                  </span>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
