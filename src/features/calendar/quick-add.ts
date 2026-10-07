import {
  addDays,
  addWeeks,
  nextDay,
  setHours,
  setMinutes,
  startOfDay,
  type Day,
} from "date-fns";
import { DAY_CODES, type DayCode } from "./recurrence";

/**
 * Natural-language event entry.
 *
 * "dentist thursday 3pm", "call amma sunday 8pm", "gym every tuesday 7am".
 *
 * Hand-written rather than a parsing library, and deliberately narrow. General
 * date parsers are large, and they fail in the worst possible way: confidently.
 * "next friday" meaning two different things to the user and the library is a
 * missed appointment. This handles the handful of shapes people actually type,
 * **reports what it understood**, and leaves everything it did not touch in the
 * title so nothing is silently swallowed.
 *
 * The interface shows the interpretation back before saving. That is the real
 * safety mechanism — the parser does not have to be perfect if you can see what
 * it decided.
 */

export interface ParsedEvent {
  title: string;
  start: Date | null;
  end: Date | null;
  isAllDay: boolean;
  rrule: string | null;
  /** What the parser recognised, in words, for the confirmation line. */
  understood: string[];
}

const WEEKDAYS: Record<string, Day> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const DAY_CODE_BY_INDEX: Record<number, DayCode> = Object.fromEntries(
  DAY_CODES.map((code, index) => [index, code]),
) as Record<number, DayCode>;

/** Remove a matched fragment and tidy the whitespace it leaves behind. */
function strip(text: string, match: string): string {
  return text
    .replace(match, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * "3pm", "15:00", "9.30am", "at 7".
 *
 * A bare number is only read as a time when preceded by "at" — otherwise
 * "sprint 3" becomes a 3am meeting, which is the kind of confident wrongness
 * worth avoiding.
 */
function matchTime(
  text: string,
): { hours: number; minutes: number; match: string } | null {
  const explicit = text.match(
    /\b(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm)\b|\b(\d{1,2}):(\d{2})\b|\bat\s+(\d{1,2})\b/i,
  );
  if (!explicit) return null;

  if (explicit[3]) {
    let hours = Number(explicit[1]);
    const minutes = Number(explicit[2] ?? 0);
    const meridiem = explicit[3].toLowerCase();
    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes, match: explicit[0] };
  }

  if (explicit[4]) {
    const hours = Number(explicit[4]);
    const minutes = Number(explicit[5]);
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes, match: explicit[0] };
  }

  const bare = Number(explicit[6]);
  if (Number.isNaN(bare) || bare > 23) return null;
  return { hours: bare, minutes: 0, match: explicit[0] };
}

interface DateMatch {
  date: Date;
  match: string;
  label: string;
}

/** "today", "tomorrow", "friday", "next monday", "in 3 days", "24 aug". */
function matchDate(text: string, today: Date): DateMatch | null {
  const base = startOfDay(today);

  const relative = text.match(/\b(today|tonight|tomorrow|tmr)\b/i);
  if (relative) {
    const word = relative[1].toLowerCase();
    const date =
      word === "tomorrow" || word === "tmr" ? addDays(base, 1) : base;
    return {
      date,
      match: relative[0],
      label: word === "tonight" ? "today" : word,
    };
  }

  const inDays = text.match(/\bin\s+(\d{1,3})\s+(day|days|week|weeks)\b/i);
  if (inDays) {
    const amount = Number(inDays[1]);
    const date = /week/i.test(inDays[2])
      ? addWeeks(base, amount)
      : addDays(base, amount);
    return { date, match: inDays[0], label: inDays[0].toLowerCase() };
  }

  const named = text.match(
    /\b(next\s+)?(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat)\b/i,
  );
  if (named) {
    const day = WEEKDAYS[named[2].toLowerCase()];
    // `nextDay` always moves forward, so "friday" on a Friday means next week —
    // which is what people mean when they say it about a future appointment.
    let date = nextDay(base, day);
    if (named[1]) date = addWeeks(date, 1);
    return { date, match: named[0], label: named[0].toLowerCase() };
  }

  const dayMonth = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i,
  );
  if (dayMonth) {
    const months = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    const month = months.indexOf(dayMonth[2].toLowerCase());
    const day = Number(dayMonth[1]);
    if (month >= 0 && day >= 1 && day <= 31) {
      let date = new Date(base.getFullYear(), month, day);
      // A date already gone this year means next year, which is what someone
      // typing "3 jan" in December means.
      if (date < base) date = new Date(base.getFullYear() + 1, month, day);
      return { date, match: dayMonth[0], label: dayMonth[0].toLowerCase() };
    }
  }

  return null;
}

/** "every tuesday", "daily", "weekly", "every 2 weeks". */
function matchRecurrence(
  text: string,
): { rrule: string; match: string; label: string } | null {
  const everyDay = text.match(
    /\bevery\s+(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat)\b/i,
  );
  if (everyDay) {
    const index = WEEKDAYS[everyDay[1].toLowerCase()];
    return {
      rrule: `FREQ=WEEKLY;BYDAY=${DAY_CODE_BY_INDEX[index]}`,
      match: everyDay[0],
      label: everyDay[0].toLowerCase(),
    };
  }

  const everyN = text.match(/\bevery\s+(\d{1,2})\s+(day|days|week|weeks)\b/i);
  if (everyN) {
    const freq = /week/i.test(everyN[2]) ? "WEEKLY" : "DAILY";
    return {
      rrule: `FREQ=${freq};INTERVAL=${Number(everyN[1])}`,
      match: everyN[0],
      label: everyN[0].toLowerCase(),
    };
  }

  const simple = text.match(/\b(daily|weekly|monthly|yearly|annually)\b/i);
  if (simple) {
    const word = simple[1].toLowerCase();
    const freq =
      word === "daily"
        ? "DAILY"
        : word === "weekly"
          ? "WEEKLY"
          : word === "monthly"
            ? "MONTHLY"
            : "YEARLY";
    return { rrule: `FREQ=${freq}`, match: simple[0], label: word };
  }

  return null;
}

/** "for 90 minutes", "for 2h", "1.5 hours". */
function matchDuration(
  text: string,
): { minutes: number; match: string } | null {
  const explicit = text.match(
    /\bfor\s+(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/i,
  );
  if (!explicit) return null;

  const amount = Number(explicit[1]);
  const minutes = /^h/i.test(explicit[2]) ? amount * 60 : amount;
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60)
    return null;
  return { minutes: Math.round(minutes), match: explicit[0] };
}

const DEFAULT_DURATION = 60;

export function parseQuickAdd(input: string, today = new Date()): ParsedEvent {
  let remaining = input.trim();
  const understood: string[] = [];

  const recurrence = matchRecurrence(remaining);
  if (recurrence) {
    remaining = strip(remaining, recurrence.match);
    understood.push(recurrence.label);
  }

  const dateMatch = matchDate(remaining, today);
  if (dateMatch) {
    remaining = strip(remaining, dateMatch.match);
    understood.push(dateMatch.label);
  }

  const timeMatch = matchTime(remaining);
  if (timeMatch) {
    remaining = strip(remaining, timeMatch.match);
    understood.push(
      `${String(timeMatch.hours).padStart(2, "0")}:${String(timeMatch.minutes).padStart(2, "0")}`,
    );
  }

  const duration = matchDuration(remaining);
  if (duration) {
    remaining = strip(remaining, duration.match);
    understood.push(`${duration.minutes} min`);
  }

  // Tidy the connectives left behind once their operands are gone, so
  // "lunch with sam on friday" does not become "lunch with sam on".
  const title = remaining
    .replace(/\b(on|at|from)\s*$/i, "")
    .replace(/^\s*(on|at)\b/i, "")
    .trim();

  // A recurring rule with no explicit date starts from the weekday it names,
  // or today. Without any date at all there is nothing to schedule.
  const anchor =
    dateMatch?.date ??
    (recurrence ? startOfDay(today) : timeMatch ? startOfDay(today) : null);

  if (!anchor) {
    return {
      title: title || input.trim(),
      start: null,
      end: null,
      isAllDay: false,
      rrule: recurrence?.rrule ?? null,
      understood,
    };
  }

  const isAllDay = !timeMatch;
  const start = timeMatch
    ? setMinutes(setHours(anchor, timeMatch.hours), timeMatch.minutes)
    : anchor;
  const end = isAllDay
    ? addDays(startOfDay(anchor), 1)
    : new Date(
        start.getTime() + (duration?.minutes ?? DEFAULT_DURATION) * 60_000,
      );

  return {
    title: title || "Untitled",
    start,
    end,
    isAllDay,
    rrule: recurrence?.rrule ?? null,
    understood,
  };
}
