/**
 * Loading state for any route inside the protected group.
 *
 * Skeleton-based (Pitfall 5: never show a blank screen or a raw
 * spinner — always something that hints at the layout that's coming).
 * The shapes here loosely match the typical KPI-grid + table layout
 * the eventual pages will use.
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-1/3" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
