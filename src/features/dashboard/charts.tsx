"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import { areaPath, heatLevel, linePath, scalePoints } from "./chart-geometry";

/**
 * The dashboard's graphics.
 *
 * Hand-rolled SVG. Recharts costs this route about 180 kB and was just removed
 * from it; these are a few hundred bytes and they inherit the theme, which a
 * library's defaults do not.
 *
 * That last point is the constraint that shapes all of them: **colour comes
 * from `currentColor` or a theme token, never a literal.** A chart with a
 * hard-coded `#22c55e` looks correct on one of the fifty-two presets and wrong
 * on the other fifty-one, and does not move at all when the visitor switches
 * theme. So each component takes a Tailwind text colour class and paints
 * itself from it.
 */

/* ── Sparkline ───────────────────────────────────────────────────────────── */

/**
 * A small area chart.
 *
 * The gradient is what makes it read as a volume rather than a wire, and it is
 * built from `currentColor` at two opacities — so it takes the theme's accent
 * without ever naming a colour.
 */
export function Sparkline({
  values,
  className,
  height = 48,
  label,
}: {
  values: number[];
  /** A text colour class; the whole chart derives from it. */
  className?: string;
  height?: number;
  label: string;
}) {
  // Unique per instance: two sparklines on one page sharing a gradient id
  // means the second silently takes the first's colour.
  const gradientId = useId();
  const width = 240;

  const points = scalePoints(values, width, height);

  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-muted-foreground"
        style={{ height }}
      >
        Nothing recorded yet
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      // Stretches to its container but keeps a fixed height, so a row of these
      // lines up regardless of column width.
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      style={{ height }}
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>

      <path d={areaPath(points, height)} fill={`url(#${gradientId})`} />
      <path
        d={linePath(points)}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        // Without this the stroke is scaled by preserveAspectRatio="none" and
        // comes out thicker horizontally than vertically.
        vectorEffect="non-scaling-stroke"
      />

      {/* The endpoint, because "where is it now" is the question a sparkline
          is usually asked. */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={3}
        fill="currentColor"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ── Progress ring ───────────────────────────────────────────────────────── */

/* ── Heatmap ─────────────────────────────────────────────────────────────── */

/** Opacity per level. Four steps, because smaller differences are invisible. */
const LEVEL_OPACITY = [0.08, 0.35, 0.65, 1] as const;

export function Heatmap({
  cells,
  className,
  label,
}: {
  cells: { date: string; intensity: number }[];
  className?: string;
  label: string;
}) {
  return (
    <div
      // Column-major with seven rows: each row is a weekday, which is what
      // makes a pattern like "never at weekends" visible at a glance.
      className={cn(
        "grid grid-flow-col grid-rows-7 gap-1 text-primary",
        className,
      )}
      role="img"
      aria-label={label}
    >
      {cells.map((cell) => {
        const level = heatLevel(cell.intensity);
        return (
          <span
            key={cell.date}
            title={cell.date}
            className="aspect-square w-full rounded-[2px] bg-current"
            style={{ opacity: LEVEL_OPACITY[level] }}
          />
        );
      })}
    </div>
  );
}
