"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import type { PlacedItem } from "./day-plan";

/**
 * The day, drawn as one column of time.
 *
 * A meeting is a block at the height its clock time puts it; now is a line
 * across it; the space between blocks is the free time left.
 *
 * It shows the next few hours by default, with "Whole day" to see the rest
 *: fifteen hours at full height pushed everything
 * else on the page, on a phone the Today list too, a screen and a half down.
 * Habits are no longer chips here; they are logged in the Today list.
 *
 * Positions arrive as fractions from `day-plan`, so this file only turns
 * them into percentages.
 */

/** Tall enough that an hour is a real distance rather than a line of text. */
const HOUR_HEIGHT = 48;

export function DaySpine({
  hours,
  events,
  now,
  expanded,
  onToggle,
}: {
  hours: number[];
  events: PlacedItem[];
  /** Fraction down the spine, or null when now is outside these hours. */
  now: number | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const height = hours.length * HOUR_HEIGHT;
  const range =
    hours.length === 0
      ? "The day is done"
      : `${String(hours[0]).padStart(2, "0")}:00–${String(hours[hours.length - 1] + 1).padStart(2, "0")}:00`;

  return (
    <section
      aria-labelledby="your-day"
      className="overflow-hidden rounded-surface border bg-card"
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
        <div className="min-w-0">
          <h2 id="your-day" className="text-sm font-semibold text-foreground">
            Your day
          </h2>
          <p className="text-xs text-muted-foreground">{range}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="shrink-0 rounded-control px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground focus-ring"
        >
          {expanded ? "Next hours" : "Whole day"}
        </button>
      </div>

      <div className="flex px-4 pb-4">
        <div className="w-12 shrink-0 select-none" aria-hidden>
          {hours.map((hour) => (
            <div
              key={hour}
              style={{ height: HOUR_HEIGHT }}
              className="text-micro tabular-nums text-muted-foreground"
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        <div className="relative min-w-0 flex-1" style={{ height }}>
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {hours.map((hour) => (
              <div
                key={hour}
                style={{ height: HOUR_HEIGHT }}
                className="border-t border-border/60"
              />
            ))}
          </div>

          {events.map((event) => (
            <Link
              key={event.id}
              href="/admin/calendar"
              style={{
                top: `${event.top * 100}%`,
                height: `${event.height * 100}%`,
              }}
              className={cn(
                "absolute inset-x-0 flex flex-col justify-center overflow-hidden rounded-control border-l-[3px] px-2.5 py-0.5 transition-colors focus-ring",
                event.isNow
                  ? // The one thing happening right now earns the accent.
                    "border-l-primary bg-primary/15 text-foreground"
                  : event.isPast
                    ? "border-l-border bg-secondary/40 text-muted-foreground"
                    : "border-l-primary/60 bg-secondary text-foreground hover:bg-secondary/70",
              )}
            >
              <span className="truncate text-xs font-medium">
                {event.title}
              </span>
              {event.height > 0.12 && (
                <span className="truncate text-micro tabular-nums text-muted-foreground">
                  {event.isNow ? `Now · ${event.detail}` : event.detail}
                </span>
              )}
            </Link>
          ))}

          {/* Now, in the same colour as the calendar's now line. */}
          {now !== null && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 z-raised flex items-center"
              style={{ top: `${now * 100}%` }}
            >
              <span className="-ml-1 size-2 rounded-full bg-destructive" />
              <span className="h-0.5 flex-1 bg-destructive" />
            </div>
          )}

          {hours.length > 0 && events.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
              Nothing scheduled{expanded ? " today" : " in these hours"}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
