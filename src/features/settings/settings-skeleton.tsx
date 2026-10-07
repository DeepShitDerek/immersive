"use client";

import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the rail, form and preview so the page does not jump when it loads. */
export function SettingsSkeleton() {
  return (
    <div
      aria-busy
      className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_minmax(0,1fr)]"
    >
      <div className="hidden space-y-2 lg:block">
        <Skeleton className="h-9 w-full rounded-control" />
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full rounded-control" />
        ))}
      </div>

      <div className="space-y-5">
        <Skeleton className="h-10 w-full rounded-control lg:hidden" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-16 w-full rounded-surface" />
        <Skeleton className="h-16 w-full rounded-surface" />
        <Skeleton className="h-24 w-full rounded-surface" />
      </div>

      <Skeleton className="hidden h-[32rem] w-full rounded-surface xl:block" />
    </div>
  );
}
