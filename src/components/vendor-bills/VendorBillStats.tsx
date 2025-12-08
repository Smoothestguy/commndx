import { Card, CardContent } from "@/components/ui/card";
import { FileText, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { VendorBill } from "@/integrations/supabase/hooks/useVendorBills";

interface VendorBillStatsProps {
  bills: VendorBill[];
}

export function VendorBillStats({ bills }: VendorBillStatsProps) {
  const totalBills = bills.length;
  const totalAmount = bills.reduce((sum, b) => sum + Number(b.total), 0);
  const openBills = bills.filter(b => b.status === "open" || b.status === "partially_paid");
  const openAmount = openBills.reduce((sum, b) => sum + Number(b.remaining_amount), 0);
  const paidAmount = bills.reduce((sum, b) => sum + Number(b.paid_amount), 0);
  const overdueBills = bills.filter(b => 
    new Date(b.due_date) < new Date() && 
    b.status !== "paid" && 
    b.status !== "void"
  );

  const stats = [
    {
      label: "Total Bills",
      value: totalBills,
      subValue: `$${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      icon: FileText,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      label: "Open Balance",
      value: openBills.length,
      subValue: `$${openAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      icon: Clock,
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
    },
    {
      label: "Paid",
      value: bills.filter(b => b.status === "paid").length,
      subValue: `$${paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      icon: CheckCircle,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900/30",
    },
    {
      label: "Overdue",
      value: overdueBills.length,
      subValue: overdueBills.length > 0 ? "Needs attention" : "None",
      icon: AlertTriangle,
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-100 dark:bg-red-900/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-sm font-medium">{stat.subValue}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
