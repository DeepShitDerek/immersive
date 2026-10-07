import type { Account, Transaction } from "@/features/money/domain/ledger";
import { toMajor } from "@/features/money/domain/money";

/**
 * Ledger expenses an inventory item can be linked to: the
 * `transaction_id` column ("the ledger transaction that bought it") had no UI.
 */
export interface PurchaseOption {
  id: string;
  date: string;
  description: string;
  /** What left the account, positive, in major units. */
  amount: number;
  currency: string;
}

export function purchaseOptions(
  transactions: readonly Transaction[],
  accountById: ReadonlyMap<string, Pick<Account, "currency">>,
): PurchaseOption[] {
  const options: PurchaseOption[] = [];
  for (const t of transactions) {
    if (t.kind !== "expense") continue;
    const outflows = t.postings.filter(
      (p) => p.amountMinor < 0 && accountById.has(p.accountId),
    );
    if (outflows.length === 0) continue;
    const currency = accountById.get(outflows[0].accountId)!.currency;
    // A purchase paid from two accounts in different currencies has no single
    // price; it is still linkable, priced by its first leg.
    const minor = outflows
      .filter((p) => accountById.get(p.accountId)!.currency === currency)
      .reduce((sum, p) => sum - p.amountMinor, 0);
    options.push({
      id: t.id,
      date: t.date,
      description: t.payee ? `${t.description} — ${t.payee}` : t.description,
      amount: toMajor({ minor, currency }),
      currency,
    });
  }
  return options.sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );
}
