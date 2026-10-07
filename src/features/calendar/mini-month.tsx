"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { dayKey } from "./layout";

/**
 * A small month for jumping to a date, in the panel. The days on screen are
 * shaded; a dot marks a day with something on it (for the days the grid has
 * loaded). It pages on its own, so looking ahead does not move the grid.
 */
export function MiniMonth({
  anchor,
  visibleDays,
  busyDays,
  weekStartsOn,
  onPick,
}: {
  anchor: Date;
  visibleDays: Date[];
  busyDays: ReadonlySet<string>;
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  onPick: (day: Date) => void;
}) {
  const [month, setMonth] = useState(() => startOfMonth(anchor));
  // Follow the grid when it moves to another month.
  useEffect(() => setMonth(startOfMonth(anchor)), [anchor]);

  const days = useMemo(() => {
    const first = startOfWeek(startOfMonth(month), { weekStartsOn });
    const last = endOfMonth(month);
    const out: Date[] = [];
    for (let d = first; d <= last || out.length % 7 !== 0; d = addDays(d, 1))
      out.push(d);
    return out;
  }, [month, weekStartsOn]);
  const visible = new Set(visibleDays.map(dayKey));

  return (
    <section aria-label="Jump to a date" className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{format(month, "MMMM yyyy")}</p>
        <div className="flex">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Previous month"
            onClick={() => setMonth((m) => addMonths(m, -1))}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Next month"
            onClick={() => setMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center">
        {days.slice(0, 7).map((d) => (
          <span
            key={`h-${dayKey(d)}`}
            className="py-0.5 text-micro text-muted-foreground"
          >
            {format(d, "EEEEE")}
          </span>
        ))}
        {days.map((d) => {
          const key = dayKey(d);
          const inView = visible.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(d)}
              aria-label={`${format(d, "EEEE d MMMM")}${busyDays.has(key) ? ", has events" : ""}`}
              aria-current={isSameDay(d, anchor) ? "date" : undefined}
              className={cn(
                "relative mx-auto flex size-8 flex-col items-center justify-center rounded-full text-xs tabular-nums focus-ring",
                !isSameMonth(d, month) && "text-muted-foreground",
                inView && "bg-secondary",
                isToday(d) &&
                  "bg-primary font-semibold text-primary-foreground",
                !isToday(d) && "hover:bg-secondary/70",
              )}
            >
              {format(d, "d")}
              {busyDays.has(key) && !isToday(d) && (
                <span
                  aria-hidden
                  className="absolute bottom-1 size-1 rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
