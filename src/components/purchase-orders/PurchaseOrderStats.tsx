import { DollarSign, Clock, ShoppingCart, CheckCircle } from "lucide-react";
import { PurchaseOrder } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { formatCurrency } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface PurchaseOrderStatsProps {
  purchaseOrders: PurchaseOrder[];
}

export function PurchaseOrderStats({ purchaseOrders }: PurchaseOrderStatsProps) {
  const isMobile = useIsMobile();
  
  const totalValue = purchaseOrders.reduce((sum, po) => sum + po.total, 0);
  const inProgressValue = purchaseOrders
    .filter((po) => po.status === "in-progress")
    .reduce((sum, po) => sum + po.total, 0);
  const activePOs = purchaseOrders.filter(
    (po) => po.status !== "completed" && po.status !== "cancelled"
  ).length;
  const completedCount = purchaseOrders.filter((po) => po.status === "completed").length;

  const stats = [
    {
      label: "Total PO Value",
      value: formatCurrency(totalValue),
      icon: DollarSign,
      color: "text-primary",
      showOnMobile: true,
    },
    {
      label: "In Progress",
      value: formatCurrency(inProgressValue),
      icon: Clock,
      color: "text-warning",
      showOnMobile: false,
    },
    {
      label: "Active POs",
      value: activePOs,
      icon: ShoppingCart,
      color: "text-primary",
      showOnMobile: true,
    },
    {
      label: "Completed",
      value: completedCount,
      icon: CheckCircle,
      color: "text-success",
      showOnMobile: false,
    },
  ];

  const displayStats = isMobile ? stats.filter(s => s.showOnMobile) : stats;

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-6">
      {displayStats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="glass rounded-lg p-4 animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <p className="text-2xl font-heading font-bold text-foreground">
              {stat.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}