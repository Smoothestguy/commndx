import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { FileText, Receipt, Users, FolderOpen, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DashboardWidget, DashboardTheme } from "./types";
import { cn } from "@/lib/utils";

interface ActivityWidgetProps {
  widget: DashboardWidget;
  theme?: DashboardTheme;
  isEditMode?: boolean;
}

interface ActivityItem {
  id: string;
  type: "invoice" | "estimate" | "project" | "personnel" | "time_entry";
  title: string;
  description: string;
  timestamp: string;
}

const ACTIVITY_ICONS = {
  invoice: FileText,
  estimate: Receipt,
  project: FolderOpen,
  personnel: Users,
  time_entry: Clock,
};

export function ActivityWidget({ widget, theme, isEditMode }: ActivityWidgetProps) {
  const limit = widget.config.displayOptions?.limit ?? 10;

  const { data: activities, isLoading } = useQuery({
    queryKey: ["activity-widget", limit],
    queryFn: async (): Promise<ActivityItem[]> => {
      const items: ActivityItem[] = [];

      // Fetch recent invoices
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, number, customer_name, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);

      invoices?.forEach((inv) => {
        items.push({
          id: inv.id,
          type: "invoice",
          title: `Invoice ${inv.number}`,
          description: `Created for ${inv.customer_name}`,
          timestamp: inv.created_at,
        });
      });

      // Fetch recent estimates
      const { data: estimates } = await supabase
        .from("estimates")
        .select("id, number, customer_name, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);

      estimates?.forEach((est) => {
        items.push({
          id: est.id,
          type: "estimate",
          title: `Estimate ${est.number}`,
          description: `Created for ${est.customer_name}`,
          timestamp: est.created_at,
        });
      });

      // Fetch recent projects
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);

      projects?.forEach((proj) => {
        items.push({
          id: proj.id,
          type: "project",
          title: proj.name,
          description: "Project created",
          timestamp: proj.created_at,
        });
      });

      // Sort all by timestamp and limit
      return items
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
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
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse flex items-center gap-3">
            <div className="h-8 w-8 bg-muted rounded-full" />
            <div className="flex-1">
              <div className="h-3 bg-muted rounded w-3/4 mb-1" />
              <div className="h-2 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No recent activity
      </div>
    );
  }

  return (
    <ScrollArea className="h-40 sm:h-48">
      <div className="space-y-2 sm:space-y-3 pr-4">
        {activities.map((activity) => {
          const Icon = ACTIVITY_ICONS[activity.type];
          return (
            <div key={activity.id} className="flex items-start gap-3">
              <div
                className={cn(
                  "p-2 rounded-full",
                  theme?.accentColor ? "" : "bg-primary/10"
                )}
                style={{ backgroundColor: theme?.accentColor ? `${theme.accentColor}20` : undefined }}
              >
                <Icon className="h-3 w-3" style={{ color: theme?.accentColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("font-medium truncate", fontSizeClass)}>
                  {activity.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {activity.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
