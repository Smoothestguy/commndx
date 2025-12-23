import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock,
  Play,
  Square,
  Navigation,
  Zap,
  Pause,
  Activity,
} from "lucide-react";

interface SessionActivityTimelineProps {
  dateRange?: DateRange;
  sessionId?: string | null;
  targetUserId?: string | null;
}

interface ActivityLog {
  id: string;
  activity_type: string;
  route: string | null;
  action_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function SessionActivityTimeline({
  dateRange,
  sessionId,
  targetUserId,
}: SessionActivityTimelineProps) {
  const { user } = useAuth();
  const userId = targetUserId || user?.id;

  const { data: activities, isLoading } = useQuery({
    queryKey: [
      "session-activity",
      userId,
      sessionId,
      dateRange?.from,
      dateRange?.to,
    ],
    queryFn: async () => {
      if (!userId) return [];

      let query = supabase
        .from("session_activity_log")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (sessionId) {
        query = query.eq("session_id", sessionId);
      } else if (dateRange?.from && dateRange?.to) {
        query = query
          .gte("created_at", dateRange.from.toISOString())
          .lte("created_at", dateRange.to.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ActivityLog[];
    },
    enabled: !!userId,
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "clock_in":
        return <Play className="h-4 w-4 text-green-500" />;
      case "clock_out":
        return <Square className="h-4 w-4 text-red-500" />;
      case "page_view":
        return <Navigation className="h-4 w-4 text-blue-500" />;
      case "action":
        return <Zap className="h-4 w-4 text-amber-500" />;
      case "idle_start":
        return <Pause className="h-4 w-4 text-muted-foreground" />;
      case "idle_end":
        return <Activity className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityBadgeVariant = (
    type: string
  ): "default" | "secondary" | "outline" | "destructive" => {
    switch (type) {
      case "clock_in":
        return "default";
      case "clock_out":
        return "destructive";
      case "action":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Activity Timeline
          {sessionId && (
            <Badge variant="outline" className="ml-2">
              Filtered by session
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities && activities.length > 0 ? (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {activities.map((activity, index) => (
                <div
                  key={activity.id}
                  className="flex gap-3 relative pb-4 last:pb-0"
                >
                  {/* Timeline line */}
                  {index < activities.length - 1 && (
                    <div className="absolute left-4 top-8 w-px h-full bg-border -translate-x-1/2" />
                  )}

                  {/* Icon */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted shrink-0 z-10">
                    {getActivityIcon(activity.activity_type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getActivityBadgeVariant(activity.activity_type)}>
                        {activity.activity_type.replace("_", " ")}
                      </Badge>
                      {activity.route && (
                        <span className="text-sm text-muted-foreground font-mono">
                          {activity.route}
                        </span>
                      )}
                    </div>
                    {activity.action_name && (
                      <p className="text-sm">{activity.action_name}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(activity.created_at), "MMM d, h:mm:ss a")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {sessionId
              ? "No activity recorded for this session"
              : "No activity found for the selected date range"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
