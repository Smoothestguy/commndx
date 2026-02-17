import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { DollarSign, TrendingUp, TrendingDown, FileText, Receipt, Truck, Users, AlertTriangle, Package } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface FinancialData {
  originalContractValue: number;
  changeOrdersTotal: number;
  tmTicketsTotal: number;
  totalContractValue: number;
  totalPOValue: number;
  totalVendorBilled: number;
  totalVendorPaid: number;
  totalInvoiced: number;
  totalPaid: number;
  grossProfit: number;
  grossMargin: number;
  totalLaborCost: number;
  billableLaborCost?: number;
  nonBillableLaborCost?: number;
  totalOtherExpenses: number;
  netProfit: number;
  netMargin: number;
  supervisionLaborCost?: number;
  fieldLaborCost?: number;
}

interface ProjectFinancialSummaryProps {
  data: FinancialData;
}

function getMarginColor(margin: number) {
  if (margin >= 30) return 'text-green-500';
  if (margin >= 15) return 'text-yellow-500';
  return 'text-red-500';
}

function StatCard({ label, value, icon, highlight, colorClass }: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  highlight?: boolean;
  colorClass?: string;
}) {
  return (
    <div className={`space-y-1 p-3 rounded-lg ${highlight ? 'bg-primary/10' : 'bg-secondary/30'}`}>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </p>
      <p className={`text-lg font-bold ${colorClass || ''}`}>{value}</p>
    </div>
  );
}

export function ProjectFinancialSummary({ data }: ProjectFinancialSummaryProps) {
  const totalCosts = data.totalPOValue + data.totalLaborCost;
  
  const invoiceProgress = data.totalContractValue > 0 
    ? (data.totalInvoiced / data.totalContractValue) * 100 
    : 0;
  
  const paymentProgress = data.totalInvoiced > 0 
    ? (data.totalPaid / data.totalInvoiced) * 100 
    : 0;

  const costProgress = data.totalVendorBilled > 0
    ? (data.totalVendorPaid / data.totalVendorBilled) * 100
    : 0;

  const marginColor = getMarginColor(data.netMargin);

  return (
    <Card className="glass border-border">
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Financial Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Negative Profit Alert */}
        {data.netProfit < 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Project Loss Alert</AlertTitle>
            <AlertDescription>
              This project is currently showing a loss of {formatCurrency(Math.abs(data.netProfit))}. Review costs and billing.
            </AlertDescription>
          </Alert>
        )}

        {/* Stat Cards Grid */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <StatCard
            label="Original Contract"
            value={formatCurrency(data.originalContractValue)}
            icon={<FileText className="h-3 w-3" />}
          />
          <StatCard
            label="Change Orders (net)"
            value={`${data.changeOrdersTotal >= 0 ? '+' : ''}${formatCurrency(data.changeOrdersTotal)}`}
            icon={<Receipt className="h-3 w-3" />}
            colorClass={data.changeOrdersTotal >= 0 ? 'text-blue-500' : 'text-red-500'}
          />
          <StatCard
            label="Total Contract Value"
            value={formatCurrency(data.totalContractValue)}
            icon={<DollarSign className="h-3 w-3" />}
            highlight
            colorClass="text-primary"
          />
          <StatCard
            label="WO / Sub Costs"
            value={formatCurrency(data.totalPOValue)}
            icon={<Truck className="h-3 w-3" />}
          />
          <StatCard
            label="Internal Labor"
            value={formatCurrency(data.totalLaborCost)}
            icon={<Users className="h-3 w-3" />}
          />
          <StatCard
            label="Total Costs"
            value={formatCurrency(totalCosts)}
            icon={<Package className="h-3 w-3" />}
            highlight
            colorClass="text-orange-500"
          />
          <StatCard
            label="Net Profit"
            value={formatCurrency(data.netProfit)}
            icon={data.netProfit >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            highlight
            colorClass={data.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}
          />
          <StatCard
            label="Margin %"
            value={`${data.netMargin.toFixed(1)}%`}
            highlight
            colorClass={marginColor}
          />
        </div>

        {/* Supervision Cost Impact */}
        {(data.supervisionLaborCost !== undefined && data.supervisionLaborCost > 0) && (
          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-blue-500" />
              <p className="text-sm font-medium">Supervision Cost Impact</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Supervision / Internal Labor</p>
                <p className="text-lg font-bold text-blue-500">{formatCurrency(data.supervisionLaborCost)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Margin Before Supervision</p>
                <p className="text-lg font-bold text-green-500">
                  {data.totalContractValue > 0
                    ? ((data.totalContractValue - (data.totalPOValue + (data.fieldLaborCost || 0))) / data.totalContractValue * 100).toFixed(1)
                    : "0.0"}%
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Margin After Supervision</p>
                <p className={`text-lg font-bold ${data.netMargin >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {data.netMargin.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}

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
              <span className="text-muted-foreground">Vendor Payments</span>
              <span className="font-medium">
                {formatCurrency(data.totalVendorPaid)} / {formatCurrency(data.totalVendorBilled)}
              </span>
            </div>
            <Progress value={costProgress} className="h-2 [&>div]:bg-orange-500" />
            <div className="text-xs text-muted-foreground">
              Outstanding: {formatCurrency(data.totalVendorBilled - data.totalVendorPaid)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
