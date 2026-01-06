import { useState, useMemo } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { History, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersonalActivityHistory, type CombinedActivity } from "@/hooks/usePersonalActivityHistory";
import { ActivityHistoryItem } from "./ActivityHistoryItem";
import { ActivityDetailModal } from "./ActivityDetailModal";
import { ActivityFilters } from "./ActivityFilters";
import { formatActivityDate } from "@/utils/activityDescriptions";

interface PersonalActivityHistoryProps {
  limit?: number;
  showFilters?: boolean;
  className?: string;
}

export function PersonalActivityHistory({ 
  limit = 100, 
  showFilters = true,
  className 
}: PersonalActivityHistoryProps) {
  const [selectedActivity, setSelectedActivity] = useState<CombinedActivity | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  
  // Filter state
  const [actionType, setActionType] = useState("all");
  const [resourceType, setResourceType] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [includeSession, setIncludeSession] = useState(true);

  const { data: activities = [], isLoading } = usePersonalActivityHistory({
    actionType: actionType === "all" ? undefined : actionType,
    resourceType: resourceType === "all" ? undefined : resourceType,
    startDate: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
    endDate: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
    limit,
    includeSession,
  });

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups: Record<string, CombinedActivity[]> = {};
    
    activities.forEach(activity => {
      const dateKey = format(new Date(activity.created_at), "yyyy-MM-dd");
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(activity);
    });
    
    return groups;
  }, [activities]);

  const handleActivityClick = (activity: CombinedActivity) => {
    setSelectedActivity(activity);
    setModalOpen(true);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            My Activity History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-2.5 w-2.5 rounded-full" />
                <Skeleton className="h-8 w-8 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            My Activity History
          </CardTitle>
          {showFilters && (
            <ActivityFilters
              actionType={actionType}
              onActionTypeChange={setActionType}
              resourceType={resourceType}
              onResourceTypeChange={setResourceType}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              includeSession={includeSession}
              onIncludeSessionChange={setIncludeSession}
            />
          )}
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <History className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No activities found</p>
              <p className="text-sm text-muted-foreground/70">
                Your actions will appear here as you use the application
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-6">
                {Object.entries(groupedActivities).map(([date, dayActivities]) => (
                  <div key={date}>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2 sticky top-0 bg-card py-1">
                      {formatActivityDate(date)}
                    </h3>
                    <div className="space-y-1 border-l-2 border-muted ml-1">
                      {dayActivities.map((activity) => (
                        <ActivityHistoryItem
                          key={activity.id}
                          activity={activity}
                          onClick={() => handleActivityClick(activity)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <ActivityDetailModal
        activity={selectedActivity}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
