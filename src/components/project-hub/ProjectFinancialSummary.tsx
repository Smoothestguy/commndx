import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DollarSign, TrendingUp, TrendingDown, FileText, Receipt, Truck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface FinancialData {
  originalContractValue: number;
  changeOrdersTotal: number;
  tmTicketsTotal: number;
  totalContractValue: number;
  totalPOValue: number;
  totalVendorBilled: number;
  totalInvoiced: number;
  totalPaid: number;
  grossProfit: number;
  grossMargin: number;
}

interface ProjectFinancialSummaryProps {
  data: FinancialData;
}

export function ProjectFinancialSummary({ data }: ProjectFinancialSummaryProps) {
  const invoiceProgress = data.totalContractValue > 0 
    ? (data.totalInvoiced / data.totalContractValue) * 100 
    : 0;
  
  const paymentProgress = data.totalInvoiced > 0 
    ? (data.totalPaid / data.totalInvoiced) * 100 
    : 0;

  const costProgress = data.totalPOValue > 0
    ? (data.totalVendorBilled / data.totalPOValue) * 100
    : 0;

  return (
    <Card className="glass border-border">
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Financial Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Contract Value Breakdown */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Original Contract</p>
            <p className="text-2xl font-bold">{formatCurrency(data.originalContractValue)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" /> Change Orders
            </p>
            <p className="text-2xl font-bold text-blue-500">
              +{formatCurrency(data.changeOrdersTotal)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Receipt className="h-3 w-3" /> T&M Tickets
            </p>
            <p className="text-2xl font-bold text-orange-500">
              +{formatCurrency(data.tmTicketsTotal)}
            </p>
          </div>
          <div className="space-y-1 p-3 bg-primary/10 rounded-lg">
            <p className="text-sm text-muted-foreground font-medium">Total Contract Value</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(data.totalContractValue)}</p>
          </div>
        </div>

        {/* Profit Analysis */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-4 border-t border-border">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Truck className="h-3 w-3" /> Total PO Value (Cost)
            </p>
            <p className="text-2xl font-bold">{formatCurrency(data.totalPOValue)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Gross Profit</p>
            <p className={`text-2xl font-bold flex items-center gap-2 ${data.grossProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {data.grossProfit >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              {formatCurrency(data.grossProfit)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Gross Margin</p>
            <p className={`text-2xl font-bold ${data.grossMargin >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {data.grossMargin.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Progress Bars */}
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Invoicing Progress</span>
              <span className="font-medium">
                {formatCurrency(data.totalInvoiced)} / {formatCurrency(data.totalContractValue)}
              </span>
            </div>
            <Progress value={invoiceProgress} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment Collection</span>
              <span className="font-medium">
                {formatCurrency(data.totalPaid)} / {formatCurrency(data.totalInvoiced)}
              </span>
            </div>
            <Progress value={paymentProgress} className="h-2 [&>div]:bg-green-500" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Vendor Billing</span>
              <span className="font-medium">
                {formatCurrency(data.totalVendorBilled)} / {formatCurrency(data.totalPOValue)}
              </span>
            </div>
            <Progress value={costProgress} className="h-2 [&>div]:bg-orange-500" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
