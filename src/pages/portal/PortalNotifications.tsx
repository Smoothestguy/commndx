import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel, usePersonnelNotifications, useMarkNotificationRead } from "@/integrations/supabase/hooks/usePortal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Briefcase, DollarSign, Info, CheckCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

const NOTIFICATION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  general: Info,
  job_alert: Briefcase,
  pay_info: DollarSign,
  assignment: CheckCircle,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  general: "bg-blue-500/10 text-blue-500",
  job_alert: "bg-orange-500/10 text-orange-500",
  pay_info: "bg-green-500/10 text-green-500",
  assignment: "bg-purple-500/10 text-purple-500",
};

export default function PortalNotifications() {
  const { data: personnel } = useCurrentPersonnel();
  const { data: notifications, isLoading } = usePersonnelNotifications(personnel?.id);
  const markRead = useMarkNotificationRead();

  const handleMarkRead = (id: string) => {
    if (!personnel?.id) return;
    markRead.mutate({ id, personnelId: personnel.id });
  };

  const handleMarkAllRead = () => {
    if (!personnel?.id || !notifications) return;
    const unread = notifications.filter(n => !n.is_read);
    unread.forEach(n => {
      markRead.mutate({ id: n.id, personnelId: personnel.id });
    });
  };

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-muted-foreground">
              {unreadCount > 0 
                ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                : "All caught up!"
              }
            </p>
          </div>
          
          {unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAllRead}>
              Mark All as Read
            </Button>
          )}
        </div>

        {notifications && notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const Icon = NOTIFICATION_ICONS[notification.notification_type] || Info;
              const iconColor = NOTIFICATION_COLORS[notification.notification_type] || NOTIFICATION_COLORS.general;
              
              return (
                <Card 
                  key={notification.id}
                  className={cn(
                    "transition-colors",
                    !notification.is_read && "bg-muted/50 border-primary/20"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={cn("p-2 rounded-lg", iconColor)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{notification.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {notification.message}
                            </p>
                          </div>
                          
                          {!notification.is_read && (
                            <Badge variant="default" className="shrink-0">New</Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(notification.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                          
                          {!notification.is_read && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleMarkRead(notification.id)}
                            >
                              Mark as Read
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No notifications</h3>
              <p className="text-muted-foreground text-center">
                You don't have any notifications yet.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
