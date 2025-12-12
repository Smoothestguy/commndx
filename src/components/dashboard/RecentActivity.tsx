import { FileText, Receipt, Briefcase, ShoppingCart } from "lucide-react";
import { useEstimates } from "@/integrations/supabase/hooks/useEstimates";
import { useInvoices } from "@/integrations/supabase/hooks/useInvoices";
import { useJobOrders } from "@/integrations/supabase/hooks/useJobOrders";
import { usePurchaseOrders } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";

export function RecentActivity() {
  const { data: estimates } = useEstimates();
  const { data: invoices } = useInvoices();
  const { data: jobOrders } = useJobOrders();
  const { data: purchaseOrders } = usePurchaseOrders();

  const activities = useMemo(() => {
    const allActivities = [
      ...(estimates?.slice(0, 3).map((est) => ({
        id: `est-${est.id}`,
        type: "estimate",
        title: "Estimate created",
        description: `${est.number} for ${est.customer_name}`,
        time: formatDistanceToNow(new Date(est.created_at), { addSuffix: true }),
        icon: FileText,
      })) || []),
      ...(invoices?.slice(0, 3).map((inv) => ({
        id: `inv-${inv.id}`,
        type: "invoice",
        title: inv.status === "paid" ? "Invoice paid" : "Invoice created",
        description: `${inv.number} - $${inv.total.toLocaleString()}`,
        time: formatDistanceToNow(new Date(inv.created_at), { addSuffix: true }),
        icon: Receipt,
      })) || []),
      ...(jobOrders?.slice(0, 2).map((jo) => ({
        id: `jo-${jo.id}`,
        type: "job_order",
        title: "Job order started",
        description: `${jo.number} - ${jo.project_name}`,
        time: formatDistanceToNow(new Date(jo.created_at), { addSuffix: true }),
        icon: Briefcase,
      })) || []),
      ...(purchaseOrders?.slice(0, 2).map((po) => ({
        id: `po-${po.id}`,
        type: "purchase_order",
        title: "Purchase order created",
        description: `${po.number} for ${po.vendor_name}`,
        time: formatDistanceToNow(new Date(po.created_at), { addSuffix: true }),
        icon: ShoppingCart,
      })) || []),
    ];

    return allActivities
      .sort((a, b) => {
        const aTime = a.time.includes("ago") ? a.time : "0 seconds ago";
        const bTime = b.time.includes("ago") ? b.time : "0 seconds ago";
        return aTime.localeCompare(bTime);
      })
      .slice(0, 4);
  }, [estimates, invoices, jobOrders, purchaseOrders]);
  return (
    <div className="glass rounded-xl p-4 sm:p-6">
      <h3 className="font-heading text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">
        Recent Activity
      </h3>
      <div className="space-y-2 sm:space-y-3">
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent activity yet
          </p>
        ) : (
          activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-2.5 sm:gap-4 p-2.5 sm:p-4 rounded-lg hover:bg-secondary/50 transition-colors duration-200 cursor-pointer"
          >
            <div className="flex h-8 w-8 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <activity.icon className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-foreground">{activity.title}</p>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {activity.description}
              </p>
            </div>
            <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
              {activity.time}
            </span>
          </div>
          ))
        )}
      </div>
    </div>
  );
}
