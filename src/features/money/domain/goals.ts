import { addDays, addMonths, daysBetween, type IsoDate } from "./dates";
import type { RateTable } from "./fx";
import { balances, type Account, type Transaction } from "./ledger";
import { convert, money } from "./money";

/**
 * Savings goals. A goal is funded by the accounts set aside for it;
 * its progress is their balance in the goal's currency, never a number
 * typed in. From that: how much is left, what saving per month reaches the
 * target date, and — from how those balances actually moved over the last
 * three months — when it will really be reached at the current pace.
 */

export interface Goal {
  id: string;
  name: string;
  targetMinor: number;
  currency: string;
  targetDate: IsoDate | null;
  accountIds: string[];
  notes: string | null;
  achievedAt: string | null;
  archivedAt: string | null;
}

/**
 * Goals by where they stand. An archived goal is only archived, whether or
 * not it was reached first, so each goal is listed once.
 */
export function groupGoals(goals: readonly Goal[]): {
  active: Goal[];
  achieved: Goal[];
  archived: Goal[];
} {
  return {
    active: goals.filter((g) => !g.archivedAt && !g.achievedAt),
    achieved: goals
      .filter((g) => !g.archivedAt && g.achievedAt)
      .sort((a, b) => b.achievedAt!.localeCompare(a.achievedAt!)),
    archived: goals.filter((g) => g.archivedAt),
  };
}

export interface GoalProgress {
  savedMinor: number;
  remainingMinor: number;
  /** 0–1. */
  ratio: number;
  /** Whole months until the target date (at least 1), or null without one. */
  monthsLeft: number | null;
  /** Saving per month that reaches the target on its date. */
  requiredPerMonthMinor: number | null;
  /** Average monthly growth of the linked balances over the last 90 days. */
  pacePerMonthMinor: number;
  /** When the target is reached at that pace, or null if it is not growing. */
  projectedDate: IsoDate | null;
  /** Linked balances that could not be converted into the goal's currency. */
  unpricedAccounts: number;
}

function linkedTotal(
  goal: Goal,
  accounts: readonly Pick<Account, "id" | "currency" | "openingBalanceMinor">[],
  transactions: readonly Pick<Transaction, "date" | "status" | "postings">[],
  on: IsoDate,
  rates: RateTable,
): { total: number; unpriced: number } {
  const linked = accounts.filter((a) => goal.accountIds.includes(a.id));
  const at = balances(linked, transactions, on);
  let total = 0;
  let unpriced = 0;
  for (const account of linked) {
    const balance = at.get(account.id)?.balanceMinor ?? 0;
    const quote = rates.quote(account.currency, goal.currency, on);
    if (!quote) {
      if (balance !== 0) unpriced += 1;
      continue;
    }
    total += convert(
      money(balance, account.currency),
      quote.rate,
      goal.currency,
    ).minor;
  }
  return { total, unpriced };
}

export function goalProgress(
  goal: Goal,
  accounts: readonly Pick<Account, "id" | "currency" | "openingBalanceMinor">[],
  transactions: readonly Pick<Transaction, "date" | "status" | "postings">[],
  today: IsoDate,
  rates: RateTable,
): GoalProgress {
  const now = linkedTotal(goal, accounts, transactions, today, rates);
  const before = linkedTotal(
    goal,
    accounts,
    transactions,
    addDays(today, -90),
    rates,
  );
  const saved = Math.max(0, now.total);
  const remaining = Math.max(0, goal.targetMinor - saved);

  let monthsLeft: number | null = null;
  if (goal.targetDate) {
    const days = daysBetween(today, goal.targetDate);
    monthsLeft = Math.max(1, Math.ceil(days / 30.4375));
  }
  const pace = Math.round(((now.total - before.total) / 90) * 30.4375);
  let projected: IsoDate | null = null;
  if (remaining === 0) projected = today;
  else if (pace > 0) projected = addMonths(today, Math.ceil(remaining / pace));

  return {
    savedMinor: saved,
    remainingMinor: remaining,
    ratio: Math.min(1, saved / goal.targetMinor),
    monthsLeft,
    requiredPerMonthMinor:
      monthsLeft === null ? null : Math.ceil(remaining / monthsLeft),
    pacePerMonthMinor: pace,
    projectedDate: projected,
    unpricedAccounts: now.unpriced,
  };
}
