import { addDays, addMonths, type IsoDate } from "./dates";
import type { RateRow } from "./fx";

/**
 * Exchange rates over time: the series behind the rate graph, and what to
 * fetch so that series is there without anyone asking for it.
 *
 * A rate here is always "units of the other currency per one of the base",
 * the way the Rates list shows it.
 */

export type RateRangeId = "1m" | "3m" | "6m" | "1y";

export const RATE_RANGES: readonly {
  id: RateRangeId;
  label: string;
  name: string;
  months: number;
}[] = [
  { id: "1m", label: "1M", name: "1 month", months: 1 },
  { id: "3m", label: "3M", name: "3 months", months: 3 },
  { id: "6m", label: "6M", name: "6 months", months: 6 },
  { id: "1y", label: "1Y", name: "1 year", months: 12 },
];

/** The longest range on offer; history is kept at least this far back. */
const LONGEST_MONTHS = 12;

/** The first day of a range that ends today. */
export function rangeStart(range: RateRangeId, today: IsoDate): IsoDate {
  const months = RATE_RANGES.find((r) => r.id === range)!.months;
  return addMonths(today, -months);
}

export interface RatePoint {
  date: IsoDate;
  rate: number;
}

const usable = (rate: number) => Number.isFinite(rate) && rate > 0;

/**
 * `quote` per one `base`, a point per day that has a rate, oldest first.
 * A rate stored the other way round is inverted; the direct one wins when a
 * day has both.
 */
export function rateHistory(
  rows: readonly RateRow[],
  base: string,
  quote: string,
  from: IsoDate,
  to: IsoDate,
): RatePoint[] {
  const byDate = new Map<IsoDate, { rate: number; direct: boolean }>();
  for (const row of rows) {
    if (row.asOf < from || row.asOf > to || !usable(row.rate)) continue;
    const direct = row.base === base && row.quote === quote;
    const inverse = row.base === quote && row.quote === base;
    if (!direct && !inverse) continue;
    if (!direct && byDate.get(row.asOf)?.direct) continue;
    byDate.set(row.asOf, { rate: direct ? row.rate : 1 / row.rate, direct });
  }
  return [...byDate]
    .map(([date, { rate }]) => ({ date, rate }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface RateSummary {
  first: number;
  last: number;
  low: number;
  high: number;
  /** Change from the first rate to the last, in percent. */
  changePct: number;
}

/** Where the rate went over a series; null with fewer than two points. */
export function rateSummary(points: readonly RatePoint[]): RateSummary | null {
  if (points.length < 2) return null;
  const rates = points.map((p) => p.rate);
  const first = rates[0];
  const last = rates[rates.length - 1];
  return {
    first,
    last,
    low: Math.min(...rates),
    high: Math.max(...rates),
    changePct: ((last - first) / first) * 100,
  };
}

/**
 * What to fetch so every currency in use has rates up to today and a year
 * back: the currencies that are behind, and the earliest date any of them
 * needs. Null when everything is there.
 *
 * A currency with less than a year stored is fetched for the whole year;
 * one that is only missing recent days is fetched from the day after its
 * last rate. `quotes` are the currencies the source publishes.
 */
export function rateSyncPlan({
  base,
  quotes,
  rows,
  today,
}: {
  base: string;
  quotes: readonly string[];
  rows: readonly RateRow[];
  today: IsoDate;
}): { quotes: string[]; from: IsoDate } | null {
  const yearAgo = addMonths(today, -LONGEST_MONTHS);
  // Rates are published on working days, so the oldest stored one may sit a
  // few days inside the year without anything being missing.
  const yearCovered = addDays(yearAgo, 7);
  const behind: string[] = [];
  let from: IsoDate | null = null;
  for (const quote of quotes) {
    if (quote === base) continue;
    const dates = rows
      .filter((r) => r.base === base && r.quote === quote)
      .map((r) => r.asOf)
      .sort();
    let need: IsoDate | null = null;
    if (dates.length === 0 || dates[0] > yearCovered) need = yearAgo;
    else if (dates[dates.length - 1] < today)
      need = addDays(dates[dates.length - 1], 1);
    if (!need) continue;
    behind.push(quote);
    if (!from || need < from) from = need;
  }
  return from ? { quotes: behind, from } : null;
}
