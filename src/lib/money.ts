/**
 * Money.
 *
 * Three rules hold everywhere below:
 *
 * 1. **An amount without a currency is meaningless.** `Money` carries both.
 * 2. **A converted amount without a rate is a guess.** Conversion always names
 *    the rate it used, so a report can say *how* it arrived at a number.
 * 3. **Historical rates are frozen at the transaction.** Re-converting the past
 *    at today's rate silently rewrites your own history every time the market
 *    moves — last March's grocery bill is not a floating quantity.
 *
 * Deliberately free of Zod and of any React import: this is reached from
 * forecasting, from formatting, and from the database layer.
 */

export interface Money {
  /** Minor-unit-agnostic decimal amount. Never a string. */
  amount: number;
  /** ISO 4217 alpha-3, uppercase. */
  currency: string;
}

/**
 * How many decimal places a currency actually has.
 *
 * Not universally two, and assuming so is a real bug rather than a rounding
 * nicety: yen has none, so ¥1,234.56 is not a price anyone has ever seen, and
 * Kuwaiti dinar has three, so rounding it to two loses a real unit of money.
 * `Intl` already knows this for every currency, so nothing here is a table to
 * maintain.
 */
function currencyDecimals(currency: string): number {
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions();
    return parts.maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export interface FormatMoneyOptions {
  /** Drop the fractional part — for axis ticks and large summaries. */
  whole?: boolean;
  /** `1.2k`, `3.4M`. For chart axes and stat cards where space is short. */
  compact?: boolean;
  /** Always show a leading + or −. Signals direction in a ledger. */
  signed?: boolean;
  locale?: string;
}

/**
 * Format an amount for display.
 *
 * Goes through `Intl` rather than concatenating a symbol, because symbol
 * placement, grouping separators and negative-number conventions all differ by
 * currency and locale — and "$-1,234.00" is not how any locale writes it.
 */
export function formatMoney(
  money: Money,
  { whole, compact, signed, locale = "en-CA" }: FormatMoneyOptions = {},
): string {
  const decimals = whole ? 0 : currencyDecimals(money.currency);

  let formatted: string;
  try {
    formatted = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: money.currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      notation: compact ? "compact" : "standard",
    }).format(Math.abs(money.amount));
  } catch {
    // An unknown code still has to render something the reader can act on.
    formatted = `${Math.abs(money.amount).toFixed(decimals)} ${money.currency}`;
  }

  if (money.amount < 0) return `−${formatted}`;
  if (signed && money.amount > 0) return `+${formatted}`;
  return formatted;
}

/* ---------------------------------------------------------------------------
 * Conversion
 * ------------------------------------------------------------------------ */
