import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { DashboardWidget, DashboardTheme } from "./types";
import { cn } from "@/lib/utils";

interface TableWidgetProps {
  widget: DashboardWidget;
  theme?: DashboardTheme;
  isEditMode?: boolean;
}

interface InvoiceRow {
  id: string;
  number: string;
  customer_name: string;
  total: number;
  status: string;
  created_at: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status.toLowerCase()) {
    case "paid":
      return "default";
    case "sent":
    case "pending":
      return "secondary";
    case "overdue":
      return "destructive";
    default:
      return "outline";
  }
};

export function TableWidget({ widget, theme, isEditMode }: TableWidgetProps) {
  const { dataSource, displayOptions } = widget.config;
  const limit = displayOptions?.limit ?? 5;

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["table-widget", dataSource, limit],
    queryFn: async (): Promise<InvoiceRow[]> => {
      if (dataSource === "invoices") {
        const { data } = await supabase
          .from("invoices")
          .select("id, number, customer_name, total, status, created_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(limit);
        return data || [];
      }
      return [];
    },
    enabled: !!dataSource,
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
          <div key={i} className="animate-pulse flex items-center justify-between p-2 rounded border border-border">
            <div className="flex-1">
              <div className="h-3 bg-muted rounded w-20 mb-1" />
              <div className="h-2 bg-muted rounded w-32" />
            </div>
            <div className="text-right">
              <div className="h-3 bg-muted rounded w-16 mb-1" />
              <div className="h-4 bg-muted rounded w-12" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!invoices || invoices.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No recent invoices
      </div>
    );
  }

  return (
    <ScrollArea className="h-40 sm:h-48">
      <div className="space-y-2 pr-2">
        {invoices.map((invoice) => (
          <div
            key={invoice.id}
            className={cn(
              "flex items-center justify-between p-2 sm:p-3 rounded-lg border border-border bg-background/50",
              fontSizeClass
            )}
          >
            <div className="min-w-0 flex-1 mr-2">
              <p className="font-medium truncate">#{invoice.number}</p>
              <p className="text-xs text-muted-foreground truncate">
                {invoice.customer_name}
              </p>
            </div>
            <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
              <p className="font-semibold text-xs sm:text-sm">
                {formatCurrency(invoice.total)}
              </p>
              <Badge 
                variant={getStatusVariant(invoice.status)} 
                className="text-[10px] px-1.5 py-0"
              >
                {invoice.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
