import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FileText, Plus, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { ChangeOrderWithLineItems } from "@/integrations/supabase/hooks/useChangeOrders";

interface ProjectChangeOrdersListProps {
  changeOrders: ChangeOrderWithLineItems[];
  projectId: string;
  onAddNew?: () => void;
}

export function ProjectChangeOrdersList({ 
  changeOrders, 
  projectId,
  onAddNew 
}: ProjectChangeOrdersListProps) {
  const navigate = useNavigate();
  
  const approvedTotal = changeOrders
    .filter(co => co.status === 'approved')
    .reduce((sum, co) => sum + co.total, 0);

  return (
    <Card className="glass border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="font-heading flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Change Orders ({changeOrders.length})
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Approved Total: {formatCurrency(approvedTotal)}
          </p>
        </div>
        {onAddNew && (
          <Button variant="outline" size="sm" onClick={onAddNew}>
            <Plus className="h-4 w-4 mr-1" />
            Add CO
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {changeOrders.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            No change orders for this project yet.
          </div>
        ) : (
          <div className="space-y-3">
            {changeOrders.map((co) => (
              <div
                key={co.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                onClick={() => navigate(`/change-orders/${co.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{co.number}</span>
                    <StatusBadge status={co.status as any} />
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-1">
                    {co.reason}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(co.created_at), "MMM dd, yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-primary">
                    {formatCurrency(co.total)}
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
