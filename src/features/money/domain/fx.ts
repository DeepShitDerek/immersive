import { type IsoDate, daysBetween } from "./dates";
import {
  convert,
  impliedRate,
  type Money,
  money,
  MoneyError,
  subtract,
} from "./money";

/**
 * Exchange rates.
 *
 * A rate row says: on `asOf`, one `base` bought `rate` of `quote`. Lookups
 * take the latest row on or before the day asked about — a Saturday uses
 * Friday's close — and say how old it was, so a screen can admit "priced at
 * a rate from 12 days ago" instead of implying it is today's.
 *
 * A pair missing in one direction is inverted; a pair missing in both is
 * crossed through a currency both sides know (CAD→INR via USD, say). A pair
 * with no route at all returns null, and callers report the amount as
 * unpriced rather than guessing parity.
 */

export interface RateRow {
  base: string;
  quote: string;
  asOf: IsoDate;
  rate: number;
}

export interface RateQuote {
  /** Units of `to` per one unit of `from`. */
  rate: number;
  /** The oldest row the quote depends on. */
  asOf: IsoDate;
  route: "same" | "direct" | "inverse" | "cross";
}

export interface RateTable {
  quote(from: string, to: string, on: IsoDate): RateQuote | null;
}

export function buildRateTable(rows: readonly RateRow[]): RateTable {
  /** "CAD>INR" → rows sorted by date ascending. */
  const series = new Map<string, RateRow[]>();
  const known = new Set<string>();
  for (const row of rows) {
    if (!(row.rate > 0) || !Number.isFinite(row.rate)) continue;
    const key = `${row.base}>${row.quote}`;
    const list = series.get(key) ?? [];
    list.push(row);
    series.set(key, list);
    known.add(row.base);
    known.add(row.quote);
  }
  for (const list of series.values())
    list.sort((a, b) => a.asOf.localeCompare(b.asOf));

  /** Latest row on or before `on` (binary search). */
  const latest = (from: string, to: string, on: IsoDate): RateRow | null => {
    const list = series.get(`${from}>${to}`);
    if (!list || list.length === 0 || list[0].asOf > on) return null;
    let low = 0;
    let high = list.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (list[mid].asOf <= on) low = mid;
      else high = mid - 1;
    }
    return list[low];
  };

  const oneHop = (from: string, to: string, on: IsoDate): RateQuote | null => {
    const direct = latest(from, to, on);
    const inverse = latest(to, from, on);
    // Both exist: the fresher one wins.
    if (direct && (!inverse || direct.asOf >= inverse.asOf)) {
      return { rate: direct.rate, asOf: direct.asOf, route: "direct" };
    }
    if (inverse)
      return { rate: 1 / inverse.rate, asOf: inverse.asOf, route: "inverse" };
    return null;
  };

  return {
    quote(from, to, on) {
      if (from === to) return { rate: 1, asOf: on, route: "same" };
      const hop = oneHop(from, to, on);
      if (hop) return hop;

      let best: RateQuote | null = null;
      for (const via of known) {
        if (via === from || via === to) continue;
        const first = oneHop(from, via, on);
        const second = first && oneHop(via, to, on);
        if (!first || !second) continue;
        const asOf = first.asOf < second.asOf ? first.asOf : second.asOf;
        if (!best || asOf > best.asOf) {
          best = { rate: first.rate * second.rate, asOf, route: "cross" };
        }
      }
      return best;
    },
  };
}

/** How many days old a quote was on the day it was used. */
export const quoteAge = (quote: RateQuote, on: IsoDate): number =>
  Math.max(0, daysBetween(quote.asOf, on));

export interface BasePrice {
  fxRate: number;
  baseAmountMinor: number;
}

/**
 * What to freeze onto a posting: the rate into the base currency on the
 * transaction's day, and the amount it made. Null when there is no route —
 * the posting is stored unpriced, both fields empty, never at parity.
 */
export function priceInBase(
  amount: Money,
  base: string,
  on: IsoDate,
  table: RateTable,
): BasePrice | null {
  if (amount.currency === base)
    return { fxRate: 1, baseAmountMinor: amount.minor };
  const quote = table.quote(amount.currency, base, on);
  if (!quote) return null;
  return {
    fxRate: quote.rate,
    baseAmountMinor: convert(amount, quote.rate, base).minor,
  };
}

export interface RemittanceCost {
  /** Units of the arriving currency per one leaving, as delivered. */
  deliveredRate: number;
  /** What the same send would have delivered at the mid-market rate. */
  atMarket: Money;
  /** atMarket − received, in the arriving currency: the hidden FX margin. */
  marginReceived: Money;
  /** The margin expressed in the sending currency, plus the upfront fee. */
  totalCost: Money;
  /** totalCost as a share of what was sent (0.0123 = 1.23%). */
  costRatio: number;
}

/**
 * What sending money actually cost. A provider advertising "no fees" still
 * charges through its rate; this puts the two on one footing so providers
 * can be compared by what arrived, not what they advertise.
 *
 * `sent` is the amount that was converted (the transfer leg), `received`
 * what arrived, `fee` any charge taken on top in the sending currency (the
 * transfer's fee posting), `marketRate` the mid-market rate (arriving per
 * sending) at the time. A provider that deducts its fee before converting
 * shows up as a smaller `received` with `fee` zero — either way the fee is
 * counted once.
 */
export function remittanceCost(input: {
  sent: Money;
  received: Money;
  fee: Money;
  marketRate: number;
}): RemittanceCost {
  const { received, fee, marketRate } = input;
  const sent = money(Math.abs(input.sent.minor), input.sent.currency);
  if (sent.minor === 0) throw new MoneyError("Nothing was sent");
  if (fee.currency !== sent.currency) {
    throw new MoneyError("The fee has to be in the currency that was sent");
  }
  if (!(marketRate > 0))
    throw new MoneyError(`Not an exchange rate: ${marketRate}`);

  const atMarket = convert(sent, marketRate, received.currency);
  const marginReceived = subtract(
    atMarket,
    money(Math.abs(received.minor), received.currency),
  );
  const marginSent = convert(marginReceived, 1 / marketRate, sent.currency);
  const totalCost = money(
    marginSent.minor + Math.abs(fee.minor),
    sent.currency,
  );

  return {
    deliveredRate: impliedRate(sent, received),
    atMarket,
    marginReceived,
    totalCost,
    costRatio: totalCost.minor / sent.minor,
  };
}
