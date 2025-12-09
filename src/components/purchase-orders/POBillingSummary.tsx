import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";

interface POBillingSummaryProps {
  total: number;
  billedAmount: number;
  remainingAmount: number;
}

export function POBillingSummary({
  total,
  billedAmount,
  remainingAmount,
}: POBillingSummaryProps) {
  const billedPercentage = total > 0 ? (billedAmount / total) * 100 : 0;

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Billing Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{billedPercentage.toFixed(0)}%</span>
          </div>
          <Progress value={billedPercentage} className="h-2" />
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">PO Total</p>
            <p className="text-lg font-bold">
              ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3 text-success" />
              Billed
            </p>
            <p className="text-lg font-bold text-success">
              ${billedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
              <TrendingDown className="h-3 w-3 text-warning" />
              Remaining
            </p>
            <p className="text-lg font-bold text-warning">
              ${remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
