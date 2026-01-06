import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { 
  generateAuditActivityDescription, 
  generateSessionActivityDescription,
  formatActivityTime,
  type ActivityDescription 
} from "@/utils/activityDescriptions";
import type { CombinedActivity } from "@/hooks/usePersonalActivityHistory";

interface ActivityHistoryItemProps {
  activity: CombinedActivity;
  onClick: () => void;
}

const colorClasses: Record<ActivityDescription["color"], string> = {
  green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  gray: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400",
};

const dotColorClasses: Record<ActivityDescription["color"], string> = {
  green: "bg-green-500",
  blue: "bg-blue-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  gray: "bg-gray-500",
};

export function ActivityHistoryItem({ activity, onClick }: ActivityHistoryItemProps) {
  const description = activity.source === "audit"
    ? generateAuditActivityDescription({
        id: activity.id,
        created_at: activity.created_at,
        action_type: activity.action_type || "",
        resource_type: activity.resource_type || "",
        resource_id: activity.resource_id || null,
        resource_number: activity.resource_number || null,
        changes_before: activity.changes_before || null,
        changes_after: activity.changes_after || null,
        success: activity.success ?? true,
        error_message: activity.error_message || null,
        metadata: activity.metadata || null,
      })
    : generateSessionActivityDescription({
        id: activity.id,
        created_at: activity.created_at,
        activity_type: activity.activity_type || "",
        route: activity.route,
        action_name: activity.action_name,
        context: activity.context,
      });

  const time = formatActivityTime(activity.created_at);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg text-left",
        "hover:bg-muted/50 transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      )}
    >
      {/* Timeline dot */}
      <div className="flex flex-col items-center">
        <div className={cn("w-2.5 h-2.5 rounded-full", dotColorClasses[description.color])} />
      </div>

      {/* Icon */}
      <span className="text-lg" role="img" aria-hidden="true">
        {description.icon}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{description.title}</span>
          {activity.source === "audit" && activity.resource_number && (
            <Badge variant="outline" className="text-xs shrink-0">
              {activity.resource_number}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {description.description}
        </p>
      </div>

      {/* Time */}
      <span className="text-xs text-muted-foreground shrink-0">
        {time}
      </span>

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}
