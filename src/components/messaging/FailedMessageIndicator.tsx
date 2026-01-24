import { AlertTriangle, RefreshCw, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/hooks/useNotificationPriority";
import { cn } from "@/lib/utils";

interface FailedMessageIndicatorProps {
  errorCode?: string | null;
  errorMessage?: string | null;
  onRetry?: () => void;
  onSendInAppOnly?: () => void;
  isRetrying?: boolean;
  className?: string;
}

export function FailedMessageIndicator({
  errorCode,
  errorMessage,
  onRetry,
  onSendInAppOnly,
  isRetrying = false,
  className,
}: FailedMessageIndicatorProps) {
  const error = getErrorMessage(errorCode);

  return (
    <div
      className={cn(
        "mt-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20",
        className
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">{error.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {errorMessage || error.description}
          </p>
          <p className="text-xs text-muted-foreground mt-1 italic">
            {error.action}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        {onRetry && (
          <Button
            size="sm"
            variant="destructive"
            onClick={onRetry}
            disabled={isRetrying}
            className="h-7 text-xs"
          >
            {isRetrying ? (
              <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1.5" />
            )}
            Retry SMS
          </Button>
        )}
        {onSendInAppOnly && (
          <Button
            size="sm"
            variant="outline"
            onClick={onSendInAppOnly}
            disabled={isRetrying}
            className="h-7 text-xs"
          >
            <MessageCircle className="h-3 w-3 mr-1.5" />
            In-app only
          </Button>
        )}
      </div>
    </div>
  );
}

// Compact inline version for message list
export function FailedMessageBadge({
  onClick,
  className,
}: {
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs",
        "bg-destructive/10 text-destructive hover:bg-destructive/20",
        "transition-colors cursor-pointer",
        className
      )}
    >
      <AlertTriangle className="h-3 w-3" />
      <span>Failed</span>
    </button>
  );
}
