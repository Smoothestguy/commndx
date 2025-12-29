import { Mail, RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface ActivityLog {
  id: string;
  action: string;
  target_email: string;
  target_role: AppRole;
  performed_by_email: string | null;
  created_at: string;
}

interface ActivityLogCardProps {
  log: ActivityLog;
  index: number;
}

export function ActivityLogCard({ log, index }: ActivityLogCardProps) {
  const isMobile = useIsMobile();

  const getActionIcon = () => {
    const iconClass = isMobile ? "h-4 w-4" : "h-5 w-5";
    switch (log.action) {
      case "sent":
        return <Mail className={cn(iconClass, "text-blue-500")} />;
      case "resent":
        return <RefreshCw className={cn(iconClass, "text-orange-500")} />;
      case "accepted":
        return <CheckCircle2 className={cn(iconClass, "text-green-500")} />;
      case "cancelled":
        return <XCircle className={cn(iconClass, "text-red-500")} />;
      case "reminder_sent":
        return <Clock className={cn(iconClass, "text-yellow-500")} />;
      case "expired":
        return <AlertCircle className={cn(iconClass, "text-muted-foreground")} />;
      default:
        return <Mail className={iconClass} />;
    }
  };

  const getActionLabel = () => {
    switch (log.action) {
      case "sent":
        return "Invitation Sent";
      case "resent":
        return "Invitation Resent";
      case "accepted":
        return "Invitation Accepted";
      case "cancelled":
        return "Invitation Cancelled";
      case "reminder_sent":
        return "Expiry Reminder Sent";
      case "expired":
        return "Invitation Expired";
      default:
        return log.action;
    }
  };

  const getBorderColor = () => {
    switch (log.action) {
      case "sent":
        return "border-l-blue-500";
      case "resent":
        return "border-l-orange-500";
      case "accepted":
        return "border-l-green-500";
      case "cancelled":
        return "border-l-red-500";
      case "reminder_sent":
        return "border-l-yellow-500";
      case "expired":
        return "border-l-muted-foreground";
      default:
        return "border-l-border";
    }
  };

  return (
    <div
      className={cn(
        "glass rounded-xl border-l-4 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300",
        getBorderColor(),
        isMobile ? "p-4" : "p-6"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start gap-3 md:gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">{getActionIcon()}</div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5 md:space-y-2">
          {/* Action Label and Timestamp */}
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn("font-semibold", isMobile ? "text-sm" : "text-base")}>
              {getActionLabel()}
            </h3>
            <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
              {format(new Date(log.created_at), isMobile ? "MMM d" : "MMM d, h:mm a")}
            </span>
          </div>

          {/* Target Email and Role */}
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="font-medium truncate max-w-[150px] md:max-w-none">{log.target_email}</span>
            <span className="text-muted-foreground">•</span>
            <Badge variant="outline" className="capitalize flex-shrink-0 text-xs">
              {log.target_role}
            </Badge>
          </div>

          {/* Performed By */}
          {log.performed_by_email && (
            <p className="text-xs text-muted-foreground truncate">
              By: {log.performed_by_email}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
