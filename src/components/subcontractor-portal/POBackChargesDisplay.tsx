import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, MinusCircle, RefreshCw } from "lucide-react";
import { POBackCharge } from "@/integrations/supabase/hooks/useSubcontractorPortal";

interface POBackChargesDisplayProps {
  backCharges: POBackCharge[];
  showTotal?: boolean;
}

const chargeTypeConfig = {
  deduction: {
    label: "Deduction",
    icon: MinusCircle,
    variant: "destructive" as const,
    description: "Quality issues or incomplete work",
  },
  penalty: {
    label: "Penalty",
    icon: AlertTriangle,
    variant: "destructive" as const,
    description: "Late completion or safety violations",
  },
  adjustment: {
    label: "Adjustment",
    icon: RefreshCw,
    variant: "secondary" as const,
    description: "Scope changes or credits",
  },
};

export function POBackChargesDisplay({ backCharges, showTotal = true }: POBackChargesDisplayProps) {
  const totalBackCharges = backCharges.reduce((sum, charge) => sum + charge.amount, 0);
  
  if (backCharges.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Back Charges</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No back charges applied to this PO.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Back Charges</CardTitle>
          {showTotal && (
            <span className="text-lg font-bold text-destructive">
              -{formatCurrency(totalBackCharges)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {backCharges.map((charge) => {
          const config = chargeTypeConfig[charge.charge_type];
          const Icon = config.icon;
          
          return (
            <div
              key={charge.id}
              className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
            >
              <div className="mt-0.5">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={config.variant} className="text-xs">
                    {config.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(charge.applied_date).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm font-medium">{charge.description}</p>
                {charge.notes && (
                  <p className="text-xs text-muted-foreground mt-1">{charge.notes}</p>
                )}
              </div>
              <div className="text-sm font-semibold text-destructive">
                -{formatCurrency(charge.amount)}
              </div>
            </div>
          );
        })}
        
        {showTotal && backCharges.length > 1 && (
          <div className="pt-2 border-t flex justify-between items-center">
            <span className="text-sm font-medium">Total Back Charges</span>
            <span className="text-base font-bold text-destructive">
              -{formatCurrency(totalBackCharges)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
