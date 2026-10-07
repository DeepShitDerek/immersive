"use client";

import { useMemo } from "react";
import { isToday } from "date-fns";
import { Clock } from "lucide-react";
import type { CalendarEntry, CalendarSettings } from "@/types";
import { cn } from "@/lib/cn";
import { freeMinutes } from "./free-minutes";

/**
 * How much unbooked time is actually left.
 *
 * Outlook's idea, and the one number that makes "yes, I can take that on" an
 * informed answer rather than a guess. Counted only over the visible hours and
 * only over days that have not already passed — free time in the past is not a
 * resource, and including it would make every Friday look wide open.
 *
 * All-day items are excluded. A task due today does not consume an afternoon;
 * a block you created for it does, and that is a different row.
 */
export function FreeTimeBar({
  days,
  entries,
  settings,
  className,
}: {
  days: Date[];
  entries: CalendarEntry[];
  settings: CalendarSettings;
  className?: string;
}) {
  const { free, total, upcomingDays } = useMemo(() => {
    const timed = entries.filter((entry) => !entry.isAllDay);
    const perDay = settings.day_end_hour - settings.day_start_hour;

    const today = new Date();
    const relevant = days.filter((day) => isToday(day) || day > today);

    const free = relevant.reduce(
      (sum, day) =>
        sum +
        freeMinutes({
          events: timed,
          day,
          startHour: settings.day_start_hour,
          endHour: settings.day_end_hour,
        }),
      0,
    );

    return {
      free,
      total: relevant.length * perDay * 60,
      upcomingDays: relevant.length,
    };
  }, [days, entries, settings]);

  // Nothing useful to say about a week that is entirely behind you.
  if (upcomingDays === 0 || total === 0) return null;

  const booked = total - free;
  const bookedShare = booked / total;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-surface border bg-card px-4 py-2.5",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-sm">
        <Clock className="size-4 text-muted-foreground" aria-hidden />
        <span className="font-semibold tabular-nums text-foreground">
          {formatHours(free)}
        </span>
        <span className="text-muted-foreground">
          free across {upcomingDays} day{upcomingDays === 1 ? "" : "s"}
        </span>
      </p>

      <div
        className="h-1.5 min-w-32 flex-1 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={Math.round(bookedShare * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Time booked"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-slow ease-enter",
            // Past about three-quarters booked, the remaining gaps are mostly
            // too fragmented to do anything with.
            bookedShare > 0.75
              ? "bg-warning"
              : bookedShare > 0.5
                ? "bg-success"
                : "bg-primary",
          )}
          style={{ width: `${Math.min(bookedShare * 100, 100)}%` }}
        />
      </div>

      <p className="text-xs tabular-nums text-muted-foreground">
        {formatHours(booked)} booked
      </p>
    </div>
  );
}

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  if (hours >= 10) return `${Math.round(hours)}h`;
  const whole = Math.floor(hours);
  const rest = Math.round(minutes % 60);
  if (whole === 0) return `${rest}m`;
  return rest === 0 ? `${whole}h` : `${whole}h ${rest}m`;
}
