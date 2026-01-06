import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ExternalLink, CheckCircle2, XCircle, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  generateAuditActivityDescription,
  generateSessionActivityDescription,
} from "@/utils/activityDescriptions";
import type { CombinedActivity } from "@/hooks/usePersonalActivityHistory";

interface ActivityDetailModalProps {
  activity: CombinedActivity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActivityDetailModal({ activity, open, onOpenChange }: ActivityDetailModalProps) {
  const navigate = useNavigate();

  if (!activity) return null;

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

  const formattedDate = format(new Date(activity.created_at), "EEEE, MMMM d, yyyy");
  const formattedTime = format(new Date(activity.created_at), "h:mm:ss a");

  const handleViewResource = () => {
    if (description.resourceLink) {
      onOpenChange(false);
      navigate(description.resourceLink);
    }
  };

  const hasChanges = activity.source === "audit" && 
    (activity.changes_before || activity.changes_after) &&
    activity.action_type === "update";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="text-2xl" role="img" aria-hidden="true">
              {description.icon}
            </span>
            <div>
              <DialogTitle className="text-xl">{description.title}</DialogTitle>
              {activity.source === "audit" && activity.resource_number && (
                <Badge variant="outline" className="mt-1">
                  {activity.resource_number}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Timestamp */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{formattedDate} at {formattedTime}</span>
          </div>

          {/* Status for audit logs */}
          {activity.source === "audit" && (
            <div className="flex items-center gap-2">
              {activity.success ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600 dark:text-green-400">Completed successfully</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-600 dark:text-red-400">Failed</span>
                </>
              )}
            </div>
          )}

          <Separator />

          {/* Description */}
          <div>
            <h4 className="text-sm font-medium mb-2">What happened</h4>
            <p className="text-sm text-muted-foreground">{description.description}</p>
          </div>

          {/* Details */}
          {description.details.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Details</h4>
              <ul className="space-y-1">
                {description.details.map((detail, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Before/After changes for updates */}
          {hasChanges && (
            <div>
              <h4 className="text-sm font-medium mb-2">Changes Made</h4>
              <ScrollArea className="max-h-48">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  {activity.changes_before && Object.keys(activity.changes_before).length > 0 && (
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                      <h5 className="font-medium text-red-700 dark:text-red-400 mb-2">Before</h5>
                      <pre className="whitespace-pre-wrap text-red-600 dark:text-red-300">
                        {JSON.stringify(activity.changes_before, null, 2)}
                      </pre>
                    </div>
                  )}
                  {activity.changes_after && Object.keys(activity.changes_after).length > 0 && (
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                      <h5 className="font-medium text-green-700 dark:text-green-400 mb-2">After</h5>
                      <pre className="whitespace-pre-wrap text-green-600 dark:text-green-300">
                        {JSON.stringify(activity.changes_after, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Error message */}
          {activity.source === "audit" && !activity.success && activity.error_message && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
              <h4 className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Error</h4>
              <p className="text-sm text-red-600 dark:text-red-300">{activity.error_message}</p>
            </div>
          )}

          {/* View resource button */}
          {description.resourceLink && (
            <div className="pt-2">
              <Button onClick={handleViewResource} className="w-full gap-2">
                <ExternalLink className="h-4 w-4" />
                View {activity.resource_type?.replace(/_/g, " ")}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
