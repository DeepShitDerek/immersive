import type { Account, Transaction } from "./ledger";
import type { Category } from "./model";
import { categoryLabel } from "./categories";
import { toInputString } from "./money";

/**
 * The register as CSV, one row per posting: a transfer is two rows,
 * a split is one per category, so a spreadsheet can sum any column honestly.
 * Amounts are exact decimals in the account's own currency, never converted.
 */
const HEADER = [
  "date",
  "description",
  "payee",
  "kind",
  "status",
  "account",
  "category",
  "amount",
  "currency",
  "memo",
  "notes",
  "transaction_id",
];

/**
 * Quote for CSV, and defuse text a spreadsheet would run as a formula
 * (a payee of `=HYPERLINK(...)` from an imported statement).
 */
export function csvCell(
  value: string | number | null | undefined,
  text = true,
): string {
  let s = value == null ? "" : String(value);
  if (text && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ledgerCsv(
  transactions: readonly Transaction[],
  accountById: ReadonlyMap<string, Pick<Account, "name" | "currency">>,
  categoryById: ReadonlyMap<string, Category>,
): string {
  const rows = [HEADER.join(",")];
  for (const t of transactions) {
    for (const p of t.postings) {
      const account = accountById.get(p.accountId);
      const currency = account?.currency ?? "";
      rows.push(
        [
          csvCell(t.date),
          csvCell(t.description),
          csvCell(t.payee),
          csvCell(t.kind),
          csvCell(t.status),
          csvCell(account?.name ?? "Unknown account"),
          csvCell(categoryLabel(p.categoryId, categoryById)),
          csvCell(
            currency
              ? toInputString({ minor: p.amountMinor, currency })
              : p.amountMinor,
            false,
          ),
          csvCell(currency),
          csvCell(p.memo),
          csvCell(t.notes),
          csvCell(t.id),
        ].join(","),
      );
    }
  }
  // CRLF per RFC 4180; Excel and Numbers both read it.
  return rows.join("\r\n") + "\r\n";
}
