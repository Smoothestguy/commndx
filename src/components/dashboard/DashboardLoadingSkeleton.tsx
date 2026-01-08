import { Skeleton } from "@/components/ui/skeleton";

export function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4 animate-fade-in">
      {/* Welcome banner skeleton */}
      <Skeleton className="h-20 sm:h-[100px] w-full rounded-lg" />
      
      {/* Stats row skeleton - responsive grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Skeleton className="h-20 sm:h-[100px] rounded-lg" />
        <Skeleton className="h-20 sm:h-[100px] rounded-lg" />
        <Skeleton className="h-20 sm:h-[100px] rounded-lg" />
        <Skeleton className="h-20 sm:h-[100px] rounded-lg" />
      </div>
      
      {/* Charts row skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Skeleton className="h-48 sm:h-[200px] sm:col-span-1 lg:col-span-2 rounded-lg" />
        <Skeleton className="h-48 sm:h-[200px] sm:col-span-1 lg:col-span-2 rounded-lg" />
      </div>
      
      {/* Bottom row skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Skeleton className="h-20 sm:h-[100px] lg:col-span-2 rounded-lg" />
        <Skeleton className="h-20 sm:h-[100px] lg:col-span-2 rounded-lg" />
      </div>
    </div>
  );
}
