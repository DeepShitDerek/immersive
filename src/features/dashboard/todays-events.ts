import type {
  Calendar,
  CalendarRow,
  DashboardData,
  EventException,
} from "@/types";
import { buildEntries, filterEntries } from "@/features/calendar/build-entries";

/**
 * Today's events for the dashboard, through the calendar's own pipeline
 *.
 *
 * The dashboard used to read `events` whose `start_time` fell today. A
 * repeating series stores only its first occurrence there, so a weekly
 * standup created last month never showed. It also listed cancelled events
 * and events in hidden calendars, ignored moved or cancelled occurrences, and
 * missed an event that began before midnight. `get_calendar_data` rows expanded
 * by `buildEntries` and filtered by `filterEntries` are exactly what the
 * calendar shows for the day, so the two cannot disagree.
 */
export function todaysEvents({
  rows,
  exceptions,
  calendars,
  dayStart,
  dayEnd,
}: {
  rows: CalendarRow[];
  exceptions: EventException[];
  calendars: Pick<Calendar, "id" | "is_visible">[];
  /** Local midnight today, and local midnight tomorrow. */
  dayStart: Date;
  dayEnd: Date;
}): DashboardData["todaysEvents"] {
  const built = buildEntries({
    rows: rows.filter((row) => row.item_type === "event"),
    exceptions,
    windowStart: dayStart,
    windowEnd: dayEnd,
  });
  const visible = filterEntries(built, {
    // The calendar page's rule, so both screens hide the same calendars.
    hiddenCalendars: new Set(
      calendars.filter((c) => !c.is_visible).map((c) => c.id),
    ),
    showTasks: false,
    showHabits: false,
    showFinance: false,
  });
  return visible.map((entry) => ({
    id: entry.id,
    title: entry.title,
    start_time: entry.start.toISOString(),
    end_time: entry.end.toISOString(),
    is_all_day: entry.isAllDay,
  }));
}
