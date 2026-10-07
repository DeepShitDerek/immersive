"use client";

import type { ReactNode } from "react";
import type { VisitorSlice } from "@/types";
import { cn } from "@/lib/cn";
import { formatShare, share } from "./analytics-display";

/**
 * A ranked breakdown, as a bar behind the label rather than beside it.
 *
 * Every one of these lists answers the same question — "which of these, and how
 * much" — so they get one component. The bar is a background fill on the row
 * itself: a separate bar column would force the labels into a narrow gutter,
 * and page paths and ISP names are the two things here most likely to be long.
 */
export function BreakdownList({
  title,
  slices,
  total,
  empty,
  renderLabel,
  className,
  bare = false,
}: {
  title: string;
  slices: VisitorSlice[];
  /** The denominator for the share. Passed in, since some lists are filtered. */
  total: number;
  empty: string;
  renderLabel?: (slice: VisitorSlice) => ReactNode;
  className?: string;
  /** Inside another card (the tabbed one on phones): no frame, heading for AT only. */
  bare?: boolean;
}) {
  return (
    <section
      className={cn(!bare && "rounded-surface border bg-card p-5", className)}
      aria-label={title}
    >
      <h2
        className={cn(
          bare ? "sr-only" : "mb-4 text-sm font-semibold text-foreground",
        )}
      >
        {title}
      </h2>

      {slices.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ol className="space-y-1">
          {slices.map((slice) => (
            <li key={slice.name} className="relative">
              {/*
                Behind the text, not around it: `bg-primary/10` keeps the label
                legible on every one of the 52 presets, where a solid fill would
                need its own foreground colour to stay readable.
              */}
              <div
                aria-hidden
                className="absolute inset-y-0 left-0 rounded-control bg-primary/10"
                style={{
                  width: `${Math.max(share(slice.value, total), 1.5)}%`,
                }}
              />
              <div className="relative flex items-center justify-between gap-4 px-2 py-1.5">
                {/* min-w-0 so the truncate on the label engages inside flex. */}
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {renderLabel ? renderLabel(slice) : slice.name}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {slice.value.toLocaleString()}
                </span>
                <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {formatShare(slice.value, total)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
