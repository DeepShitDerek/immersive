import { toLocalISODate } from "@/lib/date-utils";
import { exponentOf } from "./domain/money";
import { occurrences, type Schedule } from "./domain/schedule";

/**
 * What money is *expected* on a day — the money module's one contract with
 * the calendar.
 *
 * `get_calendar_data` summarises money that has already happened; this
 * projects the schedules forward, so the calendar can show the rent due on
 * Thursday as well as yesterday's spending. What a schedule means — which
 * way it moves money, when it is due, that a skipped occurrence is not —
 * belongs to the money module, so the calendar imports this and nothing
 * else from it.
 *
 * **Expected, never actual.** A day that already has real transactions shows
 * both, kept distinguishable by the calendar's `data.expected` flag.
 */

interface ExpectedMoneyItem {
  scheduleId: string;
  name: string;
  /** Always positive; `direction` carries the sign. */
  amountMinor: number;
  direction: "in" | "out";
  currency: string;
}

export interface ExpectedMoneyDay {
  /** Local calendar date, `YYYY-MM-DD`. */
  date: string;
  inMinor: number;
  outMinor: number;
  currency: string;
  items: ExpectedMoneyItem[];
}

/**
 * Expected money per day over a window. A transfer between your own
 * accounts is neither in nor out and is left off, as the reports leave it.
 * Amounts stay in their own currency: a day mixing two keeps the first and
 * counts only what matches it — a calendar cell is not where a converted,
 * mixed-currency total should first appear.
 */
export function expectedMoneyDays({
  schedules,
  currencyOf,
  skips,
  from,
  until,
}: {
  schedules: readonly Schedule[];
  /** The currency of an account, by id. */
  currencyOf: (accountId: string) => string | undefined;
  /** "scheduleId|YYYY-MM-DD" of every skipped occurrence. */
  skips: ReadonlySet<string>;
  from: Date;
  until: Date;
}): ExpectedMoneyDay[] {
  const byDate = new Map<string, ExpectedMoneyDay>();
  const first = toLocalISODate(from);
  const last = toLocalISODate(until);

  for (const schedule of schedules) {
    if (schedule.archivedAt || schedule.kind === "transfer") continue;
    const currency = currencyOf(schedule.accountId);
    if (!currency) continue;
    const direction = schedule.kind === "income" ? "in" : "out";
    for (const date of occurrences(schedule, first, last)) {
      if (skips.has(`${schedule.id}|${date}`)) continue;
      const day: ExpectedMoneyDay = byDate.get(date) ?? {
        date,
        inMinor: 0,
        outMinor: 0,
        currency,
        items: [],
      };
      if (currency !== day.currency) continue;
      if (direction === "in") day.inMinor += schedule.amountMinor;
      else day.outMinor += schedule.amountMinor;
      day.items.push({
        scheduleId: schedule.id,
        name: schedule.name,
        amountMinor: schedule.amountMinor,
        direction,
        currency,
      });
      byDate.set(date, day);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Minor units as the major-unit number the calendar's money summary carries — the exponent from the currency table, never a hard-coded 100. */
export function majorUnits(minor: number, currency: string): number {
  return minor / 10 ** exponentOf(currency);
}
