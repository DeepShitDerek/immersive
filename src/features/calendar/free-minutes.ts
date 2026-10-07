import { differenceInMinutes, startOfDay } from "date-fns";

/**
 * How much of a day is unbooked.
 *
 * All that survives of `grid-layout.ts`. The rest of that file — column
 * packing, overlap groups, pixel placement — was the geometry FullCalendar now
 * does, and doing it twice is how two views come to disagree about where the
 * same meeting sits. This is not geometry: it is a fact about the day that the
 * free-time bar states, and no calendar library offers it.
 */
interface Placeable {
  start: Date;
  end: Date;
}

/**
 * Unbooked minutes in a day, after events and inside the visible hours.
 *
 * Overlaps are merged first â€” two meetings at the same time consume one hour
 * between them, not two, and counting them separately would report negative
 * free time on a busy morning.
 */
export function freeMinutes({
  events,
  day,
  startHour,
  endHour,
}: {
  events: Placeable[];
  day: Date;
  startHour: number;
  endHour: number;
}): number {
  const dayStart = startOfDay(day);
  const windowStart = new Date(dayStart);
  windowStart.setHours(startHour, 0, 0, 0);
  const windowEnd = new Date(dayStart);
  windowEnd.setHours(endHour, 0, 0, 0);

  const total = differenceInMinutes(windowEnd, windowStart);
  if (total <= 0) return 0;

  const spans = events
    .map((event) => ({
      start: event.start < windowStart ? windowStart : event.start,
      end: event.end > windowEnd ? windowEnd : event.end,
    }))
    .filter((span) => span.end > span.start && span.start < windowEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  let busy = 0;
  let cursor = windowStart;

  for (const span of spans) {
    if (span.end <= cursor) continue;
    const from = span.start > cursor ? span.start : cursor;
    busy += differenceInMinutes(span.end, from);
    cursor = span.end;
  }

  return Math.max(total - busy, 0);
}
