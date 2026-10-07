"use client";

import { useMemo } from "react";
import { format, isToday, isTomorrow } from "date-fns";
import { MapPin, Repeat, Video } from "lucide-react";
import type { CalendarEntry } from "@/types";
import { cn } from "@/lib/cn";
import { dayKey, entriesByDay, isAllDayLike, timeLabel } from "./layout";
import { KindIcon, entryAriaLabel } from "./entry-visual";
import { entryClasses, isExpected } from "./entry-style";

/**
 * Days as a list: the agenda view, and the chosen day under the phone month.
 * Days with nothing on them are skipped unless `showEmpty` (a single chosen
 * day still says it is free).
 */
export function AgendaList({
  days,
  entries,
  selectedId,
  showEmpty = false,
  emptyText = "Nothing on the calendar for these days.",
  onSelect,
}: {
  days: Date[];
  entries: CalendarEntry[];
  selectedId: string | null;
  showEmpty?: boolean;
  emptyText?: string;
  onSelect: (entry: CalendarEntry, anchor: DOMRect) => void;
}) {
  const byDay = useMemo(() => entriesByDay(entries, days), [entries, days]);
  const shown = days.filter(
    (d) => showEmpty || (byDay.get(dayKey(d))?.length ?? 0) > 0,
  );

  if (shown.length === 0) {
    return (
      <div className="rounded-surface border bg-card p-8 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <ol className="list-none space-y-4 p-0">
      {shown.map((day) => {
        const list = byDay.get(dayKey(day)) ?? [];
        const name = isToday(day)
          ? "Today"
          : isTomorrow(day)
            ? "Tomorrow"
            : format(day, "EEEE");
        return (
          <li key={dayKey(day)}>
            <h3 className="mb-1.5 flex items-baseline gap-2 px-1 text-sm">
              <span
                className={cn("font-semibold", isToday(day) && "text-primary")}
              >
                {name}
              </span>
              <span className="text-muted-foreground">
                {format(day, "d MMMM")}
              </span>
            </h3>
            {list.length === 0 ? (
              <p className="rounded-surface border bg-card px-4 py-3 text-sm text-muted-foreground">
                Nothing planned.
              </p>
            ) : (
              <ul className="list-none divide-y overflow-hidden rounded-surface border bg-card p-0">
                {list.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={(event) =>
                        onSelect(
                          entry,
                          event.currentTarget.getBoundingClientRect(),
                        )
                      }
                      aria-label={entryAriaLabel(entry, day)}
                      className={cn(
                        "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/40 focus-ring",
                        selectedId === entry.id && "bg-primary/10",
                      )}
                    >
                      <span className="w-[5.5rem] shrink-0 pt-px text-xs tabular-nums text-muted-foreground">
                        {isAllDayLike(entry)
                          ? "All day"
                          : timeLabel(entry, day)}
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1 h-3.5 w-1 shrink-0 rounded-full",
                          entryClasses(entry.colorToken).dot,
                          isExpected(entry) && "opacity-50",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <KindIcon
                            entry={entry}
                            className="text-muted-foreground"
                          />
                          <span className="truncate text-sm font-medium">
                            {entry.title || "Untitled"}
                          </span>
                          {entry.rrule && (
                            <Repeat
                              aria-hidden
                              className="size-3.5 shrink-0 text-muted-foreground"
                            />
                          )}
                        </span>
                        {(entry.location ||
                          entry.meetingUrl ||
                          isExpected(entry)) && (
                          <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                            {isExpected(entry) ? (
                              "Expected"
                            ) : (
                              <>
                                {entry.meetingUrl ? (
                                  <Video
                                    aria-hidden
                                    className="size-3.5 shrink-0"
                                  />
                                ) : (
                                  <MapPin
                                    aria-hidden
                                    className="size-3.5 shrink-0"
                                  />
                                )}
                                <span className="truncate">
                                  {entry.location || "Video call"}
                                </span>
                              </>
                            )}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
