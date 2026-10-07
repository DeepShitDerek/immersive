"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { VisitorAnalytics } from "@/types";
import { Button } from "@/components/ui/button";
import { fillDailySeries } from "./analytics-display";

/**
 * Views and visitors over the selected range.
 *
 * Two series rather than one: views alone cannot tell heavy traffic from one
 * person refreshing, and the gap between the lines is itself the interesting
 * number. Visitors sit on top with the stronger fill because that is the one
 * being asked about — views are the context.
 *
 * Recharts is already in the shared admin chunk (dashboard, finance), so this
 * adds no new dependency weight to the route.
 */
export function TrafficChart({
  data,
  days,
  showVisitors,
}: {
  data: VisitorAnalytics;
  days: number;
  /** Hidden when no hash could be derived, so the axis is not a flat zero. */
  showVisitors: boolean;
}) {
  const series = useMemo(
    () => fillDailySeries(data.by_day, days),
    [data.by_day, days],
  );

  // A year of daily ticks is unreadable; label roughly six points whatever the
  // range, and let the tooltip carry the exact date.
  const tickInterval = Math.max(Math.floor(series.length / 6), 0);
  // The same numbers as a table: a chart is the only way in for
  // nobody, and the exact count for a given day is a reasonable question.
  const [asTable, setAsTable] = useState(false);

  return (
    <section
      className="rounded-surface border bg-card p-5"
      aria-label="Traffic over time"
    >
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-sm font-semibold text-foreground">Traffic</h2>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {showVisitors && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-primary" />
              Visitors
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-chart-2" />
            Views
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto"
          aria-pressed={asTable}
          onClick={() => setAsTable((on) => !on)}
        >
          {asTable ? "Show chart" : "Show table"}
        </Button>
      </div>

      {asTable ? (
        <div className="max-h-72 overflow-y-auto rounded-control border">
          <table className="w-full text-sm">
            <caption className="sr-only">Views and visitors per day</caption>
            <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="px-3 py-2 font-medium">
                  Day
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Views
                </th>
                {showVisitors && (
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Visitors
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...series].reverse().map((point) => (
                <tr key={point.day}>
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    {format(parseISO(point.day), "EEE d MMM yyyy")}
                  </th>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {point.views.toLocaleString()}
                  </td>
                  {showVisitors && (
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {point.visitors.toLocaleString()}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={series}
              margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
            >
              <defs>
                <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="hsl(var(--chart-2))"
                    stopOpacity={0.28}
                  />
                  <stop
                    offset="100%"
                    stopColor="hsl(var(--chart-2))"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="visitorsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="100%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                vertical={false}
                stroke="hsl(var(--border))"
                strokeDasharray="0"
                opacity={0.5}
              />
              <XAxis
                dataKey="day"
                interval={tickInterval}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(value: string) =>
                  format(parseISO(value), "d MMM")
                }
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={44}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                // Tokens, not literals, so the tooltip follows the active preset
                // rather than staying light on the 26 dark ones.
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--r-control)",
                  color: "hsl(var(--popover-foreground))",
                  fontSize: 12,
                }}
                labelFormatter={(value: string) =>
                  format(parseISO(value), "EEEE d MMMM")
                }
              />

              <Area
                type="monotone"
                dataKey="views"
                name="Views"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                fill="url(#viewsFill)"
              />
              {showVisitors && (
                <Area
                  type="monotone"
                  dataKey="visitors"
                  name="Visitors"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#visitorsFill)"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
