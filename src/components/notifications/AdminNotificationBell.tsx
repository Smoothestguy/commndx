import { Bell, Check, CheckCheck, Trash2, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  useAdminNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  AdminNotification,
} from "@/integrations/supabase/hooks/useAdminNotifications";
import {
  useNotificationBadgeState,
  getNotificationPriority,
  NotificationPriority,
} from "@/hooks/useNotificationPriority";

function getNotificationIcon(type: string) {
  switch (type) {
    case "po_approval":
      return "📋";
    case "co_approval":
      return "📝";
    case "personnel_registration":
      return "👤";
    case "missed_clock_in":
      return "⏰";
    case "auto_clock_out":
      return "📍";
    case "clock_block_cleared":
      return "✅";
    case "geofence_violation":
      return "🚨";
    case "late_clock_in_attempt":
      return "⚠️";
    case "message_failed":
      return "❌";
    default:
      return "🔔";
  }
}

function getPriorityStyles(priority: NotificationPriority) {
  switch (priority) {
    case "critical":
      return "border-l-4 border-l-destructive bg-destructive/5";
    case "high":
      return "border-l-4 border-l-orange-500 bg-orange-500/5";
    case "normal":
      return "";
    case "low":
      return "opacity-80";
    default:
      return "";
  }
}

function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
  onNavigate,
}: {
  notification: AdminNotification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (url: string) => void;
}) {
  const priority = getNotificationPriority({
    id: notification.id,
    is_read: notification.is_read,
    priority: notification.priority as NotificationPriority | undefined,
    notification_type: notification.notification_type,
    created_at: notification.created_at,
  });

  return (
    <div
      className={cn(
        "p-2.5 hover:bg-muted/50 transition-colors cursor-pointer group",
        !notification.is_read && "bg-primary/5",
        !notification.is_read && getPriorityStyles(priority)
      )}
      onClick={() => {
        if (!notification.is_read) {
          onMarkRead(notification.id);
        }
        if (notification.link_url) {
          onNavigate(notification.link_url);
        }
      }}
    >
      <div className="flex items-start gap-2">
        <span className="text-base flex-shrink-0">{getNotificationIcon(notification.notification_type)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <p className={cn(
              "text-sm break-words",
              !notification.is_read && "font-medium",
              priority === "critical" && !notification.is_read && "text-destructive"
            )}>
              {notification.title}
            </p>
            {!notification.is_read && (
              <span className={cn(
                "h-2 w-2 rounded-full flex-shrink-0 mt-1.5",
                priority === "critical" ? "bg-destructive animate-pulse" : 
                priority === "high" ? "bg-orange-500" : "bg-primary"
              )} />
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 break-words mt-0.5">
            {notification.message}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </p>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {!notification.is_read && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead(notification.id);
              }}
            >
              <Check className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(notification.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AdminNotificationBell() {
  const navigate = useNavigate();
  const { data: notifications = [], isLoading } = useAdminNotifications();
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();

  // Calculate badge state based on priority
  const badgeState = useNotificationBadgeState(
    notifications.map((n) => ({
      id: n.id,
      is_read: n.is_read,
      priority: n.priority as NotificationPriority | undefined,
      notification_type: n.notification_type,
      created_at: n.created_at,
    }))
  );

  const handleNavigate = (url: string) => {
    navigate(url);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-header-foreground hover:bg-sidebar-accent">
          <Bell className={cn(
            "h-5 w-5",
            badgeState.pulse && "animate-pulse"
          )} />
          {unreadCount > 0 && (
            <span className={cn(
              "absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full text-xs font-medium flex items-center justify-center",
              badgeState.color === "destructive" 
                ? "bg-destructive text-destructive-foreground" 
                : "bg-primary text-primary-foreground",
              badgeState.pulse && "animate-pulse"
            )}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">Notifications</h4>
            {badgeState.color === "destructive" && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                <AlertTriangle className="h-3 w-3" />
                Action needed
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8">
              <Bell className="h-10 w-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={(id) => markRead.mutate(id)}
                  onDelete={(id) => deleteNotification.mutate(id)}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => navigate("/notifications")}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                View all notifications
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
