import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Truck, Plus, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { PurchaseOrder } from "@/integrations/supabase/hooks/usePurchaseOrders";

interface ProjectPurchaseOrdersListProps {
  purchaseOrders: PurchaseOrder[];
  projectId: string;
  onAddNew?: () => void;
}

export function ProjectPurchaseOrdersList({ 
  purchaseOrders, 
  projectId,
  onAddNew 
}: ProjectPurchaseOrdersListProps) {
  const navigate = useNavigate();
  
  const totalPOValue = purchaseOrders.reduce((sum, po) => 
    sum + po.total + (po.total_addendum_amount || 0), 0
  );
  
  const totalBilled = purchaseOrders.reduce((sum, po) => 
    sum + (po.billed_amount || 0), 0
  );

  return (
    <Card className="glass border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="font-heading flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Purchase Orders ({purchaseOrders.length})
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Total: {formatCurrency(totalPOValue)} | Billed: {formatCurrency(totalBilled)}
          </p>
        </div>
        {onAddNew && (
          <Button variant="outline" size="sm" onClick={onAddNew}>
            <Plus className="h-4 w-4 mr-1" />
            Add PO
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {purchaseOrders.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            No purchase orders for this project yet.
          </div>
        ) : (
          <div className="space-y-3">
            {purchaseOrders.map((po) => (
              <div
                key={po.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                onClick={() => navigate(`/purchase-orders/${po.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{po.number}</span>
                    <StatusBadge status={po.status} />
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-1">
                    {po.vendor_name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(po.created_at), "MMM dd, yyyy")}
                    {(po.total_addendum_amount || 0) > 0 && (
                      <span className="ml-2 text-orange-500">
                        +{formatCurrency(po.total_addendum_amount || 0)} addendums
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="font-bold text-primary block">
                      {formatCurrency(po.total + (po.total_addendum_amount || 0))}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Billed: {formatCurrency(po.billed_amount || 0)}
                    </span>
                  </div>
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
