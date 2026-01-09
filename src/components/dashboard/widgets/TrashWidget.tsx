import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { DashboardWidget, DashboardTheme } from "./types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { FileText, FolderOpen, Receipt, Users, Package, Truck, ClipboardList, FileCheck } from "lucide-react";

interface TrashWidgetProps {
  widget: DashboardWidget;
  theme?: DashboardTheme;
  isEditMode?: boolean;
}

interface DeletedItem {
  id: string;
  type: 'estimate' | 'invoice' | 'project' | 'customer' | 'product' | 'vendor' | 'purchase_order' | 'job_order' | 'change_order';
  name: string;
  number?: string;
  deleted_at: string;
}

const TYPE_CONFIG: Record<DeletedItem['type'], { icon: typeof FileText; label: string; color: string }> = {
  estimate: { icon: Receipt, label: 'Estimate', color: 'bg-blue-500/10 text-blue-600' },
  invoice: { icon: FileText, label: 'Invoice', color: 'bg-green-500/10 text-green-600' },
  project: { icon: FolderOpen, label: 'Project', color: 'bg-purple-500/10 text-purple-600' },
  customer: { icon: Users, label: 'Customer', color: 'bg-amber-500/10 text-amber-600' },
  product: { icon: Package, label: 'Product', color: 'bg-cyan-500/10 text-cyan-600' },
  vendor: { icon: Truck, label: 'Vendor', color: 'bg-rose-500/10 text-rose-600' },
  purchase_order: { icon: ClipboardList, label: 'PO', color: 'bg-indigo-500/10 text-indigo-600' },
  job_order: { icon: FileCheck, label: 'Job Order', color: 'bg-teal-500/10 text-teal-600' },
  change_order: { icon: FileCheck, label: 'CO', color: 'bg-orange-500/10 text-orange-600' },
};

export function TrashWidget({ widget, theme, isEditMode }: TrashWidgetProps) {
  const { displayOptions } = widget.config;
  const limit = displayOptions?.limit ?? 10;

  const { data: deletedItems, isLoading } = useQuery({
    queryKey: ["trash-widget", limit],
    queryFn: async (): Promise<DeletedItem[]> => {
      const items: DeletedItem[] = [];

      // Fetch deleted estimates
      const { data: estimates } = await supabase
        .from("estimates")
        .select("id, number, customer_name, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(limit);

      if (estimates) {
        items.push(...estimates.map(e => ({
          id: e.id,
          type: 'estimate' as const,
          name: e.customer_name,
          number: e.number,
          deleted_at: e.deleted_at!,
        })));
      }

      // Fetch deleted invoices
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, number, customer_name, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(limit);

      if (invoices) {
        items.push(...invoices.map(i => ({
          id: i.id,
          type: 'invoice' as const,
          name: i.customer_name,
          number: i.number,
          deleted_at: i.deleted_at!,
        })));
      }

      // Fetch deleted projects
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(limit);

      if (projects) {
        items.push(...projects.map(p => ({
          id: p.id,
          type: 'project' as const,
          name: p.name,
          deleted_at: p.deleted_at!,
        })));
      }

      // Fetch deleted customers
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(limit);

      if (customers) {
        items.push(...customers.map(c => ({
          id: c.id,
          type: 'customer' as const,
          name: c.name,
          deleted_at: c.deleted_at!,
        })));
      }

      // Fetch deleted products
      const { data: products } = await supabase
        .from("products")
        .select("id, name, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(limit);

      if (products) {
        items.push(...products.map(p => ({
          id: p.id,
          type: 'product' as const,
          name: p.name,
          deleted_at: p.deleted_at!,
        })));
      }

      // Fetch deleted vendors
      const { data: vendors } = await supabase
        .from("vendors")
        .select("id, name, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(limit);

      if (vendors) {
        items.push(...vendors.map(v => ({
          id: v.id,
          type: 'vendor' as const,
          name: v.name,
          deleted_at: v.deleted_at!,
        })));
      }

      // Fetch deleted purchase orders
      const { data: purchaseOrders } = await supabase
        .from("purchase_orders")
        .select("id, number, vendor_name, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(limit);

      if (purchaseOrders) {
        items.push(...purchaseOrders.map(po => ({
          id: po.id,
          type: 'purchase_order' as const,
          name: po.vendor_name,
          number: po.number,
          deleted_at: po.deleted_at!,
        })));
      }

      // Fetch deleted job orders
      const { data: jobOrders } = await supabase
        .from("job_orders")
        .select("id, number, customer_name, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(limit);

      if (jobOrders) {
        items.push(...jobOrders.map(jo => ({
          id: jo.id,
          type: 'job_order' as const,
          name: jo.customer_name,
          number: jo.number,
          deleted_at: jo.deleted_at!,
        })));
      }

      // Fetch deleted change orders
      const { data: changeOrders } = await supabase
        .from("change_orders")
        .select("id, number, customer_name, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(limit);

      if (changeOrders) {
        items.push(...changeOrders.map(co => ({
          id: co.id,
          type: 'change_order' as const,
          name: co.customer_name,
          number: co.number,
          deleted_at: co.deleted_at!,
        })));
      }

      // Sort all items by deleted_at descending and take top limit
      return items
        .sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime())
        .slice(0, limit);
    },
    staleTime: 30000,
  });

  const fontSizeClass = {
    small: "text-xs",
    medium: "text-sm",
    large: "text-base",
  }[theme?.fontSize ?? "medium"];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse flex items-center gap-3 p-2 rounded border border-border">
            <div className="h-8 w-8 bg-muted rounded" />
            <div className="flex-1">
              <div className="h-3 bg-muted rounded w-24 mb-1" />
              <div className="h-2 bg-muted rounded w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!deletedItems || deletedItems.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No deleted items
      </div>
    );
  }

  return (
    <ScrollArea className="h-40 sm:h-48">
      <div className="space-y-2 pr-2">
        {deletedItems.map((item) => {
          const config = TYPE_CONFIG[item.type];
          const Icon = config.icon;
          
          return (
            <div
              key={`${item.type}-${item.id}`}
              className={cn(
                "flex items-center gap-3 p-2 sm:p-3 rounded-lg border border-border bg-background/50",
                fontSizeClass
              )}
            >
              <div className={cn("p-2 rounded-md", config.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {item.number && (
                    <span className="font-medium">#{item.number}</span>
                  )}
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {config.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {item.name}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-muted-foreground">
                  {format(new Date(item.deleted_at), "MMM d")}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}