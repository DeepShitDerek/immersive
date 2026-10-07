import { addMinutes, startOfDay } from "date-fns";
import type { CalendarEntry, CalendarRow, EventException } from "@/types";
import { expandOccurrences } from "./recurrence";

/**
 * Turning database rows into things on a grid.
 *
 * One row can become many entries: a weekly standup is a single `events` row
 * and fifty-two occurrences in a year's view. This is where the rule is
 * expanded, exceptions are applied, and every entry gets a start *and* an end —
 * the grid needs both, and the database stores `end_time` as nullable.
 */

const DEFAULT_DURATION_MINUTES = 60;

/**
 * Rows whose `start_time` is a **calendar date**, not an instant.
 *
 * `get_calendar_data` builds these from DATE columns — `t.due_date`,
 * `hl.completed_date`, a day of money — and casts them with `::timestamptz`.
 * On a UTC server that yields midnight UTC, so a task due the 18th arrives as
 * `2026-09-18T00:00:00Z`.
 *
 * Every view then buckets by `startOfDay()`, which is **local**. West of UTC
 * that lands the 18th on the 17th: a task due Friday drawn on Thursday, and a
 * day's habits and spending drawn against the wrong day. Worse at a view's
 * edge, where the shift pushes the row outside the window and it is not drawn
 * at all — which is what "some things just don't load" turns out to be.
 *
 * Events are deliberately *not* in this set. An all-day event is written by
 * the sheet as `new Date(localInput).toISOString()`, so its instant already
 * carries the author's local date; reading it as UTC would break the kind that
 * currently works. The two sources genuinely mean different things by the same
 * column, and the only honest fix is to say so here.
 */
const DATE_ONLY_KINDS = new Set([
  "task",
  "habit_summary",
  "transaction_summary",
]);

/**
 * The day a row belongs on, as a local `Date` at midnight.
 *
 * Exported for its own test: this is one line of arithmetic that decides
 * whether three of the four entry kinds appear on the right day.
 */
export function resolveStart(startIso: string, kind: string): Date {
  const instant = new Date(startIso);
  if (!DATE_ONLY_KINDS.has(kind)) return instant;

  // The UTC parts are the calendar date the database meant; rebuilding them in
  // local time puts the row on that date for a viewer in any zone.
  return new Date(
    instant.getUTCFullYear(),
    instant.getUTCMonth(),
    instant.getUTCDate(),
  );
}

/** A duration to use when a row has no end. */
function resolveEnd(start: Date, endIso: string | null, allDay: boolean): Date {
  if (endIso) return new Date(endIso);
  // An all-day row covers its whole day; a timed row with no end gets an hour,
  // which is the least surprising default and what every calendar does.
  if (allDay) {
    const end = startOfDay(start);
    end.setDate(end.getDate() + 1);
    return end;
  }
  return addMinutes(start, DEFAULT_DURATION_MINUTES);
}

const isoKey = (date: Date) => date.toISOString();

/**
 * Expand rows into entries for a window.
 *
 * Exceptions are applied by original start: a cancelled occurrence disappears,
 * a moved one is emitted at its new time. Both are keyed on the start the
 * occurrence *would* have had, because a computed occurrence has no id of its
 * own to reference.
 */
export function buildEntries({
  rows,
  exceptions,
  windowStart,
  windowEnd,
}: {
  rows: CalendarRow[];
  exceptions: EventException[];
  windowStart: Date;
  windowEnd: Date;
}): CalendarEntry[] {
  const byEvent = new Map<string, Map<string, EventException>>();
  for (const exception of exceptions) {
    const forEvent = byEvent.get(exception.event_id) ?? new Map();
    forEvent.set(isoKey(new Date(exception.original_start)), exception);
    byEvent.set(exception.event_id, forEvent);
  }

  const entries: CalendarEntry[] = [];

  for (const row of rows) {
    const start = resolveStart(row.start_time, row.item_type);
    const end = resolveEnd(start, row.end_time, row.is_all_day);
    const durationMs = end.getTime() - start.getTime();

    const data = row.data ?? {};
    const rrule = typeof data.rrule === "string" ? data.rrule : null;

    const base: Omit<CalendarEntry, "id" | "start" | "end"> = {
      sourceId: row.item_id,
      kind: row.item_type,
      title: row.title,
      isAllDay: row.is_all_day,
      colorToken: (data.color_token as CalendarEntry["colorToken"]) ?? null,
      calendarId: (data.calendar_id as string | null) ?? null,
      location: (data.location as string | null) ?? null,
      meetingUrl: (data.meeting_url as string | null) ?? null,
      description: (data.description as string | null) ?? null,
      status: (data.status as CalendarEntry["status"]) ?? "confirmed",
      rrule,
      taskId: (data.task_id as string | null) ?? null,
      data,
    };

    // Non-recurring rows, and everything that is not an event, are one entry.
    if (!rrule || row.item_type !== "event") {
      if (end > windowStart && start < windowEnd) {
        entries.push({ ...base, id: row.item_id, start, end });
      }
      continue;
    }

    const exceptionsForEvent = byEvent.get(row.item_id);

    for (const occurrenceStart of expandOccurrences({
      start,
      rrule,
      windowStart,
      windowEnd,
    })) {
      const exception = exceptionsForEvent?.get(isoKey(occurrenceStart));
      if (exception?.is_cancelled) continue;

      const actualStart = exception?.new_start
        ? new Date(exception.new_start)
        : occurrenceStart;
      const actualEnd = exception?.new_end
        ? new Date(exception.new_end)
        : // Duration is carried from the series rather than recomputed, which
          // is what keeps a 90-minute meeting 90 minutes across a clock change
          // instead of becoming 30 or 150.
          new Date(actualStart.getTime() + durationMs);

      entries.push({
        ...base,
        // Unique per occurrence. The row id alone would collide fifty-two
        // times over and make every standup the same React node.
        id: `${row.item_id}:${isoKey(occurrenceStart)}`,
        title: exception?.new_title ?? row.title,
        start: actualStart,
        end: actualEnd,
        occurrenceStart,
        seriesStart: start,
        // Only when the occurrence actually diverges from the series; an
        // untouched occurrence has nothing to reset.
        exceptionId: exception?.id,
      });
    }
  }

  return entries.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Which entries a visibility filter lets through.
 *
 * Overlays (tasks, habits, finance) are toggled per kind; events are toggled
 * by their calendar. An event with no calendar is always shown — hiding a row
 * because it predates the calendars feature would look like data loss.
 */
export function filterEntries(
  entries: CalendarEntry[],
  {
    hiddenCalendars,
    showTasks,
    showHabits,
    showFinance,
  }: {
    hiddenCalendars: ReadonlySet<string>;
    showTasks: boolean;
    showHabits: boolean;
    showFinance: boolean;
  },
): CalendarEntry[] {
  return entries.filter((entry) => {
    switch (entry.kind) {
      case "task":
        return showTasks;
      case "habit_summary":
        return showHabits;
      case "transaction_summary":
        return showFinance;
      case "event":
        if (entry.status === "cancelled") return false;
        if (!entry.calendarId) return true;
        return !hiddenCalendars.has(entry.calendarId);
    }
  });
}
