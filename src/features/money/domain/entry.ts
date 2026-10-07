import type { IsoDate } from "./dates";
import { isIsoDate } from "./dates";
import { priceInBase, type RateTable } from "./fx";
import {
  type Account,
  type Posting,
  type Transaction,
  type TransactionKind,
  validateTransaction,
} from "./ledger";
import {
  convert,
  money,
  MoneyError,
  parseAmount,
  toInputString,
} from "./money";

/**
 * The transaction form's arithmetic: what the owner typed → a
 * validated, priced draft, and a saved transaction → what the form shows.
 *
 * Amounts are typed as positive numbers; the kind decides the sign, so
 * nobody has to remember that an expense is negative. Every posting is
 * priced into the base currency at the transaction's date, frozen.
 */

export type EntryKind = Exclude<TransactionKind, "adjustment">;

interface EntryLine {
  categoryId: string | null;
  amount: string;
  memo: string;
}

export interface EntryForm {
  kind: EntryKind;
  date: IsoDate;
  description: string;
  payee: string;
  notes: string;
  pending: boolean;
  /** expense / income / refund */
  accountId: string;
  lines: EntryLine[];
  /** transfer */
  fromAccountId: string;
  toAccountId: string;
  amountOut: string;
  /** Only when the two accounts' currencies differ. */
  amountIn: string;
  fee: string;
  feeCategoryId: string | null;
  provider: string;
  marketRate: string;
}

export const emptyEntry = (date: IsoDate, accountId = ""): EntryForm => ({
  kind: "expense",
  date,
  description: "",
  payee: "",
  notes: "",
  pending: false,
  accountId,
  lines: [{ categoryId: null, amount: "", memo: "" }],
  fromAccountId: accountId,
  toAccountId: "",
  amountOut: "",
  amountIn: "",
  fee: "",
  feeCategoryId: null,
  provider: "",
  marketRate: "",
});

export interface EntryDraft {
  date: IsoDate;
  kind: TransactionKind;
  status: "pending" | "cleared";
  description: string;
  payee: string | null;
  notes: string | null;
  provider: string | null;
  marketRate: number | null;
  postings: Posting[];
}

type AccountInfo = Pick<Account, "id" | "currency" | "openingDate">;

/** A positive amount in `currency`, or a message. */
function positive(
  text: string,
  currency: string,
  what: string,
): number | string {
  if (!text.trim()) return `Enter ${what}.`;
  try {
    const { minor } = parseAmount(text, currency);
    if (minor <= 0)
      return `${what[0].toUpperCase()}${what.slice(1)} has to be more than zero.`;
    return minor;
  } catch (error) {
    return error instanceof MoneyError
      ? `${what[0].toUpperCase()}${what.slice(1)}: ${error.message}`
      : "Unreadable amount.";
  }
}

function priced(
  amountMinor: number,
  currency: string,
  base: string,
  date: IsoDate,
  rates: RateTable,
) {
  const price = isIsoDate(date)
    ? priceInBase(money(amountMinor, currency), base, date, rates)
    : null;
  return {
    fxRate: price?.fxRate ?? null,
    baseAmountMinor: price?.baseAmountMinor ?? null,
  };
}

export function buildDraft(
  form: EntryForm,
  accounts: ReadonlyMap<string, AccountInfo>,
  base: string,
  rates: RateTable,
): { draft: EntryDraft | null; problems: string[] } {
  const problems: string[] = [];
  if (!isIsoDate(form.date)) problems.push("Choose a date.");
  const postings: Posting[] = [];
  let marketRate: number | null = null;

  if (form.kind === "transfer") {
    const from = accounts.get(form.fromAccountId);
    const to = accounts.get(form.toAccountId);
    if (!from || !to)
      problems.push("Choose where the money comes from and where it goes.");
    else if (from.id === to.id) problems.push("Choose two different accounts.");
    else {
      const out = positive(form.amountOut, from.currency, "the amount sent");
      const cross = from.currency !== to.currency;
      const inn = cross
        ? positive(form.amountIn, to.currency, "the amount received")
        : out;
      if (typeof out === "string") problems.push(out);
      if (cross && typeof inn === "string") problems.push(inn);
      if (typeof out === "number" && typeof inn === "number") {
        postings.push({
          accountId: from.id,
          categoryId: null,
          amountMinor: -out,
          ...priced(-out, from.currency, base, form.date, rates),
        });
        postings.push({
          accountId: to.id,
          categoryId: null,
          amountMinor: inn,
          ...priced(inn, to.currency, base, form.date, rates),
        });
      }
      if (form.fee.trim()) {
        const fee = positive(form.fee, from.currency, "the fee");
        if (typeof fee === "string") problems.push(fee);
        else if (!form.feeCategoryId)
          problems.push("Choose a category for the fee.");
        else {
          postings.push({
            accountId: from.id,
            categoryId: form.feeCategoryId,
            amountMinor: -fee,
            ...priced(-fee, from.currency, base, form.date, rates),
          });
        }
      }
      if (form.marketRate.trim()) {
        const rate = Number(form.marketRate.replace(/,/g, ""));
        if (!Number.isFinite(rate) || rate <= 0)
          problems.push("The market rate has to be a positive number.");
        else if (cross) marketRate = rate;
      }
    }
  } else {
    const account = accounts.get(form.accountId);
    if (!account) problems.push("Choose an account.");
    else {
      const lines = form.lines.filter(
        (line) => line.amount.trim() || line.categoryId,
      );
      if (lines.length === 0) problems.push("Enter an amount.");
      const sign = form.kind === "expense" ? -1 : 1;
      for (const [index, line] of lines.entries()) {
        const amount = positive(
          line.amount,
          account.currency,
          lines.length > 1 ? `the amount on line ${index + 1}` : "an amount",
        );
        if (typeof amount === "string") {
          problems.push(amount);
          continue;
        }
        postings.push({
          accountId: account.id,
          categoryId: line.categoryId,
          amountMinor: sign * amount,
          memo: line.memo.trim() || null,
          ...priced(sign * amount, account.currency, base, form.date, rates),
        });
      }
    }
  }

  const description = form.description.trim() || form.payee.trim();
  const draft: EntryDraft = {
    date: form.date,
    kind: form.kind,
    status: form.pending ? "pending" : "cleared",
    description,
    payee: form.payee.trim() || null,
    notes: form.notes.trim() || null,
    provider: form.kind === "transfer" ? form.provider.trim() || null : null,
    marketRate,
    postings,
  };
  if (problems.length === 0) {
    problems.push(...validateTransaction(draft, accounts));
  }
  return problems.length > 0 ? { draft: null, problems } : { draft, problems };
}

/**
 * A saved transaction back into the form. Returns null for a shape the form
 * cannot show faithfully (an adjustment, or a multi-leg transfer) — those
 * are edited by deleting and re-entering, not by a form that would drop legs.
 */
export function formFromTransaction(
  txn: Transaction,
  accounts: ReadonlyMap<string, AccountInfo>,
): EntryForm | null {
  if (txn.kind === "adjustment") return null;
  const base = emptyEntry(txn.date);
  const common = {
    ...base,
    kind: txn.kind,
    description: txn.description,
    payee: txn.payee ?? "",
    notes: txn.notes ?? "",
    pending: txn.status === "pending",
  };
  const currencyOf = (id: string) => accounts.get(id)?.currency ?? "CAD";
  const text = (minor: number, id: string) =>
    toInputString(money(Math.abs(minor), currencyOf(id)));

  if (txn.kind !== "transfer") {
    const accountId = txn.postings[0]?.accountId ?? "";
    return {
      ...common,
      accountId,
      fromAccountId: accountId,
      lines: txn.postings.map((p) => ({
        categoryId: p.categoryId,
        amount: text(p.amountMinor, p.accountId),
        memo: p.memo ?? "",
      })),
    };
  }

  const legs = txn.postings.filter((p) => p.categoryId == null);
  const fees = txn.postings.filter((p) => p.categoryId != null);
  const out = legs.filter((p) => p.amountMinor < 0);
  const inn = legs.filter((p) => p.amountMinor > 0);
  if (out.length !== 1 || inn.length !== 1 || fees.length > 1) return null;
  if (fees[0] && fees[0].accountId !== out[0].accountId) return null;
  return {
    ...common,
    fromAccountId: out[0].accountId,
    toAccountId: inn[0].accountId,
    accountId: out[0].accountId,
    amountOut: text(out[0].amountMinor, out[0].accountId),
    amountIn:
      currencyOf(out[0].accountId) !== currencyOf(inn[0].accountId)
        ? text(inn[0].amountMinor, inn[0].accountId)
        : "",
    fee: fees[0] ? text(fees[0].amountMinor, fees[0].accountId) : "",
    feeCategoryId: fees[0]?.categoryId ?? null,
    provider: txn.provider ?? "",
    marketRate: txn.marketRate != null ? String(txn.marketRate) : "",
  };
}

/**
 * What the arriving side would get at the known rate — a starting point for
 * the "received" field, which the owner then corrects to what really landed.
 */
export function suggestReceived(
  amountOut: string,
  fromCurrency: string,
  toCurrency: string,
  date: IsoDate,
  rates: RateTable,
): { amount: string; rate: number } | null {
  if (!isIsoDate(date) || fromCurrency === toCurrency) return null;
  const quote = rates.quote(fromCurrency, toCurrency, date);
  if (!quote) return null;
  try {
    const sent = parseAmount(amountOut, fromCurrency);
    if (sent.minor <= 0) return null;
    return {
      amount: toInputString(convert(sent, quote.rate, toCurrency)),
      rate: quote.rate,
    };
  } catch {
    return null;
  }
}
