import type { IsoDate } from "./dates";
import { type RateTable } from "./fx";
import { convert, type Money, money } from "./money";

/**
 * The ledger: accounts, transactions, postings, and every balance
 * derived from them. Mirrors the `money_*` tables and — for validation —
 * `money_check_transaction` in db/schema.sql rule for rule, so a form can
 * say what is wrong before the database refuses it. `ledger.test.ts` runs
 * the same cases as db/test/20-money.sql.
 *
 * Sign convention: a posting is what happened to its account. Negative
 * leaves, positive arrives; a liability's balance is negative (owed).
 */

export const ACCOUNT_KINDS = [
  "chequing",
  "savings",
  "credit_card",
  "line_of_credit",
  "cash",
  "investment",
  "loan",
  "mortgage",
  "asset",
  "wallet",
] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const REGISTRATIONS = [
  "none",
  "tfsa",
  "rrsp",
  "fhsa",
  "resp",
  "rrif",
  "lira",
  "nre",
  "nro",
  "fcnr",
  "ppf",
  "epf",
] as const;
export type Registration = (typeof REGISTRATIONS)[number];

export const CANADIAN_REGISTRATIONS: readonly Registration[] = [
  "tfsa",
  "rrsp",
  "fhsa",
  "resp",
  "rrif",
  "lira",
];
export const INDIAN_REGISTRATIONS: readonly Registration[] = [
  "nre",
  "nro",
  "fcnr",
  "ppf",
  "epf",
];

const LIABILITY_KINDS: readonly AccountKind[] = [
  "credit_card",
  "line_of_credit",
  "loan",
  "mortgage",
];
export const CREDIT_KINDS: readonly AccountKind[] = [
  "credit_card",
  "line_of_credit",
];

export const isLiability = (kind: AccountKind): boolean =>
  LIABILITY_KINDS.includes(kind);

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  registration: Registration;
  country: string;
  currency: string;
  institutionId: string | null;
  openingBalanceMinor: number;
  openingDate: IsoDate;
  creditLimitMinor: number | null;
  statementDay: number | null;
  paymentDueDay: number | null;
  interestRate: number | null;
  isLiquid: boolean;
  inNetWorth: boolean;
  archivedAt: string | null;
}

export const TRANSACTION_KINDS = [
  "expense",
  "income",
  "refund",
  "transfer",
  "adjustment",
] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];
export type TransactionStatus = "pending" | "cleared" | "reconciled";

export interface Posting {
  accountId: string;
  categoryId: string | null;
  amountMinor: number;
  memo?: string | null;
  /** Frozen at write; both null = unpriced. */
  fxRate: number | null;
  baseAmountMinor: number | null;
}

export interface Transaction {
  id: string;
  date: IsoDate;
  kind: TransactionKind;
  status: TransactionStatus;
  description: string;
  payee: string | null;
  notes: string | null;
  provider: string | null;
  marketRate: number | null;
  scheduleId: string | null;
  occurrenceDate: IsoDate | null;
  importHash: string | null;
  postings: Posting[];
}

/** Why an account's settings are not allowed — same rules as its CHECKs. */
export function validateAccount(
  account: Pick<
    Account,
    | "name"
    | "kind"
    | "registration"
    | "country"
    | "currency"
    | "creditLimitMinor"
    | "statementDay"
    | "paymentDueDay"
  >,
): string[] {
  const problems: string[] = [];
  const name = account.name.trim();
  if (name.length < 1 || name.length > 120)
    problems.push("Give the account a name (up to 120 characters).");
  if (!/^[A-Z]{3}$/.test(account.currency)) problems.push("Choose a currency.");
  if (!/^[A-Z]{2}$/.test(account.country)) problems.push("Choose a country.");
  const credit = CREDIT_KINDS.includes(account.kind);
  if (
    !credit &&
    (account.creditLimitMinor != null ||
      account.statementDay != null ||
      account.paymentDueDay != null)
  ) {
    problems.push(
      "Only cards and lines of credit have a limit, statement day or due day.",
    );
  }
  if (account.creditLimitMinor != null && !(account.creditLimitMinor > 0)) {
    problems.push("A credit limit has to be more than zero.");
  }
  for (const day of [account.statementDay, account.paymentDueDay]) {
    if (day != null && (!Number.isInteger(day) || day < 1 || day > 31)) {
      problems.push("Statement and due days are 1–31.");
      break;
    }
  }
  if (account.registration !== "none") {
    if (
      CANADIAN_REGISTRATIONS.includes(account.registration) &&
      account.country !== "CA"
    ) {
      problems.push(
        `A ${account.registration.toUpperCase()} is a Canadian account.`,
      );
    }
    if (
      INDIAN_REGISTRATIONS.includes(account.registration) &&
      account.country !== "IN"
    ) {
      problems.push(
        `An ${account.registration.toUpperCase()} account is Indian.`,
      );
    }
    if (!["chequing", "savings", "investment", "cash"].includes(account.kind)) {
      problems.push(
        "Only bank, savings, cash or investment accounts can be registered.",
      );
    }
  }
  return problems;
}

/**
 * Why a transaction would be refused — the rules of
 * `money_check_transaction`, worded for a form. Empty means it will save.
 */
export function validateTransaction(
  txn: Pick<
    Transaction,
    "date" | "kind" | "description" | "postings" | "marketRate"
  >,
  accounts: ReadonlyMap<string, Pick<Account, "openingDate" | "currency">>,
): string[] {
  const problems: string[] = [];
  const { postings, kind } = txn;
  const description = txn.description.trim();
  if (description.length < 1 || description.length > 200) {
    problems.push("Describe the transaction (up to 200 characters).");
  }
  if (postings.length === 0)
    return [...problems, "A transaction needs at least one amount."];
  if (postings.length > 50)
    problems.push("At most 50 lines in one transaction.");

  for (const posting of postings) {
    const account = accounts.get(posting.accountId);
    if (!account) {
      problems.push("Choose an account for every line.");
      break;
    }
    if (
      !Number.isSafeInteger(posting.amountMinor) ||
      posting.amountMinor === 0
    ) {
      problems.push("Every line needs an amount other than zero.");
      break;
    }
    if (txn.date < account.openingDate) {
      problems.push(
        `An account can't have transactions before it was opened (${account.openingDate}).`,
      );
      break;
    }
    if ((posting.fxRate == null) !== (posting.baseAmountMinor == null)) {
      problems.push("A line's exchange rate and converted amount go together.");
      break;
    }
  }
  if (txn.marketRate != null && kind !== "transfer") {
    problems.push("Only a transfer has a market rate.");
  }
  if (problems.length > 0) return problems;

  const accountIds = new Set(postings.map((p) => p.accountId));
  const net = postings.reduce((total, p) => total + p.amountMinor, 0);
  const legs = postings.filter((p) => p.categoryId == null);
  const fees = postings.filter((p) => p.categoryId != null);

  switch (kind) {
    case "expense":
      if (accountIds.size !== 1)
        problems.push("An expense comes out of one account.");
      if (net >= 0) problems.push("An expense has to take money out.");
      break;
    case "income":
      if (accountIds.size !== 1)
        problems.push("Income arrives in one account.");
      if (net <= 0) problems.push("Income has to bring money in.");
      break;
    case "refund":
      if (accountIds.size !== 1)
        problems.push("A refund arrives in one account.");
      if (net <= 0) problems.push("A refund has to bring money in.");
      break;
    case "adjustment":
      if (postings.length !== 1 || legs.length !== 1) {
        problems.push("An adjustment is a single amount with no category.");
      }
      break;
    case "transfer": {
      const legAccounts = new Set(legs.map((p) => p.accountId));
      if (legs.length < 2 || legAccounts.size < 2) {
        problems.push("A transfer moves money between two different accounts.");
        break;
      }
      if (
        !legs.some((p) => p.amountMinor > 0) ||
        !legs.some((p) => p.amountMinor < 0)
      ) {
        problems.push(
          "A transfer needs money leaving one account and arriving in another.",
        );
      }
      const currencies = new Set(
        legs.map((p) => accounts.get(p.accountId)!.currency),
      );
      const legNet = legs.reduce((total, p) => total + p.amountMinor, 0);
      if (currencies.size === 1 && legNet !== 0) {
        problems.push(
          "A transfer in one currency has to balance: what leaves must arrive.",
        );
      }
      if (fees.some((p) => p.amountMinor > 0))
        problems.push("A transfer fee takes money out.");
      break;
    }
  }
  return problems;
}

/**
 * The account a new transaction starts on: chequing in the main currency,
 * then anything spendable in it, then anything open. Never simply the first
 * alphabetically — that put a grocery run on an Indian savings account.
 */
export function everydayAccount<
  A extends Pick<Account, "kind" | "currency" | "isLiquid" | "archivedAt">,
>(accounts: readonly A[], base: string): A | undefined {
  const open = accounts.filter((a) => !a.archivedAt);
  return (
    open.find((a) => a.kind === "chequing" && a.currency === base) ??
    open.find((a) => a.isLiquid && a.currency === base) ??
    open[0]
  );
}

export interface Balance {
  /** Everything up to the date, pending included — what the bank shows as available. */
  balanceMinor: number;
  /** Cleared only — what the statement will say. */
  clearedMinor: number;
  currency: string;
}

/**
 * Every account's balance on `asOf`: its opening anchor plus each posting
 * dated on or before. The same arithmetic as `money_balances()`.
 */
export function balances(
  accounts: readonly Pick<Account, "id" | "currency" | "openingBalanceMinor">[],
  transactions: readonly Pick<Transaction, "date" | "status" | "postings">[],
  asOf: IsoDate,
): Map<string, Balance> {
  const result = new Map<string, Balance>();
  for (const account of accounts) {
    result.set(account.id, {
      balanceMinor: account.openingBalanceMinor,
      clearedMinor: account.openingBalanceMinor,
      currency: account.currency,
    });
  }
  for (const txn of transactions) {
    if (txn.date > asOf) continue;
    for (const posting of txn.postings) {
      const balance = result.get(posting.accountId);
      if (!balance) continue;
      balance.balanceMinor += posting.amountMinor;
      if (txn.status !== "pending") balance.clearedMinor += posting.amountMinor;
    }
  }
  return result;
}

export interface RunningLine<T> {
  transaction: T;
  /** This transaction's net effect on the account. */
  changeMinor: number;
  /** The account's balance after it. */
  balanceMinor: number;
}

/**
 * An account's register: its transactions oldest first, each with the
 * balance after it. Same-day transactions keep their given order.
 */
export function register<T extends Pick<Transaction, "date" | "postings">>(
  account: Pick<Account, "id" | "openingBalanceMinor">,
  transactions: readonly T[],
): RunningLine<T>[] {
  const touching = transactions
    .map((transaction, index) => ({
      transaction,
      index,
      changeMinor: transaction.postings
        .filter((p) => p.accountId === account.id)
        .reduce((total, p) => total + p.amountMinor, 0),
      touches: transaction.postings.some((p) => p.accountId === account.id),
    }))
    .filter((line) => line.touches)
    .sort(
      (a, b) =>
        a.transaction.date.localeCompare(b.transaction.date) ||
        a.index - b.index,
    );

  let running = account.openingBalanceMinor;
  return touching.map(({ transaction, changeMinor }) => {
    running += changeMinor;
    return { transaction, changeMinor, balanceMinor: running };
  });
}

export interface Valuation {
  /** Sum of everything that could be converted, in the base currency. */
  total: Money;
  assets: Money;
  liabilities: Money;
  /** Per country (CA, IN, …), in the base currency. */
  byCountry: Map<string, Money>;
  /** Balances with no rate into the base currency, by currency — named, never dropped silently. */
  unpriced: Money[];
}

/**
 * Net worth on a day: every account in `inNetWorth`, converted at that
 * day's rate. Unlike a posting's frozen rate, a *balance* is valued at the
 * rate of the day asked about — that is what it is worth then.
 */
export function valuation(
  accounts: readonly Pick<
    Account,
    "id" | "kind" | "country" | "currency" | "inNetWorth" | "archivedAt"
  >[],
  balanceByAccount: ReadonlyMap<string, Balance>,
  base: string,
  on: IsoDate,
  rates: RateTable,
): Valuation {
  let assets = 0;
  let liabilities = 0;
  const byCountry = new Map<string, number>();
  const unpriced = new Map<string, number>();

  for (const account of accounts) {
    if (!account.inNetWorth) continue;
    const balance = balanceByAccount.get(account.id);
    if (!balance || balance.balanceMinor === 0) continue;
    const quote = rates.quote(account.currency, base, on);
    if (!quote) {
      unpriced.set(
        account.currency,
        (unpriced.get(account.currency) ?? 0) + balance.balanceMinor,
      );
      continue;
    }
    const inBase = convert(
      money(balance.balanceMinor, account.currency),
      quote.rate,
      base,
    ).minor;
    if (inBase >= 0) assets += inBase;
    else liabilities += inBase;
    byCountry.set(
      account.country,
      (byCountry.get(account.country) ?? 0) + inBase,
    );
  }

  return {
    total: money(assets + liabilities, base),
    assets: money(assets, base),
    liabilities: money(liabilities, base),
    byCountry: new Map(
      [...byCountry].map(([country, minor]) => [country, money(minor, base)]),
    ),
    unpriced: [...unpriced].map(([currency, minor]) => money(minor, currency)),
  };
}

export interface Utilisation {
  accountId: string;
  /** What is owed: the negative balance as a positive number, 0 when in credit. */
  usedMinor: number;
  limitMinor: number;
  /** used / limit, 0–∞ (over the limit is > 1). */
  ratio: number;
}

/**
 * How much of each card's limit is in use, and overall. Credit bureaus
 * weigh this heavily; under 30% is the usual advice, under 10% the best
 * scores. Cards without a limit are left out rather than divided by zero.
 */
export function creditUtilisation(
  accounts: readonly Pick<
    Account,
    "id" | "kind" | "creditLimitMinor" | "currency" | "archivedAt"
  >[],
  balanceByAccount: ReadonlyMap<string, Balance>,
): { cards: Utilisation[]; overallRatio: number | null } {
  const cards: Utilisation[] = [];
  for (const account of accounts) {
    if (!CREDIT_KINDS.includes(account.kind) || account.archivedAt) continue;
    if (!account.creditLimitMinor || account.creditLimitMinor <= 0) continue;
    const balance = balanceByAccount.get(account.id)?.balanceMinor ?? 0;
    const used = Math.max(0, -balance);
    cards.push({
      accountId: account.id,
      usedMinor: used,
      limitMinor: account.creditLimitMinor,
      ratio: used / account.creditLimitMinor,
    });
  }
  // Overall is only meaningful in one currency; mixed cards are reported per card.
  const currencies = new Set(
    cards.map(
      (card) => accounts.find((a) => a.id === card.accountId)!.currency,
    ),
  );
  const limit = cards.reduce((total, card) => total + card.limitMinor, 0);
  const used = cards.reduce((total, card) => total + card.usedMinor, 0);
  return {
    cards,
    overallRatio: currencies.size === 1 && limit > 0 ? used / limit : null,
  };
}
