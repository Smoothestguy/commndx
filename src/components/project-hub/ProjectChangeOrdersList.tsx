import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FileText, Plus, ExternalLink, ShieldAlert, Clock } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { ChangeOrder } from "@/integrations/supabase/hooks/useChangeOrders";

interface ProjectChangeOrdersListProps {
  changeOrders: ChangeOrder[];
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
    .reduce((sum, co) => {
      const changeType = co.change_type || 'additive';
      return changeType === 'deductive' ? sum - co.total : sum + co.total;
    }, 0);

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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{co.number}</span>
                    <StatusBadge status={co.status as any} />
                    {co.change_type === 'deductive' && (
                      <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded">
                        Credit
                      </span>
                    )}
                    {/* Work Authorization Badges */}
                    {!co.work_authorized && co.status !== 'draft' && co.status !== 'rejected' && (
                      <span className="inline-flex items-center gap-1 text-xs bg-destructive/15 text-destructive px-2 py-0.5 rounded font-semibold">
                        <ShieldAlert className="h-3 w-3" />
                        NOT AUTHORIZED
                      </span>
                    )}
                    {co.status === 'approved_pending_wo' && (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded font-semibold">
                        <Clock className="h-3 w-3" />
                        AWAITING WORK ORDER
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-1">
                    {co.reason}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(co.created_at), "MMM dd, yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-bold ${co.change_type === 'deductive' ? 'text-destructive' : 'text-primary'}`}>
                    {co.change_type === 'deductive' ? '-' : ''}{formatCurrency(co.total)}
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
