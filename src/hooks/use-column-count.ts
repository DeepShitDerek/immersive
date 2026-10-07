"use client";

import * as React from "react";

/**
 * Number of masonry columns at the current viewport width.
 *
 * Masonry has no pure-CSS form that also preserves reading order. CSS
 * multi-column packs tightly but fills a whole column before starting the next,
 * so a newest-first feed reads down the entire left column before reaching the
 * second item. CSS Grid reads correctly but leaves a gap under every card
 * shorter than the tallest one in its row. Getting both means distributing the
 * items into columns ourselves, which means knowing how many there are.
 *
 * The breakpoints mirror the Tailwind `sm` / `lg` defaults used by the
 * consuming layout. They are declared here so the two cannot drift apart
 * silently — if a caller changes its grid classes it must change these too.
 */
const BREAKPOINTS = [
  { minWidth: 1024, columns: 3 }, // lg
  { minWidth: 640, columns: 2 }, // sm
] as const;

function measure(): number {
  if (typeof window === "undefined") {
    return 1;
  }
  const match = BREAKPOINTS.find((bp) => window.innerWidth >= bp.minWidth);
  return match?.columns ?? 1;
}

export function useColumnCount(): number {
  // Not useState(measure): the first client render has to match the
  // prerendered single column, or hydration fails and React throws the
  // server HTML away. The effect below measures right after mount.
  const [columns, setColumns] = React.useState<number>(1);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const queries = BREAKPOINTS.map((bp) =>
      window.matchMedia(`(min-width: ${bp.minWidth}px)`),
    );
    const handleChange = () => setColumns(measure());

    // Re-measure on mount: SSR rendered the single-column fallback.
    handleChange();

    queries.forEach((q) => q.addEventListener("change", handleChange));
    return () =>
      queries.forEach((q) => q.removeEventListener("change", handleChange));
  }, []);

  return columns;
}

/**
 * Deal `items` into `columns` buckets round-robin.
 *
 * Round-robin, not chunking. Chunking (`[0,1,2]`, `[3,4,5]`, …) puts the three
 * newest items in the first column, so the feed reads top-to-bottom-then-across
 * again. Round-robin puts item 0 at the top of column 0, item 1 at the top of
 * column 1, and so on, so scanning across the top row gives the newest items in
 * order and each column stays chronological downward.
 *
 * Empty columns are preserved so the flex row keeps even widths when there are
 * fewer items than columns.
 */
export function distributeColumns<T>(items: T[], columns: number): T[][] {
  const count = Math.max(1, Math.floor(columns));
  const buckets: T[][] = Array.from({ length: count }, () => []);
  items.forEach((item, index) => {
    buckets[index % count].push(item);
  });
  return buckets;
}
