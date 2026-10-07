import { addDays, format, startOfDay } from "date-fns";
import type { CalendarEntry } from "@/types";

/**
 * Where things go on the grid. Pure, so every rule here is tested rather
 * than eyeballed: overlapping events sharing a column, an all-day event
 * spanning three days, an event that crosses midnight, a 23-hour DST day.
 *
 * Positions are in wall-clock minutes from local midnight (09:30 is 570),
 * never in elapsed milliseconds. On the day the clocks change an elapsed
 * count is off by an hour for everything after 02:00, and a 09:00 meeting
 * would be drawn at 10:00.
 */

export const MINUTES_PER_DAY = 24 * 60;
const SNAP_MINUTES = 15;

/** The local calendar date as a stable key: "2026-10-05". */
export const dayKey = (date: Date) => format(date, "yyyy-MM-dd");

/** Wall-clock minutes from local midnight. */
export const minutesOfDay = (date: Date) =>
  date.getHours() * 60 + date.getMinutes();

export function snapMinutes(minutes: number, snap = SNAP_MINUTES): number {
  return Math.max(
    0,
    Math.min(MINUTES_PER_DAY, Math.round(minutes / snap) * snap),
  );
}

/** A local Date on `day` at `minutes` past midnight (wall clock). */
export function atMinutes(day: Date, minutes: number): Date {
  const d = startOfDay(day);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

/**
 * Drawn in the all-day row rather than the time grid: all-day events and
 * the overlays from other modules (tasks due, habits done, a day's money),
 * which are dates, not times.
 */
export function isAllDayLike(entry: CalendarEntry): boolean {
  return entry.isAllDay || entry.kind !== "event";
}

/**
 * The dates an all-day entry covers, first and last inclusive.
 *
 * An all-day end is exclusive midnight (the 6th at 00:00 means "through the
 * 5th"). Rows written with end equal to start, or no real end, cover one day.
 */
export function allDayRange(entry: CalendarEntry): { first: Date; last: Date } {
  const first = startOfDay(entry.start);
  const end = entry.end;
  if (end <= entry.start) return { first, last: first };
  const lastInstant =
    minutesOfDay(end) === 0 && end.getSeconds() === 0
      ? addDays(startOfDay(end), -1)
      : startOfDay(end);
  return { first, last: lastInstant < first ? first : lastInstant };
}

/* ── The time grid ──────────────────────────────────────────────────── */

export interface Segment {
  entry: CalendarEntry;
  /** Wall-clock minutes within this day. */
  startMin: number;
  endMin: number;
  /** The entry began on an earlier day / runs on past this one. */
  continuesBefore: boolean;
  continuesAfter: boolean;
}

export interface PlacedSegment extends Segment {
  /** Column within its overlap cluster, and how many columns it has. */
  col: number;
  cols: number;
  /** How many columns it may widen across (empty neighbours to its right). */
  span: number;
}

/** The smallest height a block is drawn at, so a 5-minute event is clickable. */
export const MIN_BLOCK_MINUTES = 20;

/** The pieces of timed entries that fall on `day`, clipped to it. */
export function segmentsForDay(entries: CalendarEntry[], day: Date): Segment[] {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const out: Segment[] = [];
  for (const entry of entries) {
    if (isAllDayLike(entry)) continue;
    // A zero-length event still shows, on the day it starts.
    const end = entry.end > entry.start ? entry.end : entry.start;
    const touches =
      entry.start < dayEnd && (end > dayStart || entry.start >= dayStart);
    if (!touches) continue;
    const continuesBefore = entry.start < dayStart;
    const continuesAfter = end > dayEnd;
    const startMin = continuesBefore ? 0 : minutesOfDay(entry.start);
    const endMin = continuesAfter
      ? MINUTES_PER_DAY
      : end <= dayStart
        ? startMin
        : // An event ending exactly at midnight ends at 24:00, not 00:00.
          end.getTime() === dayEnd.getTime()
          ? MINUTES_PER_DAY
          : minutesOfDay(end);
    out.push({
      entry,
      startMin,
      endMin: Math.max(endMin, startMin),
      continuesBefore,
      continuesAfter,
    });
  }
  return out;
}

/**
 * Side by side where they overlap, full width where they do not.
 *
 * Segments are grouped into clusters that overlap transitively; inside a
 * cluster each takes the first column free at its start. A block then widens
 * into columns to its right that stay empty for its whole length, so a long
 * event beside two short ones is not stuck at a third of the width.
 * Overlap is judged on the drawn height (at least MIN_BLOCK_MINUTES), so two
 * blocks never land on top of each other.
 */
export function layoutDay(segments: Segment[]): PlacedSegment[] {
  const drawnEnd = (s: Segment) =>
    Math.max(s.endMin, s.startMin + MIN_BLOCK_MINUTES);
  const sorted = [...segments].sort(
    (a, b) =>
      a.startMin - b.startMin ||
      drawnEnd(b) - drawnEnd(a) ||
      a.entry.title.localeCompare(b.entry.title),
  );

  const placed: PlacedSegment[] = [];
  let cluster: { seg: Segment; col: number }[] = [];
  let columnsEnd: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const cols = columnsEnd.length;
    for (const { seg, col } of cluster) {
      let span = 1;
      for (let c = col + 1; c < cols; c++) {
        const blocked = cluster.some(
          (other) =>
            other.col === c &&
            other.seg.startMin < drawnEnd(seg) &&
            drawnEnd(other.seg) > seg.startMin,
        );
        if (blocked) break;
        span++;
      }
      placed.push({ ...seg, col, cols, span });
    }
    cluster = [];
    columnsEnd = [];
  };

  for (const seg of sorted) {
    if (cluster.length && seg.startMin >= clusterEnd) flush();
    let col = columnsEnd.findIndex((end) => end <= seg.startMin);
    if (col === -1) {
      col = columnsEnd.length;
      columnsEnd.push(drawnEnd(seg));
    } else {
      columnsEnd[col] = drawnEnd(seg);
    }
    cluster.push({ seg, col });
    clusterEnd = Math.max(clusterEnd, drawnEnd(seg));
  }
  if (cluster.length) flush();
  return placed;
}

/* ── The all-day row ────────────────────────────────────────────────── */

export interface AllDayBar {
  entry: CalendarEntry;
  /** Column index of the first visible day, and how many days it covers. */
  startCol: number;
  span: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/**
 * All-day entries as bars across the visible days, stacked into lanes so a
 * three-day trip and a one-day holiday never overlap. Longer bars first, so
 * they take the top lanes and the shape stays stable as days are added.
 */
export function layoutAllDay(
  entries: CalendarEntry[],
  days: Date[],
): AllDayBar[] {
  if (days.length === 0) return [];
  const keys = days.map(dayKey);
  const firstVisible = startOfDay(days[0]);
  const lastVisible = startOfDay(days[days.length - 1]);

  const bars = entries
    .filter(isAllDayLike)
    .map((entry) => {
      const { first, last } = allDayRange(entry);
      if (last < firstVisible || first > lastVisible) return null;
      const clippedFirst = first < firstVisible ? firstVisible : first;
      const clippedLast = last > lastVisible ? lastVisible : last;
      const startCol = keys.indexOf(dayKey(clippedFirst));
      const endCol = keys.indexOf(dayKey(clippedLast));
      if (startCol === -1 || endCol === -1) return null;
      return {
        entry,
        startCol,
        span: endCol - startCol + 1,
        lane: 0,
        continuesBefore: first < firstVisible,
        continuesAfter: last > lastVisible,
      };
    })
    .filter((bar): bar is AllDayBar => bar !== null)
    .sort(
      (a, b) =>
        a.startCol - b.startCol ||
        b.span - a.span ||
        kindOrder(a.entry) - kindOrder(b.entry) ||
        a.entry.title.localeCompare(b.entry.title),
    );

  const laneEnds: number[] = [];
  for (const bar of bars) {
    let lane = laneEnds.findIndex((end) => end < bar.startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(bar.startCol + bar.span - 1);
    } else {
      laneEnds[lane] = bar.startCol + bar.span - 1;
    }
    bar.lane = lane;
  }
  return bars;
}

/** Events first, then the overlays, in a fixed order. */
function kindOrder(entry: CalendarEntry): number {
  return { event: 0, task: 1, habit_summary: 2, transaction_summary: 3 }[
    entry.kind
  ];
}

/* ── Month and agenda ───────────────────────────────────────────────── */

/** Everything touching each day, all-day-like first, then by start time. */
export function entriesByDay(
  entries: CalendarEntry[],
  days: Date[],
): Map<string, CalendarEntry[]> {
  const map = new Map<string, CalendarEntry[]>(
    days.map((d) => [dayKey(d), []]),
  );
  for (const entry of entries) {
    if (isAllDayLike(entry)) {
      const { first, last } = allDayRange(entry);
      for (let d = first; d <= last; d = addDays(d, 1)) {
        map.get(dayKey(d))?.push(entry);
      }
      continue;
    }
    for (const day of days) {
      if (segmentsForDay([entry], day).length)
        map.get(dayKey(day))?.push(entry);
    }
  }
  for (const list of map.values()) {
    list.sort(
      (a, b) =>
        Number(!isAllDayLike(a)) - Number(!isAllDayLike(b)) ||
        kindOrder(a) - kindOrder(b) ||
        a.start.getTime() - b.start.getTime() ||
        a.title.localeCompare(b.title),
    );
  }
  return map;
}

/** Split a month's days into rows of seven. */
export function weeksOf(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/** "09:00–10:30", "From 22:00", "Until 01:00", or "All day". */
export function timeLabel(entry: CalendarEntry, day?: Date): string {
  if (isAllDayLike(entry)) return "All day";
  const t = (d: Date) => format(d, "HH:mm");
  if (day) {
    const [seg] = segmentsForDay([entry], day);
    if (seg?.continuesBefore && seg.continuesAfter) return "All day";
    if (seg?.continuesBefore) return `Until ${t(entry.end)}`;
    if (seg?.continuesAfter) return `From ${t(entry.start)}`;
  }
  return entry.end > entry.start
    ? `${t(entry.start)}–${t(entry.end)}`
    : t(entry.start);
}

/* ── A week row of the month ────────────────────────────────────────── */

export interface MonthWeekLayout {
  /** All-day bars shown, each in its lane (a lane is one line). */
  bars: AllDayBar[];
  /** Per day: timed entries and the line each sits on, then "+n more". */
  days: {
    timed: { entry: CalendarEntry; line: number }[];
    more: number;
    moreLine: number;
  }[];
}

/**
 * What fits in one week of the month, given how many lines a day has room
 * for. Nothing is ever clipped: a day with more than fits shows "+n more"
 * on its last line instead.
 *
 * All-day and multi-day entries are one bar across the days they cover, in
 * lanes shared by the week; timed entries follow on each day's own lines.
 * If any day overflows, bars keep off the last line, so every day's
 * "+n more" has a place to sit.
 */
export function layoutMonthWeek(
  entries: CalendarEntry[],
  week: Date[],
  lines: number,
): MonthWeekLayout {
  const capacity = Math.max(1, Math.floor(lines));
  const allBars = layoutAllDay(entries, week);
  const timedByDay = week.map((day) =>
    entries
      .filter((e) => !isAllDayLike(e) && segmentsForDay([e], day).length > 0)
      .sort(
        (a, b) =>
          a.start.getTime() - b.start.getTime() ||
          a.title.localeCompare(b.title),
      ),
  );
  const covering = (dayIdx: number, bars: AllDayBar[]) =>
    bars.filter((b) => dayIdx >= b.startCol && dayIdx < b.startCol + b.span);
  const topLine = (dayIdx: number, bars: AllDayBar[]) =>
    covering(dayIdx, bars).reduce((m, b) => Math.max(m, b.lane + 1), 0);

  const used = week.map((_, i) => topLine(i, allBars) + timedByDay[i].length);
  const anyOverflow = used.some((n) => n > capacity);
  const barLimit = anyOverflow ? capacity - 1 : capacity;
  const bars = allBars.filter((b) => b.lane < barLimit);

  const days = week.map((_, i) => {
    const overflow = used[i] > capacity;
    const slots = overflow ? capacity - 1 : capacity;
    const start = Math.min(topLine(i, bars), slots);
    const fit = Math.max(0, slots - start);
    const timed = timedByDay[i]
      .slice(0, fit)
      .map((entry, k) => ({ entry, line: start + k }));
    const hiddenBars = covering(i, allBars).filter(
      (b) => b.lane >= barLimit,
    ).length;
    const more = hiddenBars + (timedByDay[i].length - timed.length);
    return { timed, more, moreLine: capacity - 1 };
  });
  return { bars, days };
}
