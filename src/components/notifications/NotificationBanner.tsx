import { useState, useEffect, useCallback } from "react";
import { X, AlertTriangle, RefreshCw, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotificationPriority } from "@/hooks/useNotificationPriority";

export interface BannerNotification {
  id: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  actionLabel?: string;
  onAction?: () => void;
  linkUrl?: string;
  timestamp?: string;
}

interface NotificationBannerProps {
  notification: BannerNotification | null;
  onDismiss: (id: string) => void;
  autoDismissMs?: number;
}

export function NotificationBanner({
  notification,
  onDismiss,
  autoDismissMs = 8000,
}: NotificationBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    if (!notification) return;
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsExiting(false);
      onDismiss(notification.id);
    }, 300);
  }, [notification, onDismiss]);

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      setIsExiting(false);

      // Don't auto-dismiss critical notifications
      if (notification.priority !== "critical" && autoDismissMs > 0) {
        const timer = setTimeout(handleDismiss, autoDismissMs);
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [notification, autoDismissMs, handleDismiss]);

  if (!notification || !isVisible) return null;

  const priorityStyles = {
    critical: "bg-destructive text-destructive-foreground border-destructive",
    high: "bg-destructive/90 text-destructive-foreground border-destructive/80",
    normal: "bg-primary text-primary-foreground border-primary",
    low: "bg-muted text-muted-foreground border-border",
  };

  const priorityIcons = {
    critical: <AlertTriangle className="h-5 w-5 animate-pulse" />,
    high: <AlertTriangle className="h-5 w-5" />,
    normal: null,
    low: null,
  };

  return (
    <div
      className={cn(
        "fixed top-14 left-0 right-0 z-50 mx-auto max-w-2xl px-4",
        "transform transition-all duration-300 ease-out",
        isExiting ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
      )}
    >
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border p-4 shadow-lg",
          priorityStyles[notification.priority]
        )}
      >
        {/* Icon */}
        {priorityIcons[notification.priority] && (
          <div className="shrink-0 mt-0.5">
            {priorityIcons[notification.priority]}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{notification.title}</p>
          <p className="text-sm opacity-90 mt-0.5">{notification.message}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {notification.onAction && notification.actionLabel && (
            <Button
              size="sm"
              variant={notification.priority === "low" ? "secondary" : "outline"}
              className={cn(
                notification.priority !== "low" && "bg-background/20 hover:bg-background/30 border-current"
              )}
              onClick={notification.onAction}
            >
              {notification.actionLabel === "Retry" ? (
                <RefreshCw className="h-3 w-3 mr-1" />
              ) : (
                <ArrowRight className="h-3 w-3 mr-1" />
              )}
              {notification.actionLabel}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "h-6 w-6",
              notification.priority !== "low" && "hover:bg-background/20"
            )}
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Hook to manage banner queue
export function useNotificationBannerQueue() {
  const [queue, setQueue] = useState<BannerNotification[]>([]);
  const [currentNotification, setCurrentNotification] = useState<BannerNotification | null>(null);

  const addNotification = useCallback((notification: BannerNotification) => {
    setQueue((prev) => {
      // Don't add duplicates
      if (prev.some((n) => n.id === notification.id)) return prev;
      
      // Critical notifications go to front
      if (notification.priority === "critical") {
        return [notification, ...prev];
      }
      return [...prev, notification];
    });
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setQueue((prev) => prev.filter((n) => n.id !== id));
    if (currentNotification?.id === id) {
      setCurrentNotification(null);
    }
  }, [currentNotification]);

  // Show next notification when current is dismissed
  useEffect(() => {
    if (!currentNotification && queue.length > 0) {
      const next = queue[0];
      setCurrentNotification(next);
    }
  }, [currentNotification, queue]);

  return {
    currentNotification,
    addNotification,
    dismissNotification,
    queueLength: queue.length,
  };
}
