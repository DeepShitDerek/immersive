import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  getDate,
  getDay,
  isAfter,
  isBefore,
  setDate,
  startOfDay,
} from "date-fns";
import { toLocalISODate } from "@/lib/date-utils";

/**
 * Recurrence.
 *
 * A focused subset of RFC 5545, not a full implementation. Supported:
 * `FREQ` (DAILY/WEEKLY/MONTHLY/YEARLY), `INTERVAL`, `BYDAY`, `COUNT`, `UNTIL`.
 *
 * That is a deliberate line. The full specification includes BYSETPOS, BYYEARDAY,
 * WKST and a dozen other fields, and supporting them badly is worse than not
 * supporting them: a rule that silently expands to the wrong dates is a missed
 * appointment. Anything unparseable yields **no occurrences** rather than a
 * guess, and the caller can say so.
 *
 * Expansion happens on the client rather than in Postgres because a weekly
 * 09:00 standup is 09:00 *local* on both sides of a clock change. That is a
 * property of the viewer's timezone, not of the stored row, and only the
 * browser knows it.
 */

type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

/** RFC day codes, Sunday first to match `getDay()`. */
export const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
export type DayCode = (typeof DAY_CODES)[number];

export interface RecurrenceRule {
  freq: Frequency;
  /** Every N periods. Always at least 1. */
  interval: number;
  /** Weekly only: which days. Empty means "the day the series started". */
  byDay: DayCode[];
  /** Stop after N occurrences. */
  count?: number;
  /** Stop on or before this date. */
  until?: Date;
}

/**
 * Read an `UNTIL` value as a **local** date.
 *
 * Both the basic form (`20261231T235959Z`) and a plain date are accepted,
 * because the app writes the second and an import may carry the first.
 *
 * Built from the parts rather than handed to `new Date(string)`, which reads a
 * bare `YYYY-MM-DD` as UTC midnight — so a rule ending 31 December stops on the
 * 30th for every viewer behind UTC. The rest of this module works in local
 * time, and a boundary that disagrees with it drops a day off every series.
 */
function parseUntil(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const match = raw.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (!match) return undefined;

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/** Parse an RRULE string. Null for anything not understood. */
export function parseRRule(
  rrule: string | null | undefined,
): RecurrenceRule | null {
  if (!rrule) return null;

  const parts = new Map<string, string>();
  for (const chunk of rrule.replace(/^RRULE:/i, "").split(";")) {
    const [key, value] = chunk.split("=");
    if (key && value) parts.set(key.trim().toUpperCase(), value.trim());
  }

  const freq = parts.get("FREQ")?.toUpperCase();
  if (
    freq !== "DAILY" &&
    freq !== "WEEKLY" &&
    freq !== "MONTHLY" &&
    freq !== "YEARLY"
  ) {
    return null;
  }

  const interval = Number(parts.get("INTERVAL") ?? 1);
  const count = parts.get("COUNT") ? Number(parts.get("COUNT")) : undefined;

  const byDay = (parts.get("BYDAY") ?? "")
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter((code): code is DayCode =>
      (DAY_CODES as readonly string[]).includes(code),
    );

  const until = parseUntil(parts.get("UNTIL"));

  return {
    freq,
    interval:
      Number.isFinite(interval) && interval > 0 ? Math.floor(interval) : 1,
    byDay,
    count: Number.isFinite(count) && count! > 0 ? count : undefined,
    until,
  };
}

/** Build an RRULE string. The inverse of `parseRRule` for what we support. */
export function formatRRule(rule: RecurrenceRule): string {
  const parts = [`FREQ=${rule.freq}`];
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.byDay.length > 0) parts.push(`BYDAY=${rule.byDay.join(",")}`);
  if (rule.count) parts.push(`COUNT=${rule.count}`);
  if (rule.until) {
    parts.push(`UNTIL=${toLocalISODate(rule.until)}`);
  }
  return parts.join(";");
}

/**
 * A hard ceiling on how many occurrences one rule may produce.
 *
 * A daily rule with no end, viewed over a year, is 365 — fine. The cap exists
 * for a misconfigured rule and for the month view of a decade-long series: an
 * unbounded loop over a schedule that fails to advance is how a page hangs.
 */
const MAX_OCCURRENCES = 750;

/** Step to the next candidate start for a non-weekly frequency. */
function advance(from: Date, rule: RecurrenceRule): Date {
  switch (rule.freq) {
    case "DAILY":
      return addDays(from, rule.interval);
    case "WEEKLY":
      return addWeeks(from, rule.interval);
    case "MONTHLY": {
      // Clamp rather than roll over: a rule on the 31st should fire on the
      // 30th in November, not on 1 December. `addMonths` already clamps, but
      // doing it explicitly keeps the intent visible.
      const next = addMonths(from, rule.interval);
      return setDate(next, Math.min(getDate(from), daysInMonth(next)));
    }
    case "YEARLY":
      return addYears(from, rule.interval);
  }
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Occurrence start times for a rule within a window.
 *
 * Returns starts only; the caller applies the original event's duration, which
 * is what keeps a 90-minute meeting 90 minutes long across a clock change
 * rather than becoming 30 or 150.
 */
export function expandOccurrences({
  start,
  rrule,
  windowStart,
  windowEnd,
}: {
  /** The series' first occurrence. */
  start: Date;
  rrule: string | null | undefined;
  windowStart: Date;
  windowEnd: Date;
}): Date[] {
  const rule = parseRRule(rrule);
  // Not recurring, or a rule we do not understand: the single start, if it
  // falls in the window. Guessing at an unparseable rule is how appointments
  // get missed.
  if (!rule) {
    return !isBefore(start, windowStart) && !isAfter(start, windowEnd)
      ? [start]
      : [];
  }

  const out: Date[] = [];
  let emitted = 0;

  if (rule.freq === "WEEKLY" && rule.byDay.length > 0) {
    const wanted = new Set(rule.byDay.map((code) => DAY_CODES.indexOf(code)));
    // Walk week by week from the series start, emitting each wanted weekday.
    // Anchored on the start's own week so INTERVAL=2 means "every other week"
    // relative to when the series began, not to an arbitrary epoch.
    let weekCursor = start;

    for (let guard = 0; guard < MAX_OCCURRENCES; guard += 1) {
      if (isAfter(weekCursor, windowEnd)) break;
      if (rule.until && isAfter(weekCursor, rule.until)) break;

      const weekStart = addDays(weekCursor, -getDay(weekCursor));
      for (let offset = 0; offset < 7; offset += 1) {
        if (!wanted.has(offset)) continue;

        const candidate = withTimeFrom(addDays(weekStart, offset), start);
        if (isBefore(candidate, start)) continue;
        if (rule.until && isAfter(startOfDay(candidate), rule.until)) continue;
        if (rule.count && emitted >= rule.count) break;
        if (isAfter(candidate, windowEnd)) continue;

        emitted += 1;
        if (!isBefore(candidate, windowStart)) out.push(candidate);
      }

      if (rule.count && emitted >= rule.count) break;
      weekCursor = addWeeks(weekCursor, rule.interval);
    }

    return out.sort((a, b) => a.getTime() - b.getTime());
  }

  let cursor = start;
  for (let guard = 0; guard < MAX_OCCURRENCES; guard += 1) {
    if (rule.count && emitted >= rule.count) break;
    if (rule.until && isAfter(startOfDay(cursor), rule.until)) break;
    if (isAfter(cursor, windowEnd)) break;

    emitted += 1;
    if (!isBefore(cursor, windowStart)) out.push(cursor);

    const next = advance(cursor, rule);
    // A schedule that fails to move forward would loop forever. The guard
    // above would stop it, but not before doing 750 pointless iterations.
    if (!isAfter(next, cursor)) break;
    cursor = next;
  }

  return out;
}

/** Put the clock time of `source` onto the date of `day`, in local time. */
function withTimeFrom(day: Date, source: Date): Date {
  const result = new Date(day);
  result.setHours(
    source.getHours(),
    source.getMinutes(),
    source.getSeconds(),
    0,
  );
  return result;
}

const DAY_NAMES: Record<DayCode, string> = {
  SU: "Sunday",
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
};

/**
 * A rule, in words.
 *
 * Shown wherever a rule is set, because "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH"
 * is not something anybody should be asked to verify by reading.
 */
export function describeRRule(rrule: string | null | undefined): string | null {
  const rule = parseRRule(rrule);
  if (!rule) return null;

  const every =
    rule.interval === 1
      ? {
          DAILY: "Daily",
          WEEKLY: "Weekly",
          MONTHLY: "Monthly",
          YEARLY: "Yearly",
        }[rule.freq]
      : `Every ${rule.interval} ${
          {
            DAILY: "days",
            WEEKLY: "weeks",
            MONTHLY: "months",
            YEARLY: "years",
          }[rule.freq]
        }`;

  const days =
    rule.freq === "WEEKLY" && rule.byDay.length > 0
      ? ` on ${rule.byDay.map((code) => DAY_NAMES[code]).join(", ")}`
      : "";

  const ends = rule.count
    ? `, ${rule.count} times`
    : rule.until
      ? `, until ${rule.until.toLocaleDateString()}`
      : "";

  return `${every}${days}${ends}`;
}
