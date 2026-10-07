import {
  addDays,
  addMonths,
  daysBetween,
  daysInMonth,
  type IsoDate,
  makeDate,
  maxDate,
  minDate,
  monthOf,
  yearOf,
  dayOf,
} from "./dates";
import { priceInBase, type RateTable } from "./fx";
import type { Account, Posting, Transaction } from "./ledger";
import { money } from "./money";

/**
 * Recurring schedules: which days something is due, what is still
 * waiting to be recorded, and the transaction a due occurrence becomes.
 *
 * Month-based schedules are anchored to the start date's day, so "the 31st"
 * clamps to Feb 28 and comes back to Mar 31 instead of drifting to the 28th
 * for ever. Semi-monthly pay uses two days of the month; 31 means "the last
 * day", whatever the month.
 */

export const FREQUENCIES = [
  "once",
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "quarterly",
  "yearly",
] as const;
export type Frequency = (typeof FREQUENCIES)[number];
export type ScheduleKind = "expense" | "income" | "transfer";

export interface Schedule {
  id: string;
  name: string;
  kind: ScheduleKind;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  /** Positive, in the account's currency. */
  amountMinor: number;
  toAmountMinor: number | null;
  isEstimate: boolean;
  frequency: Frequency;
  startDate: IsoDate;
  endDate: IsoDate | null;
  dayOne: number | null;
  dayTwo: number | null;
  payee: string | null;
  notes: string | null;
  archivedAt: string | null;
}

/** Enough for a pathological schedule to stop rather than spin. */
const MAX_OCCURRENCES = 5000;

function clampDay(year: number, month: number, day: number): IsoDate {
  return makeDate(year, month, Math.min(day, daysInMonth(year, month)));
}

/** Every due date from `from` to `to` inclusive, oldest first. */
export function occurrences(
  schedule: Pick<
    Schedule,
    "frequency" | "startDate" | "endDate" | "dayOne" | "dayTwo"
  >,
  from: IsoDate,
  to: IsoDate,
): IsoDate[] {
  const start = schedule.startDate;
  const last = schedule.endDate ? minDate(schedule.endDate, to) : to;
  const first = maxDate(start, from);
  if (first > last) return [];
  const out: IsoDate[] = [];
  const push = (date: IsoDate) => {
    if (date >= first && date <= last && out.length < MAX_OCCURRENCES)
      out.push(date);
  };

  switch (schedule.frequency) {
    case "once":
      push(start);
      break;
    case "weekly":
    case "biweekly": {
      const step = schedule.frequency === "weekly" ? 7 : 14;
      // Jump straight to the first occurrence at or after `first`.
      const skip = Math.max(0, Math.ceil(daysBetween(start, first) / step));
      for (
        let k = skip, date = addDays(start, skip * step);
        date <= last && out.length < MAX_OCCURRENCES;
        k += 1, date = addDays(start, k * step)
      ) {
        push(date);
      }
      break;
    }
    case "monthly":
    case "quarterly":
    case "yearly": {
      const step =
        schedule.frequency === "monthly"
          ? 1
          : schedule.frequency === "quarterly"
            ? 3
            : 12;
      const anchor = dayOf(start);
      const monthsIn =
        (yearOf(first) - yearOf(start)) * 12 +
        (monthOf(first) - monthOf(start));
      const skip = Math.max(0, Math.floor(monthsIn / step) - 1);
      for (let k = skip; out.length < MAX_OCCURRENCES; k += 1) {
        const date = addMonths(start, k * step, anchor);
        if (date > last) break;
        push(date);
      }
      break;
    }
    case "semimonthly": {
      const days = [schedule.dayOne ?? 1, schedule.dayTwo ?? 15].sort(
        (a, b) => a - b,
      );
      let year = yearOf(first);
      let month = monthOf(first);
      while (out.length < MAX_OCCURRENCES) {
        const firstOfMonth = makeDate(year, month, 1);
        if (firstOfMonth > last) break;
        for (const day of days) push(clampDay(year, month, day));
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
      }
      break;
    }
  }
  return out;
}

export function nextOccurrence(
  schedule: Schedule,
  after: IsoDate,
): IsoDate | null {
  return (
    occurrences(schedule, addDays(after, 1), addDays(after, 400))[0] ?? null
  );
}

/** Roughly how much this schedule moves per month, for plans and forecasts. */
export function monthlyEquivalent(
  schedule: Pick<Schedule, "frequency" | "amountMinor">,
): number {
  const perYear: Record<Frequency, number> = {
    once: 0,
    weekly: 52,
    biweekly: 26,
    semimonthly: 24,
    monthly: 12,
    quarterly: 4,
    yearly: 1,
  };
  return Math.round((schedule.amountMinor * perYear[schedule.frequency]) / 12);
}

type DueStatus = "overdue" | "today" | "upcoming";

export interface DueItem {
  schedule: Schedule;
  dueDate: IsoDate;
  status: DueStatus;
}

/**
 * What is waiting to be recorded: occurrences from `lookBackDays` ago to
 * `lookAheadDays` ahead that have neither a transaction nor a skip. The
 * look-back is deliberate — a rent schedule started two years ago should not
 * greet a new user with twenty-four overdue payments.
 */
export function dueQueue(
  schedules: readonly Schedule[],
  transactions: readonly Pick<Transaction, "scheduleId" | "occurrenceDate">[],
  skips: ReadonlySet<string>,
  today: IsoDate,
  {
    lookBackDays = 45,
    lookAheadDays = 14,
    openingDate,
  }: {
    lookBackDays?: number;
    lookAheadDays?: number;
    openingDate?: (accountId: string) => IsoDate | undefined;
  } = {},
): DueItem[] {
  const recorded = new Set(
    transactions
      .filter((t) => t.scheduleId && t.occurrenceDate)
      .map((t) => `${t.scheduleId}|${t.occurrenceDate}`),
  );
  const items: DueItem[] = [];
  for (const schedule of schedules) {
    if (schedule.archivedAt) continue;
    const opened = openingDate?.(schedule.accountId);
    const from = opened
      ? maxDate(opened, addDays(today, -lookBackDays))
      : addDays(today, -lookBackDays);
    for (const dueDate of occurrences(
      schedule,
      from,
      addDays(today, lookAheadDays),
    )) {
      const key = `${schedule.id}|${dueDate}`;
      if (recorded.has(key) || skips.has(key)) continue;
      items.push({
        schedule,
        dueDate,
        status:
          dueDate < today
            ? "overdue"
            : dueDate === today
              ? "today"
              : "upcoming",
      });
    }
  }
  return items.sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      a.schedule.name.localeCompare(b.schedule.name),
  );
}

export const skipKey = (scheduleId: string, dueDate: IsoDate) =>
  `${scheduleId}|${dueDate}`;

export interface OccurrenceDraft {
  date: IsoDate;
  kind: ScheduleKind;
  description: string;
  payee: string | null;
  scheduleId: string;
  occurrenceDate: IsoDate;
  postings: Posting[];
}

/**
 * The transaction a due occurrence becomes, dated the day it was due (the
 * form lets the owner change the date and amount before saving).
 */
export function draftFromOccurrence(
  schedule: Schedule,
  dueDate: IsoDate,
  accounts: ReadonlyMap<string, Pick<Account, "currency">>,
  base: string,
  rates: RateTable,
  date: IsoDate = dueDate,
): OccurrenceDraft | null {
  const from = accounts.get(schedule.accountId);
  if (!from) return null;
  const priced = (amount: number, currency: string) => {
    const price = priceInBase(money(amount, currency), base, date, rates);
    return {
      fxRate: price?.fxRate ?? null,
      baseAmountMinor: price?.baseAmountMinor ?? null,
    };
  };
  const postings: Posting[] = [];
  if (schedule.kind === "transfer") {
    const to = schedule.toAccountId
      ? accounts.get(schedule.toAccountId)
      : undefined;
    if (!to) return null;
    const arriving =
      from.currency === to.currency
        ? schedule.amountMinor
        : schedule.toAmountMinor;
    if (!arriving) return null;
    postings.push({
      accountId: schedule.accountId,
      categoryId: null,
      amountMinor: -schedule.amountMinor,
      ...priced(-schedule.amountMinor, from.currency),
    });
    postings.push({
      accountId: schedule.toAccountId!,
      categoryId: null,
      amountMinor: arriving,
      ...priced(arriving, to.currency),
    });
  } else {
    const signed =
      schedule.kind === "expense"
        ? -schedule.amountMinor
        : schedule.amountMinor;
    postings.push({
      accountId: schedule.accountId,
      categoryId: schedule.categoryId,
      amountMinor: signed,
      ...priced(signed, from.currency),
    });
  }
  return {
    date,
    kind: schedule.kind,
    description: schedule.name,
    payee: schedule.payee,
    scheduleId: schedule.id,
    occurrenceDate: dueDate,
    postings,
  };
}
