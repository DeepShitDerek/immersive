"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { formatMoney, money } from "../domain/money";

export interface LinePoint {
  date: string;
  valueMinor: number;
}

const H = 180;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

/**
 * One series over time: a 2px line in the accent colour on a quiet
 * grid, a dashed zero line when the series crosses it, and a crosshair with
 * the value on hover or arrow keys. The caller supplies the table view.
 *
 * Values are money in `currency` unless `format` says otherwise. A money
 * series is drawn from zero, so its height means something; a series whose
 * movement is small against its size (an exchange rate) sets `fromZero` to
 * false and fills the height with its own range.
 */
export function LineChart({
  points,
  currency,
  label,
  markers = [],
  format,
  fromZero = true,
  className,
}: {
  points: readonly LinePoint[];
  currency: string;
  /** Names the chart for screen readers. */
  label: string;
  /** Dates to mark along the line (e.g. the lowest point). */
  markers?: readonly string[];
  /** How to write a value; money in `currency` when absent. */
  format?: (value: number) => string;
  fromZero?: boolean;
  className?: string;
}) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  if (points.length < 2) return null;

  const values = points.map((p) => p.valueMinor);
  let min = fromZero ? Math.min(...values, 0) : Math.min(...values);
  let max = fromZero ? Math.max(...values, 0) : Math.max(...values);
  if (min === max) max = min + (fromZero ? 100 : Math.abs(min) * 0.01 || 1);
  const span = max - min;
  min -= span * 0.05;
  max += span * 0.05;
  const W = 600;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) =>
    PAD_TOP + (1 - (v - min) / (max - min)) * (H - PAD_TOP - PAD_BOTTOM);
  const path = points
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.valueMinor).toFixed(1)}`,
    )
    .join("");
  const crossesZero = fromZero && Math.min(...values) < 0;
  const fmt = format ?? ((v: number) => formatMoney(money(v, currency)));
  // Gridlines at the real highest and lowest values, labelled with them.
  const high = Math.max(...values);
  const low = Math.min(...values);
  // A scale that includes zero labels it too.
  const ticks = [...new Set(fromZero ? [high, low, 0] : [high, low])];

  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - box.left) / box.width),
    );
    setActive(Math.round(ratio * (points.length - 1)));
  };
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    )
      return;
    event.preventDefault();
    const last = points.length - 1;
    setActive((current) => {
      const at = current ?? last;
      if (event.key === "Home") return 0;
      if (event.key === "End") return last;
      return Math.min(
        last,
        Math.max(0, at + (event.key === "ArrowRight" ? 1 : -1)),
      );
    });
  };
  const point = active !== null ? points[active] : null;
  const leftPct = active !== null ? (active / (points.length - 1)) * 100 : 0;

  return (
    <figure className={cn("relative", className)}>
      <div
        role="img"
        aria-label={`${label}. From ${fmt(values[0])} on ${points[0].date} to ${fmt(values[values.length - 1])} on ${points[points.length - 1].date}; lowest ${fmt(Math.min(...values))}.`}
        aria-describedby={point ? `${id}-tip` : undefined}
        tabIndex={0}
        onPointerMove={pick}
        onPointerLeave={() => setActive(null)}
        onKeyDown={keys}
        onBlur={() => setActive(null)}
        className="relative touch-none rounded-control focus-ring"
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block h-44 w-full overflow-visible"
          aria-hidden
        >
          {ticks.map((t) => (
            <line
              key={t}
              x1={0}
              x2={W}
              y1={y(t)}
              y2={y(t)}
              className="stroke-border"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {crossesZero && (
            <line
              x1={0}
              x2={W}
              y1={y(0)}
              y2={y(0)}
              className="stroke-muted-foreground"
              strokeDasharray="4 4"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path
            d={path}
            fill="none"
            className="stroke-primary"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {active !== null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD_TOP}
              y2={H - PAD_BOTTOM}
              className="stroke-muted-foreground"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {/* Round markers in HTML, so the stretched SVG never makes them ovals. */}
        {[
          ...markers
            .map((d) => points.findIndex((p) => p.date === d))
            .filter((i) => i >= 0),
          ...(active !== null ? [active] : []),
        ].map((i, k) => (
          <span
            key={`${i}-${k}`}
            aria-hidden
            className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary"
            style={{
              left: `${(i / (points.length - 1)) * 100}%`,
              top: `${(y(points[i].valueMinor) / H) * 100}%`,
            }}
          />
        ))}
        {ticks.map((t) => (
          <span
            key={`label-${t}`}
            aria-hidden
            className="pointer-events-none absolute right-0 -translate-y-full bg-card/80 pb-0.5 pl-1 text-[11px] tabular-nums text-muted-foreground"
            style={{ top: `${(y(t) / H) * 100}%` }}
          >
            {fmt(t)}
          </span>
        ))}
        {point && (
          <div
            id={`${id}-tip`}
            role="status"
            className="pointer-events-none absolute top-0 z-raised -translate-x-1/2 whitespace-nowrap rounded-control border bg-popover px-2 py-1 text-xs shadow-sm"
            style={{ left: `${Math.min(88, Math.max(12, leftPct))}%` }}
          >
            <span className="text-muted-foreground">{point.date}</span>{" "}
            <span className="font-semibold tabular-nums">
              {fmt(point.valueMinor)}
            </span>
          </div>
        )}
      </div>
      <div
        className="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground"
        aria-hidden
      >
        <span>{points[0].date}</span>
        <span>{points[points.length - 1].date}</span>
      </div>
    </figure>
  );
}
