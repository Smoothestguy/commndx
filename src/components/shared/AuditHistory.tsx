import { format } from "date-fns";
import { useAuditLogsForResource, AuditLog } from "@/integrations/supabase/hooks/useAuditLogs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Clock } from "lucide-react";

interface AuditHistoryProps {
  resourceType: string;
  resourceId: string | undefined;
  maxHeight?: string;
}

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-500/10 text-green-600 border-green-500/20",
  update: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  delete: "bg-red-500/10 text-red-600 border-red-500/20",
  approve: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  reject: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  send: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  payment: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  status_change: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
};

const formatActionType = (action: string) => {
  return action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

export const AuditHistory = ({
  resourceType,
  resourceId,
  maxHeight = "300px",
}: AuditHistoryProps) => {
  const { data: logs = [], isLoading } = useAuditLogsForResource(
    resourceType,
    resourceId
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No activity recorded yet
      </p>
    );
  }

  return (
    <ScrollArea style={{ maxHeight }} className="pr-4">
      <div className="space-y-3">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex items-start gap-3 p-3 rounded-lg border bg-card"
          >
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">
                  {log.user_email}
                </span>
                <Badge
                  variant="outline"
                  className={`text-xs ${ACTION_COLORS[log.action_type] || ""}`}
                >
                  {formatActionType(log.action_type)}
                </Badge>
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm a")}
                </span>
              </div>
              {log.changes_after && Object.keys(log.changes_after).length > 0 && (
                <div className="mt-2 text-xs">
                  <span className="text-muted-foreground">Changed: </span>
                  <span className="text-foreground">
                    {Object.keys(log.changes_after).join(", ")}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
