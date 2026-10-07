import type { Calendar, CalendarColorToken, CalendarEntry } from "@/types";

/**
 * Which colour an entry draws in.
 *
 * The per-entity fallback lives here rather than at each call site, because
 * five surfaces render entries — week, day, month, agenda and the all-day row —
 * and a colour decided independently in each is a colour that disagrees with
 * itself.
 *
 * The rule is: an event's own `color_token` wins if it has one, otherwise it
 * takes its calendar's. That is what makes the checkbox in the sidebar mean
 * something — tick "Work" green and the events on Work are green, without
 * having to set a colour on every one of them.
 *
 * Overlays keep their own identity. A task, a habit roll-up and a day's money
 * are not on any calendar, and colouring them like one would say they were.
 */

/** Where an entry falls back to when nothing else applies. */
const DEFAULT_TOKEN: CalendarColorToken = "chart-1";

/** Overlay kinds read as themselves, not as a calendar. */
const OVERLAY_TOKENS: Record<string, CalendarColorToken> = {
  task: "chart-4",
  habit_summary: "chart-2",
  transaction_summary: "chart-3",
};

function resolveEntryColor(
  entry: CalendarEntry,
  calendarsById: Map<string, Calendar>,
): CalendarColorToken {
  if (entry.kind !== "event") {
    return OVERLAY_TOKENS[entry.kind] ?? DEFAULT_TOKEN;
  }

  // An explicit colour on the event is a deliberate override and outranks the
  // calendar it sits on.
  if (entry.colorToken) return entry.colorToken;

  const calendar = entry.calendarId
    ? calendarsById.get(entry.calendarId)
    : undefined;

  return calendar?.color_token ?? DEFAULT_TOKEN;
}

/**
 * Stamp the resolved colour onto every entry, once, before they are handed to
 * the views.
 *
 * Resolving inside each renderer would mean passing the calendar list down to
 * all five of them and doing the lookup once per visible block per render.
 */
export function withCalendarColors(
  entries: CalendarEntry[],
  calendars: Calendar[],
): CalendarEntry[] {
  const byId = new Map(calendars.map((calendar) => [calendar.id, calendar]));

  return entries.map((entry) => {
    const colorToken = resolveEntryColor(entry, byId);
    // Returning the same object when nothing changes keeps referential
    // equality for the memos downstream.
    return entry.colorToken === colorToken ? entry : { ...entry, colorToken };
  });
}
