import { useState } from "react";
import { Bell, Check, CheckCheck, Trash2, Filter, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  useAdminNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  AdminNotification,
} from "@/integrations/supabase/hooks/useAdminNotifications";
import { PageLayout } from "@/components/layout/PageLayout";

function getNotificationIcon(type: string) {
  switch (type) {
    case "po_approval":
      return "📋";
    case "co_approval":
      return "📝";
    case "personnel_registration":
    case "onboarding_started":
    case "onboarding_complete":
    case "onboarding_email_sent":
      return "👤";
    case "application_approved":
      return "✅";
    case "application_rejected":
      return "❌";
    default:
      return "🔔";
  }
}

function NotificationCard({
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
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        !notification.is_read && "border-primary/30 bg-primary/5"
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
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <span className="text-2xl">{getNotificationIcon(notification.notification_type)}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className={cn(
                "text-sm font-medium",
                !notification.is_read && "text-foreground"
              )}>
                {notification.title}
              </p>
              {!notification.is_read && (
                <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {notification.message}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })} • {format(new Date(notification.created_at), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {!notification.is_read && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkRead(notification.id);
                }}
                title="Mark as read"
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(notification.id);
              }}
              title="Delete notification"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminNotifications() {
  const navigate = useNavigate();
  const { data: notifications = [], isLoading } = useAdminNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");

  const handleNavigate = (url: string) => {
    navigate(url);
  };

  const filteredNotifications = activeTab === "unread" 
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <PageLayout title="Notifications">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Notifications</h1>
              <p className="text-sm text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all as read
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "unread")}>
          <TabsList>
            <TabsTrigger value="all">All ({notifications.length})</TabsTrigger>
            <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Bell className="h-12 w-12 text-muted-foreground/40 mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">
                    {activeTab === "unread" ? "No unread notifications" : "No notifications yet"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activeTab === "unread" ? "You're all caught up!" : "Notifications will appear here"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredNotifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onMarkRead={(id) => markRead.mutate(id)}
                    onDelete={(id) => deleteNotification.mutate(id)}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
