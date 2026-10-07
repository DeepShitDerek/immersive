import { daysBetween, isIsoDate, type IsoDate } from "./dates";
import type { RateTable } from "./fx";
import type { Transaction } from "./ledger";
import { convert, exponentOf, money, roundHalfAwayFromZero } from "./money";

/**
 * Investing. An investment account's ledger balance is its cash
 * as the ledger sees it: deposits, withdrawals, and the dividends, interest
 * and fees posted by their trades. Buys, sells, returns of capital and
 * splits never touch the ledger — everything they change (the cash left,
 * each holding's units and adjusted cost base, realised gains) is worked
 * out here from the trades, in date order, every time. Nothing derived is
 * stored, so editing an old trade can never leave a stale gain behind.
 *
 * ACB follows the CRA's average-cost method: a buy adds its cost plus
 * commission; a sell takes out the average cost of the units sold, and its
 * gain is the proceeds less commission less that cost; a return of capital
 * lowers the ACB, and any excess over it is a gain; a split changes units,
 * not cost. (The CRA pools identical securities across all of a person's
 * non-registered accounts; this pools per account. They differ only when
 * the same security is held in two taxable accounts.)
 */

export const ASSET_CLASSES = [
  "equity",
  "fixed_income",
  "cash",
  "real_estate",
  "commodity",
  "crypto",
  "balanced",
  "other",
] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];
export const REGIONS = [
  "canada",
  "us",
  "india",
  "international",
  "emerging",
  "global",
  "other",
] as const;
export type Region = (typeof REGIONS)[number];
export const TRADE_KINDS = [
  "buy",
  "sell",
  "reinvest",
  "dividend",
  "interest",
  "fee",
  "return_of_capital",
  "split",
] as const;
export type TradeKind = (typeof TRADE_KINDS)[number];

/** Kinds that own a ledger transaction (income, or a fee). */
export const LEDGER_TRADE_KINDS: readonly TradeKind[] = [
  "dividend",
  "interest",
  "fee",
  "reinvest",
];
/** Kinds with a number of units. */
export const UNIT_TRADE_KINDS: readonly TradeKind[] = [
  "buy",
  "sell",
  "reinvest",
  "split",
];

export interface Security {
  id: string;
  symbol: string;
  name: string;
  currency: string;
  assetClass: AssetClass;
  region: Region;
  notes: string | null;
}

export interface Price {
  securityId: string;
  date: IsoDate;
  price: number;
}

export interface Trade {
  id: string;
  accountId: string;
  securityId: string | null;
  date: IsoDate;
  kind: TradeKind;
  /** Units; for a split, new units per old unit. */
  quantity: number | null;
  amountMinor: number;
  feeMinor: number;
  transactionId: string | null;
  notes: string | null;
  /** Orders trades on the same day: the one entered first happened first. */
  createdAt: string;
}

const UNIT_PRECISION = 1e8;
export const roundUnits = (units: number): number =>
  Math.round(units * UNIT_PRECISION) / UNIT_PRECISION;

/** Why a trade is not allowed — the same rules as money_trade_shape. */
export function validateTrade(
  t: Pick<
    Trade,
    "kind" | "securityId" | "quantity" | "amountMinor" | "feeMinor"
  >,
): string[] {
  const found: string[] = [];
  const needsSecurity = t.kind !== "interest" && t.kind !== "fee";
  if (needsSecurity && !t.securityId) found.push("Choose the security.");
  if (UNIT_TRADE_KINDS.includes(t.kind)) {
    if (t.quantity === null || !(t.quantity > 0))
      found.push(
        t.kind === "split"
          ? "Enter the split ratio (new units for each old one)."
          : "Enter how many units.",
      );
  } else if (t.quantity !== null)
    found.push("This kind of trade has no units.");
  if (!Number.isSafeInteger(t.amountMinor) || t.amountMinor < 0)
    found.push("The amount can't be negative.");
  if (!Number.isSafeInteger(t.feeMinor) || t.feeMinor < 0)
    found.push("The commission can't be negative.");
  if (t.kind === "split") {
    if (t.amountMinor !== 0 || t.feeMinor !== 0)
      found.push("A split moves no money.");
  } else if (t.kind !== "buy" && t.kind !== "sell") {
    if (t.amountMinor <= 0) found.push("Enter the amount.");
    if (t.feeMinor !== 0) found.push("Only a buy or sell has a commission.");
  }
  return found;
}

/** What a trade does to the account's cash. */
export function cashEffect(
  t: Pick<Trade, "kind" | "amountMinor" | "feeMinor">,
): number {
  switch (t.kind) {
    case "buy":
      return -(t.amountMinor + t.feeMinor);
    case "sell":
      return t.amountMinor - t.feeMinor;
    case "dividend":
    case "interest":
    case "return_of_capital":
      return t.amountMinor;
    case "fee":
      return -t.amountMinor;
    case "reinvest":
    case "split":
      return 0;
  }
}

/** What its ledger transaction (if any) does to the ledger balance. */
export function ledgerEffect(t: Pick<Trade, "kind" | "amountMinor">): number {
  switch (t.kind) {
    case "dividend":
    case "interest":
    case "reinvest":
      return t.amountMinor;
    case "fee":
      return -t.amountMinor;
    default:
      return 0;
  }
}

const sortTrades = <T extends Pick<Trade, "date" | "createdAt">>(
  trades: readonly T[],
): T[] =>
  [...trades].sort((a, b) =>
    a.date === b.date
      ? a.createdAt.localeCompare(b.createdAt)
      : a.date < b.date
        ? -1
        : 1,
  );

interface Disposition {
  tradeId: string;
  date: IsoDate;
  securityId: string;
  kind: "sell" | "return_of_capital";
  /** Proceeds less commission. */
  proceedsMinor: number;
  acbMinor: number;
  gainMinor: number;
}

interface Position {
  securityId: string;
  units: number;
  acbMinor: number;
  /** Dividends and reinvested distributions. */
  incomeMinor: number;
  realisedMinor: number;
}

export interface Book {
  positions: Map<string, Position>;
  dispositions: Disposition[];
  /** Cash the trades moved that the ledger does not hold: add it to the ledger balance for the true cash. */
  cashAdjustmentMinor: number;
  interestMinor: number;
  feesMinor: number;
  commissionsMinor: number;
  /** Trades that could not be applied as entered, in words. */
  problems: string[];
}

/**
 * Replays one account's trades up to `on`. A sell of more units than are
 * held is a problem, and is applied as selling all of them.
 */
export function replay(
  trades: readonly Trade[],
  on: IsoDate,
  symbolOf: (id: string) => string = (id) => id,
): Book {
  const positions = new Map<string, Position>();
  const dispositions: Disposition[] = [];
  const problems: string[] = [];
  let cashAdjustment = 0;
  let interest = 0;
  let fees = 0;
  let commissions = 0;

  const position = (id: string) => {
    let p = positions.get(id);
    if (!p)
      positions.set(
        id,
        (p = {
          securityId: id,
          units: 0,
          acbMinor: 0,
          incomeMinor: 0,
          realisedMinor: 0,
        }),
      );
    return p;
  };

  for (const t of sortTrades(trades)) {
    if (t.date > on) continue;
    cashAdjustment += cashEffect(t) - ledgerEffect(t);
    if (t.kind === "interest") {
      interest += t.amountMinor;
      continue;
    }
    if (t.kind === "fee") {
      fees += t.amountMinor;
      continue;
    }
    if (!t.securityId) continue;
    const p = position(t.securityId);
    const units = t.quantity ?? 0;
    switch (t.kind) {
      case "buy":
        p.units = roundUnits(p.units + units);
        p.acbMinor += t.amountMinor + t.feeMinor;
        commissions += t.feeMinor;
        break;
      case "reinvest":
        p.units = roundUnits(p.units + units);
        p.acbMinor += t.amountMinor;
        p.incomeMinor += t.amountMinor;
        break;
      case "dividend":
        p.incomeMinor += t.amountMinor;
        break;
      case "split":
        if (p.units <= 0)
          problems.push(
            `${t.date}: a split of ${symbolOf(t.securityId)} with none held.`,
          );
        p.units = roundUnits(p.units * units);
        break;
      case "sell": {
        commissions += t.feeMinor;
        let sold = units;
        if (sold > p.units + 1 / UNIT_PRECISION) {
          problems.push(
            `${t.date}: sold ${units} ${symbolOf(t.securityId)} with only ${p.units} held.`,
          );
          sold = p.units;
        }
        const acbOut =
          p.units > 0
            ? sold >= p.units
              ? p.acbMinor
              : roundHalfAwayFromZero((p.acbMinor * sold) / p.units)
            : 0;
        const proceeds = t.amountMinor - t.feeMinor;
        const gain = proceeds - acbOut;
        p.units = roundUnits(p.units - sold);
        p.acbMinor = p.units === 0 ? 0 : p.acbMinor - acbOut;
        p.realisedMinor += gain;
        dispositions.push({
          tradeId: t.id,
          date: t.date,
          securityId: t.securityId,
          kind: "sell",
          proceedsMinor: proceeds,
          acbMinor: acbOut,
          gainMinor: gain,
        });
        break;
      }
      case "return_of_capital": {
        const excess = Math.max(0, t.amountMinor - p.acbMinor);
        p.acbMinor = Math.max(0, p.acbMinor - t.amountMinor);
        if (excess > 0) {
          // Return of capital beyond the ACB is a capital gain, and the ACB stays at zero.
          p.realisedMinor += excess;
          dispositions.push({
            tradeId: t.id,
            date: t.date,
            securityId: t.securityId,
            kind: "return_of_capital",
            proceedsMinor: excess,
            acbMinor: 0,
            gainMinor: excess,
          });
        }
        break;
      }
    }
  }
  return {
    positions,
    dispositions,
    cashAdjustmentMinor: cashAdjustment,
    interestMinor: interest,
    feesMinor: fees,
    commissionsMinor: commissions,
    problems,
  };
}

/** One security's recorded prices, newest first, at most `limit` of them. */
export function recentPrices(
  prices: readonly Price[],
  securityId: string,
  limit: number,
): Price[] {
  return prices
    .filter((p) => p.securityId === securityId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export interface PriceBook {
  /** The latest price on or before `on`. */
  latest(securityId: string, on: IsoDate): Price | null;
}

export function buildPriceBook(prices: readonly Price[]): PriceBook {
  const bySecurity = new Map<string, Price[]>();
  for (const p of prices) {
    const list = bySecurity.get(p.securityId) ?? [];
    list.push(p);
    bySecurity.set(p.securityId, list);
  }
  for (const list of bySecurity.values())
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return {
    latest(securityId, on) {
      const list = bySecurity.get(securityId);
      if (!list) return null;
      let lo = 0;
      let hi = list.length - 1;
      let found: Price | null = null;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (list[mid].date <= on) {
          found = list[mid];
          lo = mid + 1;
        } else hi = mid - 1;
      }
      return found;
    },
  };
}

/** Units × price per unit, in minor units of the currency. */
export function marketValue(
  units: number,
  price: number,
  currency: string,
): number {
  return roundHalfAwayFromZero(units * price * 10 ** exponentOf(currency));
}

interface Holding extends Position {
  security: Security;
  price: Price | null;
  /** At the latest price; null without one. */
  marketValueMinor: number | null;
  /** Market value, or the ACB when there is no price. */
  valueMinor: number;
  unrealisedMinor: number | null;
  /** Days since the price used; null without one. */
  priceAgeDays: number | null;
}

export interface Portfolio {
  accountId: string;
  currency: string;
  cashMinor: number;
  holdings: Holding[];
  /** Cash plus holdings. */
  valueMinor: number;
  /** What to add to the ledger balance to reach the value — for net worth. */
  adjustmentMinor: number;
  book: Book;
  unpriced: string[];
}

export function portfolio(input: {
  accountId: string;
  currency: string;
  ledgerBalanceMinor: number;
  trades: readonly Trade[];
  securities: ReadonlyMap<string, Security>;
  prices: PriceBook;
  on: IsoDate;
}): Portfolio {
  const trades = input.trades.filter((t) => t.accountId === input.accountId);
  const book = replay(
    trades,
    input.on,
    (id) => input.securities.get(id)?.symbol ?? "?",
  );
  const holdings: Holding[] = [];
  const unpriced: string[] = [];
  for (const p of book.positions.values()) {
    const security = input.securities.get(p.securityId);
    if (!security) continue;
    if (
      p.units === 0 &&
      p.acbMinor === 0 &&
      p.incomeMinor === 0 &&
      p.realisedMinor === 0
    )
      continue;
    const price =
      p.units > 0 ? input.prices.latest(p.securityId, input.on) : null;
    const mv =
      p.units === 0
        ? 0
        : price
          ? marketValue(p.units, price.price, input.currency)
          : null;
    if (p.units > 0 && !price) unpriced.push(security.symbol);
    holdings.push({
      ...p,
      security,
      price,
      marketValueMinor: mv,
      valueMinor: mv ?? p.acbMinor,
      unrealisedMinor: mv === null ? null : mv - p.acbMinor,
      priceAgeDays: price ? daysBetween(price.date, input.on) : null,
    });
  }
  holdings.sort(
    (a, b) =>
      b.valueMinor - a.valueMinor ||
      a.security.symbol.localeCompare(b.security.symbol),
  );
  const cash = input.ledgerBalanceMinor + book.cashAdjustmentMinor;
  const value = cash + holdings.reduce((t, h) => t + h.valueMinor, 0);
  return {
    accountId: input.accountId,
    currency: input.currency,
    cashMinor: cash,
    holdings,
    valueMinor: value,
    adjustmentMinor: value - input.ledgerBalanceMinor,
    book,
    unpriced,
  };
}

// ── Returns ────────────────────────────────────────────────────────────────

export interface Flow {
  date: IsoDate;
  /** From the investor's side: money put in is negative, money taken out (or still there at the end) positive. */
  amountMinor: number;
}

/**
 * The annual rate that makes the flows' present value zero — the
 * money-weighted return (Excel's XIRR). Null when there is no answer:
 * fewer than two flows, all one sign, or no root in range.
 */
export function xirr(flows: readonly Flow[]): number | null {
  const list = flows.filter((f) => f.amountMinor !== 0);
  if (
    list.length < 2 ||
    !list.some((f) => f.amountMinor > 0) ||
    !list.some((f) => f.amountMinor < 0)
  )
    return null;
  const first = list.reduce((m, f) => (f.date < m ? f.date : m), list[0].date);
  const years = list.map((f) => daysBetween(first, f.date) / 365);
  if (Math.max(...years) === 0) return null;
  const npv = (r: number) =>
    list.reduce((t, f, i) => t + f.amountMinor / (1 + r) ** years[i], 0);
  const slope = (r: number) =>
    list.reduce(
      (t, f, i) => t - (years[i] * f.amountMinor) / (1 + r) ** (years[i] + 1),
      0,
    );

  // Newton first; fall back to bisection, which cannot miss a bracketed root.
  let r = 0.1;
  for (let i = 0; i < 50; i += 1) {
    const f = npv(r);
    const d = slope(r);
    if (!Number.isFinite(f) || !Number.isFinite(d) || d === 0) break;
    const next = r - f / d;
    if (!Number.isFinite(next) || next <= -0.9999) break;
    if (Math.abs(next - r) < 1e-10) return next;
    r = next;
  }
  let lo = -0.9999;
  let hi = 100;
  let flo = npv(lo);
  if (!Number.isFinite(flo) || Math.sign(flo) === Math.sign(npv(hi)))
    return null;
  for (let i = 0; i < 300; i += 1) {
    const mid = (lo + hi) / 2;
    const fm = npv(mid);
    if (Math.abs(fm) < 1e-7 || hi - lo < 1e-12) return mid;
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * What went into and out of an account from outside it: its opening
 * balance and every transfer, as investor flows — then its value today as
 * the final flow. Income and fees inside the account are the return, not
 * flows.
 */
export function accountFlows(input: {
  accountId: string;
  openingDate: IsoDate;
  openingBalanceMinor: number;
  transactions: readonly Pick<Transaction, "date" | "kind" | "postings">[];
  valueMinor: number;
  on: IsoDate;
}): { flows: Flow[]; contributedMinor: number; withdrawnMinor: number } {
  const flows: Flow[] = [];
  let contributed = 0;
  let withdrawn = 0;
  if (input.openingBalanceMinor !== 0) {
    flows.push({
      date: input.openingDate,
      amountMinor: -input.openingBalanceMinor,
    });
    if (input.openingBalanceMinor > 0) contributed += input.openingBalanceMinor;
  }
  for (const txn of input.transactions) {
    if (txn.kind !== "transfer" || txn.date > input.on) continue;
    for (const p of txn.postings) {
      if (p.accountId !== input.accountId || p.categoryId) continue;
      flows.push({ date: txn.date, amountMinor: -p.amountMinor });
      if (p.amountMinor > 0) contributed += p.amountMinor;
      else withdrawn -= p.amountMinor;
    }
  }
  flows.push({ date: input.on, amountMinor: input.valueMinor });
  return { flows, contributedMinor: contributed, withdrawnMinor: withdrawn };
}

// ── Allocation ─────────────────────────────────────────────────────────────

export interface Slice<K extends string> {
  key: K;
  valueMinor: number;
  share: number;
}

export interface Allocation {
  total: number;
  byClass: Slice<AssetClass>[];
  byRegion: Slice<Region | "cash">[];
  byCurrency: Slice<string>[];
  unconverted: string[];
}

/** Every portfolio's holdings and cash, in the base currency, by class, region and currency. Cash counts as the "cash" class. */
export function allocation(
  portfolios: readonly Portfolio[],
  base: string,
  on: IsoDate,
  rates: RateTable,
): Allocation {
  const byClass = new Map<AssetClass, number>();
  const byRegion = new Map<Region | "cash", number>();
  const byCurrency = new Map<string, number>();
  const unconverted = new Set<string>();
  let total = 0;
  const add = <K>(map: Map<K, number>, key: K, v: number) =>
    map.set(key, (map.get(key) ?? 0) + v);

  for (const pf of portfolios) {
    const quote =
      pf.currency === base ? { rate: 1 } : rates.quote(pf.currency, base, on);
    if (!quote) {
      unconverted.add(pf.currency);
      continue;
    }
    const toBase = (minor: number) =>
      pf.currency === base
        ? minor
        : convert(money(minor, pf.currency), quote.rate, base).minor;
    if (pf.cashMinor > 0) {
      const v = toBase(pf.cashMinor);
      add(byClass, "cash", v);
      add(byRegion, "cash", v);
      add(byCurrency, pf.currency, v);
      total += v;
    }
    for (const h of pf.holdings) {
      if (h.valueMinor <= 0) continue;
      const v = toBase(h.valueMinor);
      add(byClass, h.security.assetClass, v);
      add(byRegion, h.security.region, v);
      add(byCurrency, pf.currency, v);
      total += v;
    }
  }
  const slices = <K extends string>(map: Map<K, number>): Slice<K>[] =>
    [...map]
      .map(([key, valueMinor]) => ({
        key,
        valueMinor,
        share: total ? valueMinor / total : 0,
      }))
      .sort((a, b) => b.valueMinor - a.valueMinor);
  return {
    total,
    byClass: slices(byClass),
    byRegion: slices(byRegion),
    byCurrency: slices(byCurrency),
    unconverted: [...unconverted],
  };
}

// ── Prices from a paste ────────────────────────────────────────────────────

export interface ParsedPrice {
  line: number;
  symbol: string | null;
  date: IsoDate;
  price: number;
}

/**
 * Prices pasted from a spreadsheet or a broker's export: one per line,
 * `date, price` or `symbol, date, price` (comma, tab or semicolon). A
 * header line and blank lines are skipped; anything else unreadable is
 * reported by line number rather than guessed at.
 */
/** Cells separated by comma, tab or semicolon; a double-quoted cell may contain them. */
function splitCells(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "," || ch === "\t" || ch === ";")) {
      cells.push(cell.trim());
      cell = "";
    } else cell += ch;
  }
  cells.push(cell.trim());
  return cells;
}

export function parsePrices(text: string): {
  prices: ParsedPrice[];
  errors: string[];
} {
  const prices: ParsedPrice[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const cells = splitCells(raw);
    if (cells.every((c) => c === "")) return;
    if (index === 0 && cells.some((c) => /date/i.test(c))) return;
    const [symbol, date, priceText] =
      cells.length >= 3 ? cells : [null, cells[0], cells[1]];
    const price = Number(
      (priceText ?? "").replace(/[$₹\s]/g, "").replace(/,/g, ""),
    );
    if (!isIsoDate(date)) {
      errors.push(`Line ${line}: the date has to look like 2026-03-31.`);
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      errors.push(`Line ${line}: the price has to be a number above zero.`);
      return;
    }
    prices.push({
      line,
      symbol: symbol ? symbol.toUpperCase() : null,
      date,
      price,
    });
  });
  return { prices, errors };
}
