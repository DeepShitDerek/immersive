import {
  addDays,
  endOfMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

/**
 * Which days a view shows, and which range it has to fetch.
 *
 * Pulled out of the page's `useMemo` because it is the one piece of calendar
 * logic that every other part depends on and none of it is about React: the
 * grid draws `days`, the RPC is called with `from`/`to`, `buildEntries` filters
 * on the same window, and the heading names its ends. When those disagree, rows
 * are fetched and not drawn — or drawn and not fetched — which is the shape of
 * every "why is this missing" bug this module has had.
 *
 * It is also where the responsive week lives. A week is seven days on a screen
 * with room for seven; below `md` it was still seven inside an `overflow-hidden`
 * grid, about 50px a day on a phone — narrower than the time labels in it.
 */

export type CalendarView = "day" | "3day" | "week" | "month" | "agenda";

export interface ViewWindow {
  /** The columns the grid draws. Empty for agenda, which is a list. */
  days: Date[];
  /** Inclusive fetch range. */
  from: Date;
  to: Date;
}

/** How far forward the agenda looks. */
const AGENDA_DAYS = 30;

export function viewWindow({
  view,
  anchor,
  weekStartsOn,
  weekLength = 7,
}: {
  view: CalendarView;
  anchor: Date;
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Days in the week view — three on a narrow screen, seven otherwise. */
  weekLength?: number;
}): ViewWindow {
  if (view === "day") {
    const day = startOfDay(anchor);
    return { days: [day], from: day, to: day };
  }

  // Three days from the anchor: "around now" on a phone, or for a closer look.
  if (view === "3day") {
    const first = startOfDay(anchor);
    return {
      days: [0, 1, 2].map((i) => addDays(first, i)),
      from: first,
      to: addDays(first, 2),
    };
  }

  if (view === "month") {
    // Whole weeks, so the grid is rectangular and the days either side of the
    // month are real days rather than blanks.
    const first = startOfWeek(startOfMonth(anchor), { weekStartsOn });
    const last = addDays(startOfWeek(endOfMonth(anchor), { weekStartsOn }), 6);
    const count =
      Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1;

    return {
      days: Array.from({ length: count }, (_, i) => addDays(first, i)),
      from: first,
      to: last,
    };
  }

  if (view === "agenda") {
    const from = startOfDay(anchor);
    return { days: [], from, to: addDays(from, AGENDA_DAYS) };
  }

  /*
    A short week starts at the anchor, a full one at the start of its week.

    A three-day window pinned to Monday would often not contain today, which is
    the one day it must — and on a phone "this week" is really "around now".
  */
  const first =
    weekLength >= 7
      ? startOfWeek(anchor, { weekStartsOn })
      : startOfDay(anchor);

  return {
    days: Array.from({ length: weekLength }, (_, i) => addDays(first, i)),
    from: first,
    to: addDays(first, weekLength - 1),
  };
}

/**
 * How far one press of the arrows moves.
 *
 * By the window rather than by a named unit: stepping a week through a
 * three-day view would skip four days every press, which is how a day goes
 * missing without anything being wrong with the data.
 */
export function stepDays(view: CalendarView, weekLength: number): number {
  if (view === "day") return 1;
  if (view === "3day") return 3;
  if (view === "agenda") return AGENDA_DAYS;
  if (view === "month") return 0; // Months step by month, not by days.
  return weekLength;
}
