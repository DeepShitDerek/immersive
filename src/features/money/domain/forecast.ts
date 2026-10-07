import {
  addDays,
  daysInMonth,
  type IsoDate,
  makeDate,
  monthOf,
  yearOf,
} from "./dates";
import type { RateTable } from "./fx";
import type { Account, Balance, Transaction } from "./ledger";
import { convert, money } from "./money";
import { dueQueue, occurrences, type Schedule } from "./schedule";

/**
 * Where the spendable money is heading. Starts from today's
 * balances in the liquid accounts, then plays forward every bill, paycheque
 * and transfer on a schedule — plus any what-if scenarios — day by day.
 *
 * Only what is scheduled is known: day-to-day spending that has no schedule
 * is not in the line, and the screen says so. Occurrences already past
 * are left out — a bill paid from an imported statement is never linked to
 * its schedule, so counting every unlinked one as still to come would sink
 * the line — and are counted in `overdue` for the screen to mention.
 */

export interface Scenario {
  id: string;
  label: string;
  /** Per month, in the base currency: positive adds (a raise), negative takes (rent going up, money sent home). */
  monthlyMinor: number;
  /** Day of the month it lands on (clamped to short months). */
  day: number;
  /** First month it applies, as YYYY-MM-01; null = from now. */
  fromMonth: IsoDate | null;
}

interface ForecastEvent {
  date: IsoDate;
  label: string;
  /** Change to the liquid total, in the base currency. */
  amountMinor: number;
  source: "schedule" | "scenario";
}

interface ForecastDay {
  date: IsoDate;
  balanceMinor: number;
}

export interface Forecast {
  startMinor: number;
  days: ForecastDay[];
  events: ForecastEvent[];
  lowest: ForecastDay;
  /** The first day the total drops below zero, or below the cushion. */
  firstBelowZero: IsoDate | null;
  firstBelowCushion: IsoDate | null;
  endMinor: number;
  /** Past occurrences never recorded against their schedule, left out of the line. */
  overdue: number;
  /** Accounts or schedules left out for want of an exchange rate. */
  unpriced: string[];
}

type LiquidAccount = Pick<
  Account,
  "id" | "name" | "currency" | "isLiquid" | "archivedAt" | "openingDate"
>;

export function forecast(input: {
  today: IsoDate;
  days: number;
  base: string;
  accounts: readonly LiquidAccount[];
  balanceByAccount: ReadonlyMap<string, Balance>;
  schedules: readonly Schedule[];
  transactions: readonly Pick<Transaction, "scheduleId" | "occurrenceDate">[];
  skips: ReadonlySet<string>;
  rates: RateTable;
  scenarios?: readonly Scenario[];
  /** Warn when the total falls below this (base currency). */
  cushionMinor?: number;
}): Forecast {
  const { today, base, rates } = input;
  const end = addDays(today, input.days);
  const unpriced = new Set<string>();
  const liquid = new Map(
    input.accounts
      .filter((a) => a.isLiquid && !a.archivedAt)
      .map((a) => [a.id, a]),
  );
  const toBase = (
    minor: number,
    currency: string,
    label: string,
  ): number | null => {
    if (currency === base) return minor;
    const q = rates.quote(currency, base, today);
    if (!q) {
      unpriced.add(label);
      return null;
    }
    return convert(money(minor, currency), q.rate, base).minor;
  };

  let start = 0;
  for (const account of liquid.values()) {
    const v = toBase(
      input.balanceByAccount.get(account.id)?.balanceMinor ?? 0,
      account.currency,
      account.name,
    );
    if (v !== null) start += v;
  }

  const events: ForecastEvent[] = [];
  const effect = (schedule: Schedule): number | null => {
    const from = liquid.get(schedule.accountId);
    const to = schedule.toAccountId
      ? liquid.get(schedule.toAccountId)
      : undefined;
    let total = 0;
    if (schedule.kind === "income") {
      if (!from) return 0;
      const v = toBase(schedule.amountMinor, from.currency, schedule.name);
      return v === null ? null : v;
    }
    if (from) {
      const v = toBase(-schedule.amountMinor, from.currency, schedule.name);
      if (v === null) return null;
      total += v;
    }
    if (schedule.kind === "transfer" && to) {
      const v = toBase(
        schedule.toAmountMinor ?? schedule.amountMinor,
        to.currency,
        schedule.name,
      );
      if (v === null) return null;
      total += v;
    }
    return total;
  };

  const overdue = dueQueue(
    input.schedules,
    input.transactions,
    input.skips,
    today,
    { lookBackDays: 45, lookAheadDays: 0 },
  ).filter((d) => d.status === "overdue").length;
  // Today's and later occurrences not already recorded or skipped.
  const recorded = new Set(
    input.transactions
      .filter((t) => t.scheduleId && t.occurrenceDate)
      .map((t) => `${t.scheduleId}|${t.occurrenceDate}`),
  );
  for (const schedule of input.schedules) {
    if (schedule.archivedAt) continue;
    const amount = effect(schedule);
    if (!amount) continue;
    for (const date of occurrences(schedule, today, end)) {
      const key = `${schedule.id}|${date}`;
      if (recorded.has(key) || input.skips.has(key)) continue;
      events.push({
        date,
        label: schedule.name,
        amountMinor: amount,
        source: "schedule",
      });
    }
  }
  for (const s of input.scenarios ?? []) {
    if (!s.monthlyMinor) continue;
    let year = yearOf(today);
    let month = monthOf(today);
    for (let i = 0; i < 1 + Math.ceil(input.days / 28); i += 1) {
      const date = makeDate(
        year,
        month,
        Math.min(Math.max(1, s.day), daysInMonth(year, month)),
      );
      if (
        date >= today &&
        date <= end &&
        (!s.fromMonth || date >= s.fromMonth)
      ) {
        events.push({
          date,
          label: s.label,
          amountMinor: s.monthlyMinor,
          source: "scenario",
        });
      }
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }
  events.sort(
    (a, b) => a.date.localeCompare(b.date) || a.amountMinor - b.amountMinor,
  );

  const days: ForecastDay[] = [];
  const cushion = input.cushionMinor ?? 0;
  let running = start;
  let index = 0;
  let lowest: ForecastDay = { date: today, balanceMinor: start };
  let firstBelowZero: IsoDate | null = null;
  let firstBelowCushion: IsoDate | null = null;
  for (let date = today; date <= end; date = addDays(date, 1)) {
    while (index < events.length && events[index].date === date)
      running += events[index++].amountMinor;
    days.push({ date, balanceMinor: running });
    if (running < lowest.balanceMinor) lowest = { date, balanceMinor: running };
    if (running < 0 && !firstBelowZero) firstBelowZero = date;
    if (cushion > 0 && running < cushion && !firstBelowCushion)
      firstBelowCushion = date;
  }
  return {
    startMinor: start,
    days,
    events,
    lowest,
    firstBelowZero,
    firstBelowCushion,
    endMinor: running,
    overdue,
    unpriced: [...unpriced],
  };
}

/** Months the liquid money would last at the average monthly spending; null without spending. */
export function runwayMonths(
  liquidMinor: number,
  avgMonthlySpendingMinor: number,
): number | null {
  if (avgMonthlySpendingMinor <= 0) return null;
  return Math.max(0, liquidMinor) / avgMonthlySpendingMinor;
}
