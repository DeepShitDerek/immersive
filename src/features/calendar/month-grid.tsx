"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, isSameMonth, isToday } from "date-fns";
import type { CalendarEntry } from "@/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import {
  atMinutes,
  dayKey,
  entriesByDay,
  layoutMonthWeek,
  timeLabel,
  weeksOf,
} from "./layout";
import {
  EntryDot,
  KindIcon,
  LineContent,
  entryAriaLabel,
  surfaceClasses,
} from "./entry-visual";
import type { CreateRange } from "./time-grid";

/** One line of a day: a 24px target and a 2px gap (WCAG 2.5.8). */
const LINE_PX = 26;
/** The day number's line at the top of a cell. */
const HEADER_PX = 30;
/** Used before the first measurement only; rows share whatever height there is. */
const ROW_START_PX = 112;
/** Below this width a timed entry shows its title only; the time is in its details. */
const TIME_MIN_WIDTH = 150;

/**
 * The month.
 *
 * On a wide screen each week row measures itself and shows only what fits:
 * multi-day and all-day entries as one bar across the days they cover, then
 * each day's timed entries, and "+n more" on the last line when there is
 * more. The rows share the height there is, so the month never scrolls,
 * and nothing is cut off at the bottom of a cell. On a phone a day is too
 * narrow for titles: it shows dots, and the chosen day is listed under the
 * grid by the page.
 */
export function MonthGrid({
  days,
  month,
  entries,
  compact,
  selectedDay,
  selectedId,
  onSelectDay,
  onSelect,
  onCreate,
  onPickDay,
}: {
  days: Date[];
  /** Any date in the month being shown, to grey the days around it. */
  month: Date;
  entries: CalendarEntry[];
  /** Phone layout: dots instead of titles. */
  compact: boolean;
  selectedDay: Date;
  selectedId: string | null;
  onSelectDay: (day: Date) => void;
  onSelect: (entry: CalendarEntry, anchor: DOMRect) => void;
  onCreate: (range: CreateRange, anchor: DOMRect) => void;
  onPickDay: (day: Date) => void;
}) {
  const weeks = weeksOf(days);
  const rowsRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ rowHeight: ROW_START_PX, cellWidth: 160 });

  useEffect(() => {
    const el = rowsRef.current;
    if (!el || compact) return;
    const measure = () => {
      const row = el.firstElementChild as HTMLElement | null;
      setSize({
        rowHeight: row?.getBoundingClientRect().height ?? ROW_START_PX,
        cellWidth: el.getBoundingClientRect().width / 7,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [compact, weeks.length]);

  const lines = Math.max(
    1,
    Math.floor((size.rowHeight - HEADER_PX - 2) / LINE_PX),
  );
  const showTime = size.cellWidth >= TIME_MIN_WIDTH;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-surface border bg-card">
      <div className="grid grid-cols-7 border-b">
        {weeks[0]?.map((day) => (
          <span
            key={dayKey(day)}
            className="py-1.5 text-center text-micro uppercase tracking-wide text-muted-foreground"
          >
            {format(day, compact ? "EEEEE" : "EEE")}
          </span>
        ))}
      </div>
      {compact ? (
        <CompactMonth
          weeks={weeks}
          month={month}
          entries={entries}
          selectedDay={selectedDay}
          onSelectDay={onSelectDay}
        />
      ) : (
        <div
          ref={rowsRef}
          className="grid min-h-0 flex-1 overflow-hidden"
          style={{
            gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))`,
          }}
        >
          {weeks.map((week) => (
            <WeekRow
              key={dayKey(week[0])}
              week={week}
              month={month}
              entries={entries}
              lines={lines}
              showTime={showTime}
              selectedId={selectedId}
              onSelect={onSelect}
              onCreate={onCreate}
              onPickDay={onPickDay}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WeekRow({
  week,
  month,
  entries,
  lines,
  showTime,
  selectedId,
  onSelect,
  onCreate,
  onPickDay,
}: {
  week: Date[];
  month: Date;
  entries: CalendarEntry[];
  lines: number;
  showTime: boolean;
  selectedId: string | null;
  onSelect: (entry: CalendarEntry, anchor: DOMRect) => void;
  onCreate: (range: CreateRange, anchor: DOMRect) => void;
  onPickDay: (day: Date) => void;
}) {
  const layout = useMemo(
    () => layoutMonthWeek(entries, week, lines),
    [entries, week, lines],
  );
  const byDay = useMemo(() => entriesByDay(entries, week), [entries, week]);
  const col = (i: number) => `${(i / 7) * 100}%`;
  const width = (span: number) => `calc(${(span / 7) * 100}% - 6px)`;

  return (
    <div className="relative grid grid-cols-7 border-b last:border-b-0">
      {week.map((day) => {
        const inMonth = isSameMonth(day, month);
        const today = isToday(day);
        const count = byDay.get(dayKey(day))?.length ?? 0;
        return (
          <div
            key={dayKey(day)}
            className={cn(
              "relative border-l first:border-l-0",
              !inMonth && "bg-secondary/30",
            )}
          >
            {/* Empty space in a day: an event at nine. */}
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              className="absolute inset-0 hover:bg-secondary/40"
              onClick={(event) =>
                onCreate(
                  {
                    start: atMinutes(day, 9 * 60),
                    end: atMinutes(day, 10 * 60),
                    allDay: false,
                  },
                  event.currentTarget.getBoundingClientRect(),
                )
              }
            />
            <div className="relative flex h-[30px] items-center justify-end px-1">
              <button
                type="button"
                onClick={() => onPickDay(day)}
                aria-label={`${format(day, "EEEE d MMMM")}${today ? ", today" : ""}, ${count} ${count === 1 ? "item" : "items"}. Open this day`}
                className="rounded-full focus-ring"
              >
                <DayNumber day={day} today={today} muted={!inMonth} />
              </button>
            </div>
          </div>
        );
      })}

      {/* Bars and entries, over the cells, in lines below the day numbers. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{ top: HEADER_PX }}
      >
        {layout.bars.map((bar) => (
          <button
            key={`${bar.entry.id}-${bar.startCol}`}
            type="button"
            data-entry
            onClick={(event) =>
              onSelect(bar.entry, event.currentTarget.getBoundingClientRect())
            }
            aria-label={entryAriaLabel(bar.entry)}
            className={cn(
              "pointer-events-auto absolute flex h-6 items-center overflow-hidden rounded-control text-xs focus-ring",
              surfaceClasses(bar.entry),
              bar.continuesBefore && "rounded-l-none",
              bar.continuesAfter && "rounded-r-none",
              selectedId === bar.entry.id && "ring-2 ring-primary",
            )}
            style={{
              top: bar.lane * LINE_PX,
              left: `calc(${col(bar.startCol)} + 3px)`,
              width: width(bar.span),
            }}
          >
            <LineContent entry={bar.entry} showTime={false} />
          </button>
        ))}

        {layout.days.map((d, i) => (
          <div key={dayKey(week[i])}>
            {d.timed.map(({ entry, line }) => (
              <button
                key={entry.id}
                type="button"
                data-entry
                onClick={(event) =>
                  onSelect(entry, event.currentTarget.getBoundingClientRect())
                }
                aria-label={entryAriaLabel(entry, week[i])}
                title={`${timeLabel(entry, week[i])} ${entry.title}`}
                className={cn(
                  "pointer-events-auto absolute flex h-6 items-center gap-1.5 overflow-hidden rounded-control px-1.5 text-left text-xs hover:bg-secondary focus-ring",
                  selectedId === entry.id &&
                    "bg-primary/10 ring-2 ring-primary",
                )}
                style={{
                  top: line * LINE_PX,
                  left: `calc(${col(i)} + 3px)`,
                  width: width(1),
                }}
              >
                <EntryDot entry={entry} />
                {showTime && (
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {timeLabel(entry, week[i])
                      .split("–")[0]
                      .replace(/^(From|Until) /, "")}
                  </span>
                )}
                <span className="truncate">{entry.title || "Untitled"}</span>
              </button>
            ))}
            {d.more > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="pointer-events-auto absolute h-6 rounded-control px-1.5 text-left text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground focus-ring"
                    style={{
                      top: d.moreLine * LINE_PX,
                      left: `calc(${col(i)} + 3px)`,
                      width: width(1),
                    }}
                    aria-label={`${d.more} more on ${format(week[i], "EEEE d MMMM")}`}
                  >
                    +{d.more} more
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-2">
                  <p className="mb-1.5 px-1 text-sm font-semibold">
                    {format(week[i], "EEEE d MMMM")}
                  </p>
                  <div className="space-y-0.5">
                    {(byDay.get(dayKey(week[i])) ?? []).map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={(event) =>
                          onSelect(
                            entry,
                            event.currentTarget.getBoundingClientRect(),
                          )
                        }
                        className="flex h-8 w-full min-w-0 items-center gap-1.5 rounded-control px-1.5 text-left text-sm hover:bg-secondary focus-ring"
                      >
                        <EntryDot entry={entry} />
                        <KindIcon
                          entry={entry}
                          className="text-muted-foreground"
                        />
                        <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">
                          {entry.kind === "event" && !entry.isAllDay
                            ? timeLabel(entry, week[i])
                                .split("–")[0]
                                .replace(/^(From|Until) /, "")
                            : "All day"}
                        </span>
                        <span className="truncate">
                          {entry.title || "Untitled"}
                        </span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The phone month: dots per day; the page lists the chosen day below. */
function CompactMonth({
  weeks,
  month,
  entries,
  selectedDay,
  onSelectDay,
}: {
  weeks: Date[][];
  month: Date;
  entries: CalendarEntry[];
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
}) {
  const byDay = useMemo(
    () => entriesByDay(entries, weeks.flat()),
    [entries, weeks],
  );
  const selectedKey = dayKey(selectedDay);
  return (
    <div
      className="grid"
      style={{ gridTemplateRows: `repeat(${weeks.length}, auto)` }}
    >
      {weeks.map((week) => (
        <div
          key={dayKey(week[0])}
          className="grid grid-cols-7 border-b last:border-b-0"
        >
          {week.map((day) => {
            const key = dayKey(day);
            const list = byDay.get(key) ?? [];
            const inMonth = isSameMonth(day, month);
            const today = isToday(day);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDay(day)}
                aria-label={`${format(day, "EEEE d MMMM")}${today ? ", today" : ""}, ${list.length} ${list.length === 1 ? "item" : "items"}`}
                aria-pressed={key === selectedKey}
                className={cn(
                  "flex min-h-14 flex-col items-center gap-1 border-l pt-1 first:border-l-0 focus-ring",
                  !inMonth && "bg-secondary/30",
                  key === selectedKey && "bg-primary/10",
                )}
              >
                <DayNumber day={day} today={today} muted={!inMonth} />
                <span className="flex flex-wrap justify-center gap-0.5 px-1">
                  {list.slice(0, 4).map((e) => (
                    <EntryDot key={e.id} entry={e} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function DayNumber({
  day,
  today,
  muted,
}: {
  day: Date;
  today: boolean;
  muted: boolean;
}) {
  return (
    <span
      className={cn(
        "flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
        today
          ? "bg-primary text-primary-foreground"
          : muted
            ? "text-muted-foreground"
            : "text-foreground",
      )}
    >
      {format(day, "d")}
    </span>
  );
}
