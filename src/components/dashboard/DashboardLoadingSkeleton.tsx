import { Skeleton } from "@/components/ui/skeleton";

export function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Welcome banner skeleton */}
      <Skeleton className="h-[100px] w-full rounded-lg" />
      
      {/* Stats row skeleton */}
      <div className="grid grid-cols-4 gap-4">
        <Skeleton className="h-[100px] rounded-lg" />
        <Skeleton className="h-[100px] rounded-lg" />
        <Skeleton className="h-[100px] rounded-lg" />
        <Skeleton className="h-[100px] rounded-lg" />
      </div>
      
      {/* Charts row skeleton */}
      <div className="grid grid-cols-4 gap-4">
        <Skeleton className="h-[200px] col-span-2 rounded-lg" />
        <Skeleton className="h-[200px] col-span-2 rounded-lg" />
      </div>
      
      {/* Bottom row skeleton */}
      <div className="grid grid-cols-4 gap-4">
        <Skeleton className="h-[100px] col-span-2 rounded-lg" />
        <Skeleton className="h-[100px] col-span-2 rounded-lg" />
      </div>
    </div>
  );
}
