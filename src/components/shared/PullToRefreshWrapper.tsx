import { ReactNode } from "react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { Loader2 } from "lucide-react";

interface PullToRefreshWrapperProps {
  children: ReactNode;
  onRefresh: () => void | Promise<any>;
  isRefreshing?: boolean;
}

export function PullToRefreshWrapper({
  children,
  onRefresh,
  isRefreshing = false,
}: PullToRefreshWrapperProps) {
  const { scrollRef, isPulling, pullDistance, shouldShowIndicator } =
    usePullToRefresh({
      onRefresh,
      isRefreshing,
    });

  const progress = Math.min((pullDistance / 80) * 100, 100);
  const shouldRelease = pullDistance >= 80;

  return (
    <div ref={scrollRef} className="relative">
      {/* Pull to Refresh Indicator */}
      {shouldShowIndicator && (
        <div
          className="absolute top-0 left-0 right-0 flex flex-col items-center justify-center z-50 transition-all duration-200"
          style={{
            transform: `translateY(${Math.min(pullDistance - 40, 40)}px)`,
            opacity: Math.min(pullDistance / 80, 1),
          }}
        >
          <div className="glass rounded-full p-3 backdrop-blur-xl border border-border shadow-lg">
            <Loader2
              className="h-6 w-6 text-primary"
              style={{
                transform: `rotate(${progress * 3.6}deg)`,
                animation: isRefreshing ? "spin 1s linear infinite" : "none",
              }}
            />
          </div>
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            {isRefreshing
              ? "Refreshing..."
              : shouldRelease
              ? "Release to refresh"
              : "Pull to refresh"}
          </p>
        </div>
      )}

      {/* Content */}
      <div
        className="transition-transform duration-200"
        style={{
          transform: isPulling ? `translateY(${pullDistance * 0.5}px)` : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
