import type { IsoDate } from "./dates";
import type { Transaction } from "./ledger";

/**
 * What came in and what went out over a period, in the base currency
 *. The same rules as `money_day_flows` in SQL:
 *
 * - income is `income` transactions;
 * - spending is expenses, less refunds, plus the fees on transfers;
 * - a transfer between the owner's own accounts is neither — sending money
 *   to your own NRO account is moving it, not spending it;
 * - pending rows are left out, and an unpriced posting (no rate on its day)
 *   is counted in `unpriced`, never guessed at.
 */

export interface PeriodFlows {
  incomeMinor: number;
  /** Positive = money spent; refunds reduce it. */
  spendingMinor: number;
  /** income − spending. */
  netMinor: number;
  /** Share of income kept (net / income), or null without income. */
  savingsRate: number | null;
  /** Spending per category id (null = uncategorised). */
  spendingByCategory: Map<string | null, number>;
  incomeByCategory: Map<string | null, number>;
  /** Postings that could not be counted for want of an exchange rate. */
  unpriced: number;
}

export function periodFlows(
  transactions: readonly Pick<
    Transaction,
    "date" | "kind" | "status" | "postings"
  >[],
  from: IsoDate,
  to: IsoDate,
): PeriodFlows {
  let income = 0;
  let spending = 0;
  let unpriced = 0;
  const spendingByCategory = new Map<string | null, number>();
  const incomeByCategory = new Map<string | null, number>();

  for (const txn of transactions) {
    if (txn.date < from || txn.date > to || txn.status === "pending") continue;
    if (txn.kind === "adjustment") continue;
    for (const posting of txn.postings) {
      const fee = txn.kind === "transfer" && posting.categoryId != null;
      if (txn.kind === "transfer" && !fee) continue;
      if (posting.baseAmountMinor == null) {
        unpriced += 1;
        continue;
      }
      if (txn.kind === "income") {
        income += posting.baseAmountMinor;
        incomeByCategory.set(
          posting.categoryId,
          (incomeByCategory.get(posting.categoryId) ?? 0) +
            posting.baseAmountMinor,
        );
      } else {
        // expense (negative), refund (positive), fee (negative)
        spending -= posting.baseAmountMinor;
        spendingByCategory.set(
          posting.categoryId,
          (spendingByCategory.get(posting.categoryId) ?? 0) -
            posting.baseAmountMinor,
        );
      }
    }
  }

  const net = income - spending;
  return {
    incomeMinor: income,
    spendingMinor: spending,
    netMinor: net,
    savingsRate: income > 0 ? net / income : null,
    spendingByCategory,
    incomeByCategory,
    unpriced,
  };
}
