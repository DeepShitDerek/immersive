import {
  addDays,
  endOfMonth,
  type IsoDate,
  makeDate,
  monthStart,
} from "./dates";
import { periodFlows } from "./flows";
import { type RateTable, remittanceCost, type RemittanceCost } from "./fx";
import {
  portfolio,
  type PriceBook,
  replay,
  type Security,
  type Trade,
} from "./invest";
import {
  type Account,
  balances,
  CANADIAN_REGISTRATIONS,
  isLiability,
  type Transaction,
} from "./ledger";
import { convert, money, type Money } from "./money";
import { flowsByYear, registeredMovements } from "./room";

/**
 * Reports: how each month went, how net worth moved, what sending
 * money home really cost, and the year's figures for a Canadian tax return.
 * Everything in the base currency unless it says CAD; anything that could
 * not be converted is counted and reported, never guessed at.
 */

// ── Months ─────────────────────────────────────────────────────────────────

export interface MonthRow {
  month: string; // YYYY-MM
  incomeMinor: number;
  spendingMinor: number;
  netMinor: number;
  savingsRate: number | null;
  unpriced: number;
}

/** Income, spending and savings rate for each month (YYYY-MM), oldest first. */
export function monthlySeries(
  transactions: readonly Transaction[],
  months: readonly string[],
): MonthRow[] {
  return months.map((month) => {
    const from = monthStart(month);
    const f = periodFlows(transactions, from, endOfMonth(from));
    return {
      month,
      incomeMinor: f.incomeMinor,
      spendingMinor: f.spendingMinor,
      netMinor: f.netMinor,
      savingsRate: f.savingsRate,
      unpriced: f.unpriced,
    };
  });
}

/** The last `count` month keys ending with the month of `today`, oldest first. */
export function lastMonths(today: IsoDate, count: number): string[] {
  const out: string[] = [];
  let year = Number(today.slice(0, 4));
  let month = Number(today.slice(5, 7));
  for (let i = 0; i < count; i += 1) {
    out.unshift(`${year}-${String(month).padStart(2, "0")}`);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return out;
}

// ── Net worth over time ────────────────────────────────────────────────────

export interface WorthPoint {
  date: IsoDate;
  assetsMinor: number;
  liabilitiesMinor: number;
  netMinor: number;
  /** Accounts left out that day for want of a rate. */
  unpriced: number;
}

/**
 * Net worth at each date: every account open by then, at its balance that
 * day (investments at that day's prices), converted at that day's rate.
 */
export function netWorthHistory(input: {
  dates: readonly IsoDate[];
  base: string;
  accounts: readonly Account[];
  transactions: readonly Transaction[];
  trades: readonly Trade[];
  securities: ReadonlyMap<string, Security>;
  prices: PriceBook;
  rates: RateTable;
}): WorthPoint[] {
  return input.dates.map((date) => {
    const open = input.accounts.filter(
      (a) => a.inNetWorth && a.openingDate <= date,
    );
    const bal = balances(open, input.transactions, date);
    let assets = 0;
    let liabilities = 0;
    let unpriced = 0;
    for (const account of open) {
      let minor = bal.get(account.id)?.balanceMinor ?? 0;
      if (account.kind === "investment") {
        minor = portfolio({
          accountId: account.id,
          currency: account.currency,
          ledgerBalanceMinor: minor,
          trades: input.trades,
          securities: input.securities,
          prices: input.prices,
          on: date,
        }).valueMinor;
      }
      if (minor === 0) continue;
      const quote =
        account.currency === input.base
          ? { rate: 1 }
          : input.rates.quote(account.currency, input.base, date);
      if (!quote) {
        unpriced += 1;
        continue;
      }
      const v =
        account.currency === input.base
          ? minor
          : convert(money(minor, account.currency), quote.rate, input.base)
              .minor;
      if (v >= 0) assets += v;
      else liabilities += v;
    }
    return {
      date,
      assetsMinor: assets,
      liabilitiesMinor: liabilities,
      netMinor: assets + liabilities,
      unpriced,
    };
  });
}

// ── Remittances ────────────────────────────────────────────────────────────

export interface Remittance {
  transactionId: string;
  date: IsoDate;
  description: string;
  provider: string | null;
  sent: Money;
  received: Money;
  fee: Money;
  /** The rate the cost is measured against, and where it came from. */
  marketRate: number | null;
  rateSource: "entered" | "stored" | null;
  cost: RemittanceCost | null;
  /** The total cost in the base currency, when it can be converted. */
  costBaseMinor: number | null;
  sentBaseMinor: number | null;
}

/**
 * Every transfer between currencies in the period, and what it cost against
 * the mid-market rate: the one entered with it, or else the stored rate for
 * that day. Without either, the cost is unknown rather than zero.
 */
export function remittances(input: {
  transactions: readonly Transaction[];
  accounts: ReadonlyMap<string, Pick<Account, "currency">>;
  from: IsoDate;
  to: IsoDate;
  base: string;
  rates: RateTable;
}): {
  items: Remittance[];
  sentBaseMinor: number;
  costBaseMinor: number;
  unknownCost: number;
} {
  const items: Remittance[] = [];
  let sentBase = 0;
  let costBase = 0;
  let unknown = 0;
  for (const txn of input.transactions) {
    if (txn.kind !== "transfer" || txn.date < input.from || txn.date > input.to)
      continue;
    const legs = txn.postings.filter((p) => !p.categoryId);
    const out = legs.find((p) => p.amountMinor < 0);
    const inn = legs.find((p) => p.amountMinor > 0);
    if (!out || !inn) continue;
    const fromCurrency = input.accounts.get(out.accountId)?.currency;
    const toCurrency = input.accounts.get(inn.accountId)?.currency;
    if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) continue;
    const feeMinor = -txn.postings
      .filter((p) => p.categoryId && p.accountId === out.accountId)
      .reduce((t, p) => t + p.amountMinor, 0);
    const sent = money(-out.amountMinor, fromCurrency);
    const received = money(inn.amountMinor, toCurrency);
    const fee = money(Math.max(0, feeMinor), fromCurrency);
    let marketRate = txn.marketRate;
    let rateSource: Remittance["rateSource"] = marketRate ? "entered" : null;
    if (!marketRate) {
      const q = input.rates.quote(fromCurrency, toCurrency, txn.date);
      if (q) {
        marketRate = q.rate;
        rateSource = "stored";
      }
    }
    const cost = marketRate
      ? remittanceCost({ sent, received, fee, marketRate })
      : null;
    const toBase = (m: Money): number | null => {
      if (m.currency === input.base) return m.minor;
      const q = input.rates.quote(m.currency, input.base, txn.date);
      return q ? convert(m, q.rate, input.base).minor : null;
    };
    const costBaseMinor = cost ? toBase(cost.totalCost) : null;
    const sentBaseMinor = toBase(sent);
    if (sentBaseMinor !== null) sentBase += sentBaseMinor;
    if (costBaseMinor !== null) costBase += costBaseMinor;
    else unknown += 1;
    items.push({
      transactionId: txn.id,
      date: txn.date,
      description: txn.description,
      provider: txn.provider,
      sent,
      received,
      fee,
      marketRate: marketRate ?? null,
      rateSource,
      cost,
      costBaseMinor,
      sentBaseMinor,
    });
  }
  items.sort((a, b) => b.date.localeCompare(a.date));
  return {
    items,
    sentBaseMinor: sentBase,
    costBaseMinor: costBase,
    unknownCost: unknown,
  };
}

// ── The tax year ───────────────────────────────────────────────────────────

/** Specified foreign property above this cost at any time in the year means filing a T1135. */
export const T1135_THRESHOLD_MINOR = 10_000_000;
/** Above this, the detailed method (property by property). */
const T1135_DETAILED_MINOR = 25_000_000;

export interface TaxYear {
  year: number;
  /** Income by category, in CAD — outside registered accounts, whose income is sheltered. */
  incomeByCategory: Map<string | null, number>;
  totalIncomeMinor: number;
  /** Income that landed in accounts outside Canada (NRO interest, Indian rent…) — taxable in Canada too. */
  foreignIncomeMinor: number;
  /** Non-registered investment income. */
  dividendsMinor: number;
  investmentInterestMinor: number;
  realisedGainsMinor: number;
  /** Half of net gains are taxable; losses carry, so never below zero here. */
  taxableGainsMinor: number;
  rrspContributedMinor: number;
  fhsaContributedMinor: number;
  tfsaContributedMinor: number;
  /** The highest total cost of foreign property at a month end. */
  foreignPropertyPeakMinor: number;
  foreignPropertyPeakDate: IsoDate | null;
  t1135: "not_required" | "simplified" | "detailed";
  /** Things that could not be converted to CAD, and so are missing. */
  unconverted: number;
}

/**
 * The figures a Canadian return asks for, from the ledger, in CAD. Not tax
 * advice and not a return: a checklist of amounts to match against the T4,
 * T5, T3 and T5008 slips, and a flag for the T1135.
 *
 * Foreign property is approximated as accounts held outside Canada at their
 * balance, plus the cost of non-CAD securities in non-registered accounts —
 * close to how the CRA counts it (cost, at any time in the year), though a
 * CAD-listed ETF holding foreign shares is not foreign property and a
 * foreign-listed one bought in CAD would be missed.
 */
export function taxYear(input: {
  year: number;
  accounts: readonly Account[];
  transactions: readonly Transaction[];
  trades: readonly Trade[];
  base: string;
  rates: RateTable;
}): TaxYear {
  const { year, rates } = input;
  const from = makeDate(year, 1, 1);
  const to = makeDate(year, 12, 31);
  let unconverted = 0;
  const cad = (minor: number, currency: string, on: IsoDate): number => {
    if (currency === "CAD") return minor;
    const q = rates.quote(currency, "CAD", on);
    if (!q) {
      if (minor !== 0) unconverted += 1;
      return 0;
    }
    return convert(money(minor, currency), q.rate, "CAD").minor;
  };
  const byId = new Map(input.accounts.map((a) => [a.id, a]));

  // Income, in CAD, from each posting at its own day's rate.
  const incomeByCategory = new Map<string | null, number>();
  let total = 0;
  let foreign = 0;
  for (const txn of input.transactions) {
    if (
      txn.kind !== "income" ||
      txn.status === "pending" ||
      txn.date < from ||
      txn.date > to
    )
      continue;
    for (const p of txn.postings) {
      const account = byId.get(p.accountId);
      // Income inside a TFSA, RRSP or FHSA is sheltered: not on the return.
      if (!account || CANADIAN_REGISTRATIONS.includes(account.registration))
        continue;
      const v =
        input.base === "CAD" && p.baseAmountMinor != null
          ? p.baseAmountMinor
          : cad(p.amountMinor, account.currency, txn.date);
      incomeByCategory.set(
        p.categoryId,
        (incomeByCategory.get(p.categoryId) ?? 0) + v,
      );
      total += v;
      if (account.country !== "CA") foreign += v;
    }
  }

  // Non-registered investments.
  let dividends = 0;
  let interest = 0;
  let gains = 0;
  for (const account of input.accounts) {
    if (account.kind !== "investment" || account.registration !== "none")
      continue;
    const own = input.trades.filter((t) => t.accountId === account.id);
    for (const t of own) {
      if (t.date < from || t.date > to) continue;
      if (t.kind === "dividend" || t.kind === "reinvest")
        dividends += cad(t.amountMinor, account.currency, t.date);
      if (t.kind === "interest")
        interest += cad(t.amountMinor, account.currency, t.date);
    }
    for (const d of replay(own, to).dispositions) {
      if (d.date >= from) gains += cad(d.gainMinor, account.currency, d.date);
    }
  }

  const contributed = (registration: "rrsp" | "fhsa" | "tfsa") =>
    flowsByYear(
      registeredMovements(
        registration,
        input.accounts,
        input.transactions,
        input.base,
      ).movements,
    ).get(year)?.contributedMinor ?? 0;

  // Foreign property at each month end.
  let peak = 0;
  let peakDate: IsoDate | null = null;
  for (let m = 1; m <= 12; m += 1) {
    const date = endOfMonth(makeDate(year, m, 1));
    const held = input.accounts.filter(
      (a) => a.openingDate <= date && !isLiability(a.kind),
    );
    const bal = balances(held, input.transactions, date);
    let cost = 0;
    for (const account of held) {
      if (account.country !== "CA")
        cost += Math.max(
          0,
          cad(bal.get(account.id)?.balanceMinor ?? 0, account.currency, date),
        );
      else if (
        account.kind === "investment" &&
        account.registration === "none" &&
        account.currency !== "CAD"
      ) {
        for (const position of replay(
          input.trades.filter((t) => t.accountId === account.id),
          date,
        ).positions.values()) {
          cost += cad(position.acbMinor, account.currency, date);
        }
      }
    }
    if (cost > peak) {
      peak = cost;
      peakDate = date;
    }
  }

  return {
    year,
    incomeByCategory,
    totalIncomeMinor: total,
    foreignIncomeMinor: foreign,
    dividendsMinor: dividends,
    investmentInterestMinor: interest,
    realisedGainsMinor: gains,
    taxableGainsMinor: Math.max(0, Math.round(gains / 2)),
    rrspContributedMinor: contributed("rrsp"),
    fhsaContributedMinor: contributed("fhsa"),
    tfsaContributedMinor: contributed("tfsa"),
    foreignPropertyPeakMinor: peak,
    foreignPropertyPeakDate: peakDate,
    t1135:
      peak > T1135_DETAILED_MINOR
        ? "detailed"
        : peak > T1135_THRESHOLD_MINOR
          ? "simplified"
          : "not_required",
    unconverted,
  };
}

/** Month ends from `from` to `to`, and `to` itself when it is mid-month. */
export function monthEnds(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = endOfMonth(from); d < to; d = endOfMonth(addDays(d, 1)))
    out.push(d);
  out.push(to);
  return out;
}
