import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { FileText, Receipt, FolderKanban } from "lucide-react";
import { Link } from "react-router-dom";

interface ActivityItem {
  id: string;
  type: "invoice" | "estimate" | "project";
  title: string;
  description: string;
  timestamp: string;
}

const ACTIVITY_ICONS = {
  invoice: Receipt,
  estimate: FileText,
  project: FolderKanban,
};

export function RecentActivityTable() {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["recent-activity-row"],
    queryFn: async () => {
      const [invoicesRes, estimatesRes, projectsRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, number, customer_name, created_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("estimates")
          .select("id, number, customer_name, created_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("projects")
          .select("id, name, created_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      const items: ActivityItem[] = [];

      invoicesRes.data?.forEach((inv) => {
        items.push({
          id: inv.id,
          type: "invoice",
          title: `Invoice ${inv.number}`,
          description: inv.customer_name,
          timestamp: inv.created_at,
        });
      });

      estimatesRes.data?.forEach((est) => {
        items.push({
          id: est.id,
          type: "estimate",
          title: `Estimate ${est.number}`,
          description: est.customer_name,
          timestamp: est.created_at,
        });
      });

      projectsRes.data?.forEach((proj) => {
        items.push({
          id: proj.id,
          type: "project",
          title: proj.name,
          description: "Project created",
          timestamp: proj.created_at,
        });
      });

      return items
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 6);
    },
    staleTime: 30000,
  });

  const getHref = (item: ActivityItem) => {
    switch (item.type) {
      case "invoice":
        return `/invoices/${item.id}`;
      case "estimate":
        return `/estimates/${item.id}`;
      case "project":
        return `/projects/${item.id}`;
    }
  };

  return (
    <div className="border border-border rounded-sm bg-card overflow-hidden">
      <div className="px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Recent Activity</h3>
          <Link to="/activity-history" className="text-xs text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </div>
      </div>
      <div className="divide-y divide-border">
        {isLoading ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading...</div>
        ) : !activities || activities.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">No activity</div>
        ) : (
          activities.map((item) => {
            const Icon = ACTIVITY_ICONS[item.type];
            return (
              <Link
                key={`${item.type}-${item.id}`}
                to={getHref(item)}
                className="flex items-center gap-3 px-4 py-2 hover:bg-muted/30 transition-colors"
              >
                <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
