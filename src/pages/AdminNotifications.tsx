import { useState } from "react";
import { Bell, Check, CheckCheck, Trash2, ArrowLeft, Square, CheckSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  useAdminNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  useBulkDeleteNotifications,
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
  isSelectionMode,
  isSelected,
  onToggleSelect,
}: {
  notification: AdminNotification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (url: string) => void;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const handleClick = () => {
    if (isSelectionMode) {
      onToggleSelect(notification.id);
      return;
    }
    if (!notification.is_read) {
      onMarkRead(notification.id);
    }
    if (notification.link_url) {
      onNavigate(notification.link_url);
    }
  };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        !notification.is_read && "border-primary/30 bg-primary/5",
        isSelected && "ring-2 ring-primary bg-primary/10"
      )}
      onClick={handleClick}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-3">
          {isSelectionMode && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(notification.id)}
              onClick={(e) => e.stopPropagation()}
              className="mt-1"
            />
          )}
          <span className="text-xl sm:text-2xl flex-shrink-0">{getNotificationIcon(notification.notification_type)}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className={cn(
                "text-sm font-medium truncate",
                !notification.is_read && "text-foreground"
              )}>
                {notification.title}
              </p>
              {!notification.is_read && (
                <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-1 line-clamp-2">
              {notification.message}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </p>
          </div>
          {!isSelectionMode && (
            <div className="flex items-center gap-1 flex-shrink-0">
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
          )}
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
  const bulkDelete = useBulkDeleteNotifications();
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleNavigate = (url: string) => {
    navigate(url);
  };

  const filteredNotifications = activeTab === "unread" 
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredNotifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNotifications.map(n => n.id)));
    }
  };

  const handleBulkDelete = () => {
    bulkDelete.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        setSelectedIds(new Set());
        setIsSelectionMode(false);
      },
    });
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const headerActions = isSelectionMode ? (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground hidden sm:inline">
        {selectedIds.size} selected
      </span>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleBulkDelete}
        disabled={selectedIds.size === 0 || bulkDelete.isPending}
      >
        <Trash2 className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Delete ({selectedIds.size})</span>
      </Button>
      <Button variant="outline" size="sm" onClick={exitSelectionMode}>
        <X className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Cancel</span>
      </Button>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setIsSelectionMode(true)}>
        <Square className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Select</span>
      </Button>
      {unreadCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending}
        >
          <CheckCheck className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Mark all read</span>
        </Button>
      )}
    </div>
  );

  return (
    <PageLayout 
      title="Notifications" 
      description={unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
      actions={headerActions}
    >
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "unread")}>
          <div className="flex items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="all" className="text-xs sm:text-sm">
                All ({notifications.length})
              </TabsTrigger>
              <TabsTrigger value="unread" className="text-xs sm:text-sm">
                Unread ({unreadCount})
              </TabsTrigger>
            </TabsList>
            
            {isSelectionMode && filteredNotifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectAll}
                className="text-xs"
              >
                {selectedIds.size === filteredNotifications.length ? (
                  <>
                    <CheckSquare className="h-4 w-4 mr-1" />
                    Deselect all
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-1" />
                    Select all
                  </>
                )}
              </Button>
            )}
          </div>
          
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
              <div className="space-y-2">
                {filteredNotifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onMarkRead={(id) => markRead.mutate(id)}
                    onDelete={(id) => deleteNotification.mutate(id)}
                    onNavigate={handleNavigate}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds.has(notification.id)}
                    onToggleSelect={toggleSelect}
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
