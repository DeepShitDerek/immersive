/**
 * Calendar dates as "YYYY-MM-DD" strings.
 *
 * A transaction happens on a *day*, not at an instant, so the ledger never
 * touches `Date` objects in local time: a purchase at 11 pm in Toronto must
 * not become tomorrow's because something formatted it in UTC, or
 * yesterday's in Kolkata. All arithmetic goes through a day number (days
 * since 1970-01-01) computed with `Date.UTC`, which has no timezone.
 *
 * ISO strings also sort correctly as strings, which the rest of the domain
 * relies on for comparisons.
 */

export type IsoDate = string;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

class DateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DateError";
  }
}

function parts(date: IsoDate): [number, number, number] {
  const match = ISO.exec(date);
  if (!match) throw new DateError(`Not a date: "${date}"`);
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new DateError(`Not a date: "${date}"`);
  }
  return [year, month, day];
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string") return false;
  try {
    parts(value);
    return true;
  } catch {
    return false;
  }
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];
}

export function toDayNumber(date: IsoDate): number {
  const [year, month, day] = parts(date);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

export function fromDayNumber(dayNumber: number): IsoDate {
  if (!Number.isInteger(dayNumber))
    throw new DateError(`Not a day number: ${dayNumber}`);
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
}

export function makeDate(year: number, month: number, day: number): IsoDate {
  const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  parts(date);
  return date;
}

export const yearOf = (date: IsoDate): number => parts(date)[0];
export const monthOf = (date: IsoDate): number => parts(date)[1];
export const dayOf = (date: IsoDate): number => parts(date)[2];

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromDayNumber(toDayNumber(date) + days);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

/**
 * Months later, keeping the day where the month allows and clamping where
 * it does not: Jan 31 + 1 month is Feb 28 (29 in a leap year).
 *
 * `anchorDay` is the day the series *wants* — without it, Jan 31 → Feb 28 →
 * Mar 28 would drift; with it, the third step is Mar 31 again.
 */
export function addMonths(
  date: IsoDate,
  months: number,
  anchorDay?: number,
): IsoDate {
  if (!Number.isInteger(months))
    throw new DateError(`Not a whole number of months: ${months}`);
  const [year, month, day] = parts(date);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  const wanted = anchorDay ?? day;
  return makeDate(
    targetYear,
    targetMonth,
    Math.min(wanted, daysInMonth(targetYear, targetMonth)),
  );
}

/** "2026-02". */
export const monthKey = (date: IsoDate): string => date.slice(0, 7);

export function startOfMonth(date: IsoDate): IsoDate {
  const [year, month] = parts(date);
  return makeDate(year, month, 1);
}

export function endOfMonth(date: IsoDate): IsoDate {
  const [year, month] = parts(date);
  return makeDate(year, month, daysInMonth(year, month));
}

/** "2026-02" → first day. */
export function monthStart(key: string): IsoDate {
  if (!/^\d{4}-\d{2}$/.test(key)) throw new DateError(`Not a month: "${key}"`);
  return startOfMonth(`${key}-01`);
}

/** Every month key from `from` to `to`, inclusive, in order. */
export function monthsBetween(from: IsoDate, to: IsoDate): string[] {
  const keys: string[] = [];
  for (
    let cursor = startOfMonth(from);
    cursor <= to;
    cursor = addMonths(cursor, 1)
  ) {
    keys.push(monthKey(cursor));
  }
  return keys;
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: IsoDate): number {
  // 1970-01-01 was a Thursday.
  return (((toDayNumber(date) + 4) % 7) + 7) % 7;
}

/** Today in the given timezone (the browser's by default), as a date. */
export function today(timeZone?: string, now: Date = new Date()): IsoDate {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  // en-CA formats as YYYY-MM-DD.
  parts(formatted);
  return formatted;
}

export const minDate = (a: IsoDate, b: IsoDate): IsoDate => (a <= b ? a : b);
export const maxDate = (a: IsoDate, b: IsoDate): IsoDate => (a >= b ? a : b);
