import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, FolderOpen, Users, FileText, Clock, AlertCircle, Receipt, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardWidget, DashboardTheme } from "./types";
import { StatCard } from "../StatCard";

interface StatWidgetProps {
  widget: DashboardWidget;
  theme?: DashboardTheme;
  isEditMode?: boolean;
}

interface StatData {
  value: string | number;
  change?: number;
  changeType?: "positive" | "negative" | "neutral";
}

const STAT_ICONS: Record<string, typeof DollarSign> = {
  revenue: DollarSign,
  active_count: FolderOpen,
  on_site: Users,
  pending: FileText,
  overdue: AlertCircle,
  today: Clock,
  open_count: Receipt,
  total_count: Briefcase,
};

// Map widget IDs to navigation routes
const STAT_HREF_MAP: Record<string, string> = {
  "revenue-stat": "/invoices",
  "projects-stat": "/projects",
  "pending-invoices-stat": "/invoices",
  "overdue-invoices-stat": "/invoices",
  "estimates-stat": "/estimates",
  "customers-stat": "/customers",
  "hours-today-stat": "/time-tracking",
  "staffing-stat": "/project-assignments",
};

export function StatWidget({ widget, theme, isEditMode }: StatWidgetProps) {
  const { dataSource, metric } = widget.config;

  const { data: statData, isLoading } = useQuery({
    queryKey: ["stat-widget", dataSource, metric],
    queryFn: async (): Promise<StatData> => {
      // Fetch data based on dataSource and metric
      switch (dataSource) {
        case "invoices": {
          if (metric === "revenue") {
            const { data } = await supabase
              .from("invoices")
              .select("total, paid_amount")
              .is("deleted_at", null);
            const totalRevenue = data?.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0) ?? 0;
            return { value: formatCurrency(totalRevenue), changeType: "positive" };
          }
          if (metric === "pending") {
            const { count } = await supabase
              .from("invoices")
              .select("*", { count: "exact", head: true })
              .eq("status", "sent")
              .is("deleted_at", null);
            return { value: count ?? 0 };
          }
          if (metric === "overdue") {
            const { count } = await supabase
              .from("invoices")
              .select("*", { count: "exact", head: true })
              .eq("status", "overdue")
              .is("deleted_at", null);
            return { value: count ?? 0, changeType: count && count > 0 ? "negative" : "neutral" };
          }
          break;
        }
        case "projects": {
          if (metric === "active_count") {
            const { count } = await supabase
              .from("projects")
              .select("*", { count: "exact", head: true })
              .eq("status", "active")
              .is("deleted_at", null);
            return { value: count ?? 0 };
          }
          break;
        }
        case "personnel": {
          if (metric === "on_site") {
            // Get count of personnel clocked in today
            const today = new Date().toISOString().split("T")[0];
            const { count } = await supabase
              .from("time_entries")
              .select("personnel_id", { count: "exact", head: true })
              .gte("clock_in", `${today}T00:00:00`)
              .is("clock_out", null);
            return { value: count ?? 0 };
          }
          break;
        }
        case "estimates": {
          if (metric === "open_count") {
            const { count } = await supabase
              .from("estimates")
              .select("*", { count: "exact", head: true })
              .in("status", ["draft", "sent"])
              .is("deleted_at", null);
            return { value: count ?? 0 };
          }
          break;
        }
        case "customers": {
          if (metric === "total_count") {
            const { count } = await supabase
              .from("customers")
              .select("*", { count: "exact", head: true })
              .is("deleted_at", null);
            return { value: count ?? 0 };
          }
          break;
        }
        case "time_entries": {
          if (metric === "today") {
            const today = new Date().toISOString().split("T")[0];
            const { data } = await supabase
              .from("time_entries")
              .select("hours")
              .gte("clock_in_at", `${today}T00:00:00`);
            const totalHours = data?.reduce((sum, entry) => sum + (entry.hours || 0), 0) ?? 0;
            return { value: `${totalHours.toFixed(1)}h` };
          }
          break;
        }
      }
      return { value: "N/A" };
    },
    enabled: !!dataSource && !!metric,
    staleTime: 30000, // Cache for 30 seconds
  });

  const Icon = STAT_ICONS[metric || ""] || FolderOpen;

  const fontSizeClass = {
    small: "text-xl",
    medium: "text-2xl",
    large: "text-3xl",
  }[theme?.fontSize ?? "medium"];

  const href = STAT_HREF_MAP[widget.id];

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-muted rounded w-24 mb-2" />
        <div className="h-4 bg-muted rounded w-16" />
      </div>
    );
  }

  // In view mode, render the full StatCard with navigation
  if (!isEditMode) {
    return (
      <StatCard
        title={widget.title}
        value={statData?.value ?? "N/A"}
        icon={Icon}
        href={href}
        changeType={statData?.changeType}
        backgroundColor={theme?.cardBackground}
        textColor={theme?.cardTextColor}
      />
    );
  }

  // In edit mode, render content without navigation (for drag/drop)
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className={cn("font-bold", fontSizeClass)}>{statData?.value ?? "N/A"}</p>
        {statData?.change !== undefined && (
          <p
            className={cn(
              "text-xs",
              statData.changeType === "positive" && "text-green-500",
              statData.changeType === "negative" && "text-red-500",
              statData.changeType === "neutral" && "text-muted-foreground"
            )}
          >
            {statData.change > 0 ? "+" : ""}
            {statData.change}%
          </p>
        )}
      </div>
      <div
        className={cn(
          "p-3 rounded-full",
          theme?.accentColor ? "" : "bg-primary/10"
        )}
        style={{ backgroundColor: theme?.accentColor ? `${theme.accentColor}20` : undefined }}
      >
        <Icon
          className="h-5 w-5"
          style={{ color: theme?.accentColor }}
        />
      </div>
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
