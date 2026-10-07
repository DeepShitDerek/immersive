"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, isToday } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { CalendarEntry } from "@/types";
import { cn } from "@/lib/cn";
import {
  MIN_BLOCK_MINUTES,
  MINUTES_PER_DAY,
  atMinutes,
  dayKey,
  entriesByDay,
  isAllDayLike,
  layoutAllDay,
  layoutDay,
  minutesOfDay,
  segmentsForDay,
  snapMinutes,
} from "./layout";
import {
  BlockContent,
  LineContent,
  entryAriaLabel,
  surfaceClasses,
} from "./entry-visual";

export interface CreateRange {
  start: Date;
  end: Date;
  allDay: boolean;
}

export interface TimeGridProps {
  days: Date[];
  entries: CalendarEntry[];
  hourHeight: number;
  /** Scrolled to on first draw: the start of the working day, or now. */
  scrollToHour: number;
  selectedId: string | null;
  /** A pending new event, drawn as a placeholder while it is being named. */
  draft: CreateRange | null;
  onSelect: (entry: CalendarEntry, anchor: DOMRect) => void;
  onEdit: (entry: CalendarEntry) => void;
  onCreate: (range: CreateRange, anchor: DOMRect) => void;
  onMove: (entry: CalendarEntry, start: Date, end: Date) => void;
  onDropTask: (taskId: string, start: Date) => void;
  onPickDay: (day: Date) => void;
}

const TASK_TYPE = "application/x-task-id";
const DRAG_THRESHOLD_PX = 4;
const LANE_PX = 26;
const MAX_LANES = 3;

type Drag =
  | {
      mode: "create";
      dayIdx: number;
      anchorMin: number;
      curMin: number;
      moved: boolean;
    }
  | {
      mode: "move";
      entry: CalendarEntry;
      grabOffset: number;
      duration: number;
      dayIdx: number;
      startMin: number;
      moved: boolean;
      x: number;
      y: number;
    }
  | {
      mode: "resize";
      entry: CalendarEntry;
      dayIdx: number;
      startMin: number;
      endMin: number;
    };

/**
 * Day, three days and week: an all-day row over a 24-hour time grid.
 *
 * The whole day scrolls, rather than only the owner's working hours: an
 * early flight or a late call is still on the calendar. It opens scrolled to
 * the working day (or to now, for today).
 *
 * Pointer gestures are for a mouse or a pen: press and drag on empty time to
 * make an event, drag a block to move it, drag its bottom edge to change its
 * length. With a finger, a tap opens or creates and a drag scrolls, because a
 * calendar that grabs the finger cannot be scrolled.
 */
export function TimeGrid({
  days,
  entries,
  hourHeight,
  scrollToHour,
  selectedId,
  draft,
  onSelect,
  onEdit,
  onCreate,
  onMove,
  onDropTask,
  onPickDay,
}: TimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;
  /** Swallows the click that ends a drag, so it does not also select. */
  const justDragged = useRef(false);
  const [dropAt, setDropAt] = useState<{ dayIdx: number; min: number } | null>(
    null,
  );
  const [showAllLanes, setShowAllLanes] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Scroll once, to the start of the day, or an hour before now if today is on screen.
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current || !scrollRef.current) return;
    scrolled.current = true;
    const hasToday = days.some((d) => isToday(d));
    const hour = hasToday ? Math.max(0, now.getHours() - 1) : scrollToHour;
    scrollRef.current.scrollTop = Math.max(0, hour * hourHeight - 8);
  }, [days, hourHeight, now, scrollToHour]);

  const pxPerMin = hourHeight / 60;
  const totalPx = 24 * hourHeight;

  const placedByDay = useMemo(
    () => days.map((day) => layoutDay(segmentsForDay(entries, day))),
    [days, entries],
  );
  const allDayBars = useMemo(
    () => layoutAllDay(entries, days),
    [entries, days],
  );
  const laneCount = allDayBars.reduce((m, b) => Math.max(m, b.lane + 1), 0);
  const hiddenByDay = useMemo(() => {
    if (showAllLanes || laneCount <= MAX_LANES)
      return new Map<string, number>();
    const byDay = entriesByDay(entries.filter(isAllDayLike), days);
    const visibleIds = new Set(
      allDayBars.filter((b) => b.lane < MAX_LANES - 1).map((b) => b.entry.id),
    );
    return new Map(
      [...byDay].map(([k, list]) => [
        k,
        list.filter((e) => !visibleIds.has(e.id)).length,
      ]),
    );
  }, [showAllLanes, laneCount, entries, days, allDayBars]);
  const lanesShown =
    showAllLanes || laneCount <= MAX_LANES ? laneCount : MAX_LANES - 1;

  /** The day column and wall-clock minute under a point. */
  const slotAt = (clientX: number, clientY: number) => {
    const el = columnsRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const colWidth = rect.width / days.length;
    const dayIdx = Math.min(
      days.length - 1,
      Math.max(0, Math.floor((clientX - rect.left) / colWidth)),
    );
    const min = Math.max(
      0,
      Math.min(MINUTES_PER_DAY, (clientY - rect.top) / pxPerMin),
    );
    return { dayIdx, min };
  };

  const anchorRect = (dayIdx: number, startMin: number, endMin: number) => {
    const el = columnsRef.current!;
    const rect = el.getBoundingClientRect();
    const colWidth = rect.width / days.length;
    return new DOMRect(
      rect.left + dayIdx * colWidth,
      rect.top + startMin * pxPerMin,
      colWidth,
      Math.max(MIN_BLOCK_MINUTES, endMin - startMin) * pxPerMin,
    );
  };

  /* Empty time: press and drag to choose a range; a click makes an hour. */
  const onColumnsPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-entry]")) return;
    const slot = slotAt(event.clientX, event.clientY);
    if (!slot) return;
    if (event.pointerType === "touch") {
      // A tap is handled on pointerup; a drag scrolls (and cancels this).
      setDrag({
        mode: "create",
        dayIdx: slot.dayIdx,
        anchorMin: slot.min,
        curMin: slot.min,
        moved: false,
      });
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      mode: "create",
      dayIdx: slot.dayIdx,
      anchorMin: slot.min,
      curMin: slot.min,
      moved: false,
    });
  };

  const onBlockPointerDown = (
    event: React.PointerEvent,
    entry: CalendarEntry,
    dayIdx: number,
    startMin: number,
    endMin: number,
  ) => {
    if (event.button !== 0 || event.pointerType === "touch") return;
    if (entry.kind !== "event") return;
    const slot = slotAt(event.clientX, event.clientY);
    if (!slot) return;
    // Not captured yet: a capture here would send the click that ends a
    // plain press to the grid instead of the event, and it would never open.
    // The pointer is captured once it has moved far enough to be a drag.
    setDrag({
      mode: "move",
      entry,
      grabOffset: slot.min - startMin,
      duration: endMin - startMin,
      dayIdx,
      startMin,
      moved: false,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const onResizePointerDown = (
    event: React.PointerEvent,
    entry: CalendarEntry,
    dayIdx: number,
    startMin: number,
    endMin: number,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    columnsRef.current?.setPointerCapture(event.pointerId);
    setDrag({ mode: "resize", entry, dayIdx, startMin, endMin });
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const current = dragRef.current;
    if (!current || event.pointerType === "touch") return;
    const slot = slotAt(event.clientX, event.clientY);
    if (!slot) return;
    if (current.mode === "create") {
      setDrag({
        ...current,
        curMin: slot.min,
        moved:
          current.moved ||
          Math.abs(slot.min - current.anchorMin) * pxPerMin > DRAG_THRESHOLD_PX,
      });
    } else if (current.mode === "move") {
      const moved =
        current.moved ||
        Math.hypot(event.clientX - current.x, event.clientY - current.y) >
          DRAG_THRESHOLD_PX;
      if (!moved) return;
      if (!current.moved)
        columnsRef.current?.setPointerCapture(event.pointerId);
      const startMin = snapMinutes(slot.min - current.grabOffset);
      setDrag({
        ...current,
        moved: true,
        dayIdx: slot.dayIdx,
        startMin: Math.min(startMin, MINUTES_PER_DAY - 15),
      });
    } else {
      setDrag({
        ...current,
        endMin: Math.max(current.startMin + 15, snapMinutes(slot.min)),
      });
    }
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const current = dragRef.current;
    setDrag(null);
    if (!current) return;
    if (current.mode === "create") {
      let start: number;
      let end: number;
      if (!current.moved) {
        // A click: an hour from the half hour under the pointer.
        start = Math.floor(current.anchorMin / 30) * 30;
        end = Math.min(MINUTES_PER_DAY, start + 60);
      } else {
        start = snapMinutes(Math.min(current.anchorMin, current.curMin));
        end = snapMinutes(Math.max(current.anchorMin, current.curMin));
        if (end - start < 15) end = start + 15;
      }
      if (event.pointerType === "touch") {
        const slot = slotAt(event.clientX, event.clientY);
        if (!slot || slot.dayIdx !== current.dayIdx) return;
      }
      const day = days[current.dayIdx];
      onCreate(
        {
          start: atMinutes(day, start),
          end: atMinutes(day, end),
          allDay: false,
        },
        anchorRect(current.dayIdx, start, end),
      );
      return;
    }
    if (current.mode === "move") {
      if (!current.moved) return; // a click; the button's onClick selects
      justDragged.current = true;
      window.setTimeout(() => (justDragged.current = false), 0);
      const day = days[current.dayIdx];
      const start = atMinutes(day, current.startMin);
      onMove(
        current.entry,
        start,
        new Date(start.getTime() + current.duration * 60_000),
      );
      return;
    }
    justDragged.current = true;
    window.setTimeout(() => (justDragged.current = false), 0);
    const day = days[current.dayIdx];
    onMove(
      current.entry,
      atMinutes(day, current.startMin),
      atMinutes(day, current.endMin),
    );
  };

  /* Tasks dragged in from the panel. */
  const onDragOver = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes(TASK_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const slot = slotAt(event.clientX, event.clientY);
    if (slot)
      setDropAt({ dayIdx: slot.dayIdx, min: Math.floor(slot.min / 15) * 15 });
  };
  const onDrop = (event: React.DragEvent) => {
    const taskId = event.dataTransfer.getData(TASK_TYPE);
    setDropAt(null);
    const slot = slotAt(event.clientX, event.clientY);
    if (!taskId || !slot) return;
    event.preventDefault();
    onDropTask(
      taskId,
      atMinutes(days[slot.dayIdx], Math.floor(slot.min / 15) * 15),
    );
  };

  const gridCols = {
    gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-surface border bg-card">
      {/* Day headings */}
      <div className="flex border-b">
        <div className="w-14 shrink-0" aria-hidden />
        <div className="grid flex-1" style={gridCols}>
          {days.map((day) => {
            const today = isToday(day);
            return (
              <button
                key={dayKey(day)}
                type="button"
                onClick={() => onPickDay(day)}
                className="flex flex-col items-center gap-0.5 border-l py-1.5 text-center first:border-l-0 hover:bg-secondary/50 focus-ring"
                aria-label={`${format(day, "EEEE d MMMM")}${today ? ", today" : ""}. Open this day`}
              >
                <span
                  className={cn(
                    "text-micro uppercase tracking-wide",
                    today ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {format(day, "EEE")}
                </span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                    today
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* All-day row: all-day events and the overlays (tasks, habits, money). */}
      <div className="flex border-b">
        <div className="flex w-14 shrink-0 flex-col items-end justify-start gap-1 px-1.5 py-1">
          <span className="text-micro text-muted-foreground">All day</span>
          {laneCount > MAX_LANES && (
            <button
              type="button"
              onClick={() => setShowAllLanes((v) => !v)}
              className="rounded-control p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus-ring"
              aria-label={
                showAllLanes
                  ? "Show fewer all-day items"
                  : "Show every all-day item"
              }
              aria-expanded={showAllLanes}
            >
              {showAllLanes ? (
                <ChevronUp className="size-4" aria-hidden />
              ) : (
                <ChevronDown className="size-4" aria-hidden />
              )}
            </button>
          )}
        </div>
        <div
          className="relative flex-1"
          style={{
            height:
              Math.max(1, lanesShown + (hiddenByDay.size ? 1 : 0)) * LANE_PX +
              6,
          }}
        >
          {/* Empty day cells: a click adds an all-day event. */}
          <div className="absolute inset-0 grid" style={gridCols}>
            {days.map((day) => (
              <button
                key={dayKey(day)}
                type="button"
                tabIndex={-1}
                aria-hidden
                className="border-l first:border-l-0 hover:bg-secondary/40"
                onClick={(event) => {
                  const next = new Date(day);
                  next.setDate(next.getDate() + 1);
                  onCreate(
                    { start: new Date(day), end: next, allDay: true },
                    (
                      event.currentTarget as HTMLElement
                    ).getBoundingClientRect(),
                  );
                }}
              />
            ))}
          </div>
          {allDayBars
            .filter((bar) => bar.lane < lanesShown)
            .map((bar) => (
              <button
                key={`${bar.entry.id}-${bar.startCol}`}
                type="button"
                data-entry
                onClick={(event) =>
                  onSelect(
                    bar.entry,
                    event.currentTarget.getBoundingClientRect(),
                  )
                }
                onDoubleClick={() =>
                  bar.entry.kind === "event" && onEdit(bar.entry)
                }
                aria-label={entryAriaLabel(bar.entry)}
                className={cn(
                  "absolute flex h-6 items-center overflow-hidden rounded-control text-xs focus-ring",
                  surfaceClasses(bar.entry),
                  bar.continuesBefore && "rounded-l-none",
                  bar.continuesAfter && "rounded-r-none",
                  selectedId === bar.entry.id && "ring-2 ring-primary",
                )}
                style={{
                  top: 3 + bar.lane * LANE_PX,
                  left: `calc(${(bar.startCol / days.length) * 100}% + 2px)`,
                  width: `calc(${(bar.span / days.length) * 100}% - 4px)`,
                }}
              >
                <LineContent entry={bar.entry} showTime={false} />
              </button>
            ))}
          {[...hiddenByDay].map(([key, count]) => {
            const idx = days.findIndex((d) => dayKey(d) === key);
            if (count === 0 || idx === -1) return null;
            return (
              <button
                key={`more-${key}`}
                type="button"
                onClick={() => setShowAllLanes(true)}
                className="absolute h-6 rounded-control px-1.5 text-left text-micro font-medium text-muted-foreground hover:bg-secondary focus-ring"
                style={{
                  top: 3 + lanesShown * LANE_PX,
                  left: `calc(${(idx / days.length) * 100}% + 2px)`,
                  width: `calc(${(1 / days.length) * 100}% - 4px)`,
                }}
              >
                +{count} more
              </button>
            );
          })}
        </div>
      </div>

      {/* The 24-hour grid */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="flex" style={{ height: totalPx }}>
          <div className="relative w-14 shrink-0" aria-hidden>
            {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-micro tabular-nums text-muted-foreground"
                style={{ top: h * hourHeight }}
              >
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>

          <div
            ref={columnsRef}
            className="relative grid flex-1 touch-pan-y select-none"
            style={gridCols}
            onPointerDown={onColumnsPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => setDrag(null)}
            onDragOver={onDragOver}
            onDragLeave={() => setDropAt(null)}
            onDrop={onDrop}
          >
            {/* Hour and half-hour lines */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: `linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.45) 1px, transparent 1px)`,
                backgroundSize: `100% ${hourHeight}px, 100% ${hourHeight}px`,
                backgroundPosition: `0 0, 0 ${hourHeight / 2}px`,
              }}
            />

            {days.map((day, dayIdx) => {
              const today = isToday(day);
              return (
                <div
                  key={dayKey(day)}
                  className={cn(
                    "relative border-l first:border-l-0",
                    today && "bg-primary/[0.03]",
                  )}
                >
                  {placedByDay[dayIdx].map((p) => {
                    const moving =
                      drag &&
                      (drag.mode === "move" || drag.mode === "resize") &&
                      drag.entry.id === p.entry.id &&
                      (drag.mode === "resize" || drag.moved);
                    const top = p.startMin * pxPerMin;
                    const height =
                      Math.max(MIN_BLOCK_MINUTES, p.endMin - p.startMin) *
                      pxPerMin;
                    const draggable =
                      p.entry.kind === "event" &&
                      !p.continuesBefore &&
                      !p.continuesAfter;
                    return (
                      <button
                        key={p.entry.id}
                        type="button"
                        data-entry
                        aria-label={entryAriaLabel(p.entry, day)}
                        onPointerDown={(event) =>
                          draggable &&
                          onBlockPointerDown(
                            event,
                            p.entry,
                            dayIdx,
                            p.startMin,
                            p.endMin,
                          )
                        }
                        onClick={(event) => {
                          if (justDragged.current) return;
                          onSelect(
                            p.entry,
                            event.currentTarget.getBoundingClientRect(),
                          );
                        }}
                        onDoubleClick={() =>
                          p.entry.kind === "event" && onEdit(p.entry)
                        }
                        className={cn(
                          // Opaque card under the translucent colour, so hour
                          // lines never show through an event.
                          "group absolute overflow-hidden rounded-control bg-card text-left focus-ring",
                          draggable && "cursor-grab active:cursor-grabbing",
                          p.continuesBefore && "rounded-t-none",
                          p.continuesAfter && "rounded-b-none",
                          selectedId === p.entry.id &&
                            "z-raised ring-2 ring-primary",
                          moving && "opacity-40",
                        )}
                        style={{
                          top: top + 1,
                          height: height - 2,
                          left: `calc(${(p.col / p.cols) * 100}% + 1px)`,
                          width: `calc(${(p.span / p.cols) * 100}% - 3px)`,
                        }}
                      >
                        <span
                          className={cn(
                            "absolute inset-0 rounded-[inherit]",
                            surfaceClasses(p.entry),
                          )}
                        >
                          <BlockContent
                            entry={p.entry}
                            heightPx={height}
                            day={day}
                          />
                        </span>
                        {draggable && (
                          <span
                            aria-hidden
                            onPointerDown={(event) =>
                              onResizePointerDown(
                                event,
                                p.entry,
                                dayIdx,
                                p.startMin,
                                p.endMin,
                              )
                            }
                            className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 [@media(pointer:coarse)]:hidden"
                          >
                            <span className="mx-auto mt-0.5 block h-0.5 w-6 rounded-full bg-foreground/40" />
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {/* Now */}
                  {today && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 z-raised"
                      style={{ top: minutesOfDay(now) * pxPerMin }}
                    >
                      <div className="relative h-0.5 bg-destructive">
                        <span className="absolute -left-1 -top-[3px] size-2 rounded-full bg-destructive" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* What a gesture would make, before it is made */}
            {drag?.mode === "create" && (drag.moved || false) && (
              <Ghost
                days={days.length}
                dayIdx={drag.dayIdx}
                startMin={snapMinutes(Math.min(drag.anchorMin, drag.curMin))}
                endMin={Math.max(
                  snapMinutes(Math.max(drag.anchorMin, drag.curMin)),
                  snapMinutes(Math.min(drag.anchorMin, drag.curMin)) + 15,
                )}
                pxPerMin={pxPerMin}
                label="New event"
              />
            )}
            {drag?.mode === "move" && drag.moved && (
              <Ghost
                days={days.length}
                dayIdx={drag.dayIdx}
                startMin={drag.startMin}
                endMin={drag.startMin + drag.duration}
                pxPerMin={pxPerMin}
                label={drag.entry.title}
              />
            )}
            {drag?.mode === "resize" && (
              <Ghost
                days={days.length}
                dayIdx={drag.dayIdx}
                startMin={drag.startMin}
                endMin={drag.endMin}
                pxPerMin={pxPerMin}
                label={drag.entry.title}
              />
            )}
            {draft &&
              !draft.allDay &&
              !drag &&
              (() => {
                const idx = days.findIndex(
                  (d) => dayKey(d) === dayKey(draft.start),
                );
                if (idx === -1) return null;
                return (
                  <Ghost
                    days={days.length}
                    dayIdx={idx}
                    startMin={minutesOfDay(draft.start)}
                    endMin={
                      draft.end.getDate() !== draft.start.getDate()
                        ? MINUTES_PER_DAY
                        : minutesOfDay(draft.end)
                    }
                    pxPerMin={pxPerMin}
                    label="New event"
                  />
                );
              })()}
            {dropAt && (
              <div
                aria-hidden
                className="pointer-events-none absolute z-raised h-0.5 bg-primary"
                style={{
                  top: dropAt.min * pxPerMin,
                  left: `${(dropAt.dayIdx / days.length) * 100}%`,
                  width: `${100 / days.length}%`,
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The placeholder for a range being made, moved or resized. */
function Ghost({
  days,
  dayIdx,
  startMin,
  endMin,
  pxPerMin,
  label,
}: {
  days: number;
  dayIdx: number;
  startMin: number;
  endMin: number;
  pxPerMin: number;
  label: string;
}) {
  const fmt = (m: number) =>
    `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-raised overflow-hidden rounded-control border-2 border-primary bg-primary/15 px-1.5 py-1"
      style={{
        top: startMin * pxPerMin + 1,
        height: Math.max(MIN_BLOCK_MINUTES, endMin - startMin) * pxPerMin - 2,
        left: `calc(${(dayIdx / days) * 100}% + 1px)`,
        width: `calc(${100 / days}% - 3px)`,
      }}
    >
      <p className="truncate text-xs font-semibold">{label || "Untitled"}</p>
      <p className="text-micro tabular-nums text-muted-foreground">
        {fmt(startMin)}–{fmt(endMin)}
      </p>
    </div>
  );
}
