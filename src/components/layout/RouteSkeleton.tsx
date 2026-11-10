import { Skeleton } from '@/components/ui/skeleton';

export function RouteSkeleton() {
  return <div role="status" aria-label="Loading page" className="p-4 space-y-4 min-h-96">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-10 w-full" />
    {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}
  </div>;
}