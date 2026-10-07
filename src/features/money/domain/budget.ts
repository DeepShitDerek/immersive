import {
  addMonths,
  endOfMonth,
  type IsoDate,
  monthKey,
  monthStart,
} from "./dates";
import { periodFlows } from "./flows";
import type { Transaction } from "./ledger";
import type { Bucket, Category } from "./model";

/**
 * Budgets. A budget is set on a top-level category and covers its
 * subcategories too — "Food: $600" includes Groceries and Restaurants — so
 * nothing can be counted under two budgets.
 *
 * A budget row applies from its month until the next row for that category.
 * With `rollover`, what was left (or overspent) carries into the next month,
 * for as long as rollover rows stay in force; a row without it starts clean.
 * Amounts are in the base currency, like the spending they are compared to.
 */

export interface Budget {
  id: string;
  categoryId: string;
  /** "YYYY-MM-01". */
  fromMonth: IsoDate;
  amountMinor: number;
  rollover: boolean;
}

/** The row in force for a category in a month, or null. */
export function budgetInForce(
  budgets: readonly Budget[],
  categoryId: string,
  month: string,
): Budget | null {
  const first = monthStart(month);
  let best: Budget | null = null;
  for (const budget of budgets) {
    if (budget.categoryId !== categoryId || budget.fromMonth > first) continue;
    if (!best || budget.fromMonth > best.fromMonth) best = budget;
  }
  return best && best.amountMinor > 0 ? best : null;
}

export type BudgetChange =
  | { kind: "none" }
  | { kind: "save"; budget: Omit<Budget, "id"> }
  | { kind: "delete"; id: string };

/**
 * What to write when a category's budget is set to `amountMinor` in `month`.
 * Zero means no budget. Clearing a budget that began this month removes its
 * row, unless an earlier budget would come back into force; then, and when
 * the budget began earlier, a zero from this month ends it and leaves the
 * months before as they were.
 */
export function budgetChange(
  budgets: readonly Budget[],
  categoryId: string,
  month: string,
  amountMinor: number,
  rollover: boolean,
): BudgetChange {
  const fromMonth = monthStart(month);
  const current = budgetInForce(budgets, categoryId, month);
  if (!current && amountMinor === 0) return { kind: "none" };
  if (
    current &&
    current.amountMinor === amountMinor &&
    current.rollover === rollover
  )
    return { kind: "none" };
  if (current && amountMinor === 0 && current.fromMonth === fromMonth) {
    const without = budgets.filter((b) => b.id !== current.id);
    if (!budgetInForce(without, categoryId, month))
      return { kind: "delete", id: current.id };
  }
  return {
    kind: "save",
    budget: { categoryId, fromMonth, amountMinor, rollover },
  };
}

/** Spending per top-level category for a month (children rolled up), base currency. */
export function spendingByRoot(
  transactions: readonly Pick<
    Transaction,
    "date" | "kind" | "status" | "postings"
  >[],
  categories: readonly Pick<Category, "id" | "parentId">[],
  month: string,
): Map<string | null, number> {
  const first = monthStart(month);
  const flows = periodFlows(transactions, first, endOfMonth(first));
  const parentOf = new Map(categories.map((c) => [c.id, c.parentId]));
  const byRoot = new Map<string | null, number>();
  for (const [categoryId, amount] of flows.spendingByCategory) {
    const root = categoryId ? (parentOf.get(categoryId) ?? categoryId) : null;
    byRoot.set(root, (byRoot.get(root) ?? 0) + amount);
  }
  return byRoot;
}

export interface BudgetLine {
  categoryId: string;
  budgetMinor: number;
  /** Carried in from earlier months (positive = unspent). */
  carriedMinor: number;
  spentMinor: number;
  /** budget + carried − spent. */
  leftMinor: number;
  /** spent / (budget + carried), for a bar; > 1 is over. */
  ratio: number;
}

/**
 * Every budgeted category's month: budget, what rolled in, spent, left.
 * `spendingFor(month)` supplies spending by root category, memoised by the
 * caller if it likes; rollover walks back to where the rollover began.
 */
export function monthBudget(
  budgets: readonly Budget[],
  month: string,
  spendingFor: (month: string) => ReadonlyMap<string | null, number>,
): BudgetLine[] {
  const lines: BudgetLine[] = [];
  const categories = [...new Set(budgets.map((b) => b.categoryId))];
  for (const categoryId of categories) {
    const current = budgetInForce(budgets, categoryId, month);
    if (!current) continue;
    const carried = current.rollover
      ? carryInto(budgets, categoryId, month, spendingFor)
      : 0;
    const spent = spendingFor(month).get(categoryId) ?? 0;
    const available = current.amountMinor + carried;
    lines.push({
      categoryId,
      budgetMinor: current.amountMinor,
      carriedMinor: carried,
      spentMinor: spent,
      leftMinor: available - spent,
      ratio: available > 0 ? spent / available : spent > 0 ? Infinity : 0,
    });
  }
  return lines;
}

/** Sum of (budget − spent) over the unbroken run of rollover months before `month`. */
function carryInto(
  budgets: readonly Budget[],
  categoryId: string,
  month: string,
  spendingFor: (month: string) => ReadonlyMap<string | null, number>,
): number {
  let carry = 0;
  // Walk back to the start of the rollover run, at most ten years.
  const months: string[] = [];
  for (let i = 1; i <= 120; i += 1) {
    const earlier = monthKey(addMonths(monthStart(month), -i));
    const row = budgetInForce(budgets, categoryId, earlier);
    if (!row || !row.rollover) break;
    months.unshift(earlier);
  }
  for (const m of months) {
    const row = budgetInForce(budgets, categoryId, m)!;
    carry += row.amountMinor - (spendingFor(m).get(categoryId) ?? 0);
  }
  return carry;
}

export interface BucketSplit {
  incomeMinor: number;
  needMinor: number;
  wantMinor: number;
  /** Spending put in "save" categories plus whatever income was not spent. */
  savedMinor: number;
  /** Shares of income, or null without income. */
  shares: Record<"need" | "want" | "save", number> | null;
  uncategorisedMinor: number;
}

/** The 50/30/20 picture of a month: needs, wants and saved, as shares of income. */
export function bucketSplit(
  transactions: readonly Pick<
    Transaction,
    "date" | "kind" | "status" | "postings"
  >[],
  categories: readonly Pick<Category, "id" | "bucket">[],
  month: string,
): BucketSplit {
  const first = monthStart(month);
  const flows = periodFlows(transactions, first, endOfMonth(first));
  const bucketOf = new Map(categories.map((c) => [c.id, c.bucket as Bucket]));
  let need = 0;
  let want = 0;
  let uncategorised = 0;
  for (const [categoryId, amount] of flows.spendingByCategory) {
    const bucket = categoryId ? bucketOf.get(categoryId) : undefined;
    if (bucket === "need") need += amount;
    // "save" spending (into a savings category) is part of what was saved.
    else if (bucket === "save") continue;
    else if (bucket === "want") want += amount;
    else uncategorised += amount;
  }
  // Uncategorised spending counts as a want: it was spent, just not sorted.
  want += uncategorised;
  const income = flows.incomeMinor;
  const saved = income - need - want;
  return {
    incomeMinor: income,
    needMinor: need,
    wantMinor: want,
    savedMinor: saved,
    shares:
      income > 0
        ? { need: need / income, want: want / income, save: saved / income }
        : null,
    uncategorisedMinor: uncategorised,
  };
}
