import type { IsoDate } from "./dates";
import type { Transaction, TransactionKind, TransactionStatus } from "./ledger";
import { normaliseText } from "./rules";

/**
 * Finding transactions. Pure, so the register, reports and the
 * import preview all mean the same thing by "uncategorised" or "in March".
 */

export interface TransactionFilter {
  accountId?: string | null;
  /** A category id, "none" for uncategorised, or null for any. */
  categoryId?: string | null;
  /** When set, a parent category also matches its children. */
  childrenOf?: ReadonlyMap<string, string[]>;
  kind?: TransactionKind | null;
  status?: TransactionStatus | null;
  from?: IsoDate | null;
  to?: IsoDate | null;
  text?: string;
}

/** Whether any spending/earning line lacks a category. Transfer legs never need one. */
export function isUncategorised(
  txn: Pick<Transaction, "kind" | "postings">,
): boolean {
  if (txn.kind === "transfer" || txn.kind === "adjustment") return false;
  return txn.postings.some((p) => p.categoryId == null);
}

function matchesFilter(txn: Transaction, filter: TransactionFilter): boolean {
  if (filter.from && txn.date < filter.from) return false;
  if (filter.to && txn.date > filter.to) return false;
  if (filter.kind && txn.kind !== filter.kind) return false;
  if (filter.status && txn.status !== filter.status) return false;
  if (
    filter.accountId &&
    !txn.postings.some((p) => p.accountId === filter.accountId)
  )
    return false;
  if (filter.categoryId === "none") {
    if (!isUncategorised(txn)) return false;
  } else if (filter.categoryId) {
    const wanted = new Set([
      filter.categoryId,
      ...(filter.childrenOf?.get(filter.categoryId) ?? []),
    ]);
    if (!txn.postings.some((p) => p.categoryId && wanted.has(p.categoryId)))
      return false;
  }
  const text = normaliseText(filter.text ?? "");
  if (text) {
    const haystack = normaliseText(
      [
        txn.description,
        txn.payee ?? "",
        txn.notes ?? "",
        txn.provider ?? "",
        ...txn.postings.map((p) => p.memo ?? ""),
      ].join(" "),
    );
    // Every word must appear, in any order: "tim coffee" finds "TIM HORTONS coffee".
    if (!text.split(" ").every((word) => haystack.includes(word))) return false;
  }
  return true;
}

export function filterTransactions(
  transactions: readonly Transaction[],
  filter: TransactionFilter,
): Transaction[] {
  return transactions.filter((txn) => matchesFilter(txn, filter));
}

/** Parent id → child ids, for `childrenOf`. */
export function childrenIndex(
  categories: readonly { id: string; parentId: string | null }[],
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const c of categories) {
    if (!c.parentId) continue;
    index.set(c.parentId, [...(index.get(c.parentId) ?? []), c.id]);
  }
  return index;
}
