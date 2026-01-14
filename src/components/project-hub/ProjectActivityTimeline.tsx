import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Clock, User, FileText, DollarSign, Truck, Receipt, Briefcase } from "lucide-react";
import { useAuditLogsForResource } from "@/integrations/supabase/hooks/useAuditLogs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

interface ProjectActivityTimelineProps {
  projectId: string;
}

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-500/10 text-green-500 border-green-500/20",
  update: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  delete: "bg-red-500/10 text-red-500 border-red-500/20",
  approve: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  reject: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  send: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  complete: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  status_change: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  payment: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
};

const RESOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  estimate: FileText,
  invoice: Receipt,
  purchase_order: Truck,
  job_order: Briefcase,
  change_order: FileText,
  tm_ticket: Receipt,
  time_entry: Clock,
  personnel: User,
  vendor_bill: DollarSign,
  project: Activity,
};

function formatActionType(action: string): string {
  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getResourceLink(resourceType: string, resourceId: string | null): string | null {
  if (!resourceId) return null;
  
  const routes: Record<string, string> = {
    estimate: `/estimates/${resourceId}`,
    invoice: `/invoices/${resourceId}`,
    purchase_order: `/purchase-orders/${resourceId}`,
    job_order: `/job-orders/${resourceId}`,
    change_order: `/change-orders/${resourceId}`,
    personnel: `/personnel/${resourceId}`,
    vendor_bill: `/vendor-bills/${resourceId}`,
  };
  
  return routes[resourceType] || null;
}

export function ProjectActivityTimeline({ projectId }: ProjectActivityTimelineProps) {
  const { data: auditLogs, isLoading } = useAuditLogsForResource("project", projectId);

  return (
    <Card className="glass border-border">
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Project Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading activity...</div>
        ) : !auditLogs || auditLogs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No activity recorded for this project yet.
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {auditLogs.map((log) => {
                const Icon = RESOURCE_ICONS[log.resource_type] || Activity;
                const resourceLink = getResourceLink(log.resource_type, log.resource_id);
                
                return (
                  <div
                    key={log.id}
                    className="flex gap-4 pb-4 border-b border-border last:border-0"
                  >
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={ACTION_COLORS[log.action_type] || "bg-muted"}
                        >
                          {formatActionType(log.action_type)}
                        </Badge>
                        <span className="text-sm font-medium capitalize">
                          {log.resource_type.replace("_", " ")}
                        </span>
                        {log.resource_number && resourceLink && (
                          <Link
                            to={resourceLink}
                            className="text-sm text-primary hover:underline font-medium"
                          >
                            #{log.resource_number}
                          </Link>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{log.user_email}</span>
                        <span>•</span>
                        <Clock className="h-3 w-3" />
                        <span title={format(new Date(log.created_at), "PPpp")}>
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {log.changes_after && Object.keys(log.changes_after).length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground bg-secondary/50 p-2 rounded">
                          <span className="font-medium">Changes: </span>
                          {Object.keys(log.changes_after as object).slice(0, 3).join(", ")}
                          {Object.keys(log.changes_after as object).length > 3 && "..."}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
