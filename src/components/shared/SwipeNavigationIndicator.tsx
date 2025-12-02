import { ChevronLeft, ChevronRight } from "lucide-react";

interface SwipeNavigationIndicatorProps {
  prevPage: string | null;
  nextPage: string | null;
}

export function SwipeNavigationIndicator({
  prevPage,
  nextPage,
}: SwipeNavigationIndicatorProps) {
  return (
    <>
      {/* Left Edge Indicator */}
      {prevPage && (
        <div className="fixed left-0 top-1/2 -translate-y-1/2 z-40 pointer-events-none lg:hidden">
          <div className="flex items-center gap-2 p-2 bg-gradient-to-r from-primary/20 to-transparent backdrop-blur-sm rounded-r-lg">
            <ChevronLeft className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-primary pr-2">{prevPage}</span>
          </div>
        </div>
      )}

      {/* Right Edge Indicator */}
      {nextPage && (
        <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 pointer-events-none lg:hidden">
          <div className="flex items-center gap-2 p-2 bg-gradient-to-l from-primary/20 to-transparent backdrop-blur-sm rounded-l-lg">
            <span className="text-xs font-medium text-primary pl-2">{nextPage}</span>
            <ChevronRight className="h-4 w-4 text-primary" />
          </div>
        </div>
      )}
    </>
  );
}
