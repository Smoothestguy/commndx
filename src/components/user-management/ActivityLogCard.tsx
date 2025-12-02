import { Mail, RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  const getActionIcon = () => {
    switch (log.action) {
      case "sent":
        return <Mail className="h-5 w-5 text-blue-500" />;
      case "resent":
        return <RefreshCw className="h-5 w-5 text-orange-500" />;
      case "accepted":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "cancelled":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "reminder_sent":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "expired":
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
      default:
        return <Mail className="h-5 w-5" />;
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
      className={`glass rounded-xl p-6 border-l-4 ${getBorderColor()} hover:shadow-lg hover:shadow-primary/20 transition-all duration-300`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 mt-1">{getActionIcon()}</div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Action Label and Timestamp */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-base">{getActionLabel()}</h3>
            <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
              {format(new Date(log.created_at), "MMM d, h:mm a")}
            </span>
          </div>

          {/* Target Email and Role */}
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium truncate">{log.target_email}</span>
            <span className="text-muted-foreground">•</span>
            <Badge variant="outline" className="capitalize flex-shrink-0">
              {log.target_role}
            </Badge>
          </div>

          {/* Performed By */}
          {log.performed_by_email && (
            <p className="text-xs text-muted-foreground">
              By: {log.performed_by_email}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
