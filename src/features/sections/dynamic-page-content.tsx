"use client";

import { AlertTriangle, FileQuestion } from "lucide-react";
import { useGetSectionsByPathQuery } from "@/store/api/publicApi";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import SectionRenderer from "./section-renderer";

function SectionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Skeleton className="h-7 w-56" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28 rounded-surface" />
        <Skeleton className="h-28 rounded-surface" />
      </div>
    </div>
  );
}

/**
 * All visible CMS sections for a page path, in display order.
 *
 * Changes from the previous version:
 *  - `isError` no longer collapses into the same silent `return null` as
 *    "no sections". A failed fetch now says so and offers a retry; an empty
 *    page says something different, and only in development.
 *  - The skeleton mirrors the real section shape (heading + rule + cards)
 *    instead of two generic blocks, so the page does not visibly jump on load.
 *  - Sections are keyed and ordered defensively; the API orders by
 *    display_order, but the seed contains deliberate order collisions and
 *    Array.prototype.sort being stable is what keeps them from swapping.
 */
export function DynamicPageContent({
  pagePath,
  startIndex = 0,
  className,
}: {
  pagePath: string;
  /** Offset for the "01 /" ordinals when the page has sections above these. */
  startIndex?: number;
  className?: string;
}) {
  const {
    data: sections,
    isLoading,
    isError,
    refetch,
  } = useGetSectionsByPathQuery(pagePath);

  if (isLoading) {
    return (
      <div className={cn("space-y-16", className)} aria-busy aria-live="polite">
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className={cn(
          "rounded-surface border border-dashed border-destructive/40 bg-destructive/5 px-6 py-10 text-center",
          className,
        )}
      >
        <AlertTriangle className="mx-auto mb-3 size-8 text-destructive/70" />
        <p className="font-heading font-semibold">
          This section didn&apos;t load
        </p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          The content for this page could not be fetched. Everything else on the
          site is unaffected.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (!sections?.length) {
    // A genuinely empty page is an authoring state, not a visitor-facing one.
    if (process.env.NODE_ENV === "production") return null;
    return (
      <div
        className={cn(
          "rounded-surface border border-dashed bg-muted/10 px-6 py-10 text-center",
          className,
        )}
      >
        <FileQuestion className="mx-auto mb-3 size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          No visible sections for{" "}
          <span className="font-medium text-foreground">{pagePath}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Check the page path and the section&apos;s visibility toggle.
          Development only.
        </p>
      </div>
    );
  }

  const ordered = [...sections].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
  );

  return (
    <div className={cn("space-y-16 sm:space-y-20", className)}>
      {ordered.map((section, index) => (
        <SectionRenderer
          key={section.id}
          section={section}
          index={startIndex + index}
        />
      ))}
    </div>
  );
}
