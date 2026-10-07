/**
 * Money as whole minor units.
 *
 * The one rule: **a float may compute a ratio, never hold an amount.** Every
 * `Money` is an integer count of a currency's smallest unit — cents, paise —
 * and the only place a fraction becomes money is `roundHalfAwayFromZero`,
 * once, where the ratio is applied.
 *
 * Mirrors `money_currency` in db/schema.sql: the exponent is what makes 1234
 * mean $12.34, ¥1,234 or 1.234 KWD.
 */

export interface Money {
  readonly minor: number;
  readonly currency: string;
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/** Currencies whose minor unit is not a hundredth. Everything else is 2. */
const EXPONENTS: Readonly<Record<string, number>> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  KWD: 3,
  BHD: 3,
  OMR: 3,
};

export function exponentOf(currency: string): number {
  return EXPONENTS[currency] ?? 2;
}

function assertCurrency(currency: string): string {
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new MoneyError(`Not a currency code: "${currency}"`);
  }
  return currency;
}

export function money(minor: number, currency: string): Money {
  if (!Number.isSafeInteger(minor)) {
    throw new MoneyError(
      Number.isFinite(minor)
        ? `An amount must be a whole number of minor units within ±2^53, got ${minor}`
        : `Not an amount: ${minor}`,
    );
  }
  // `+ 0` turns −0 into 0, so a zero never prints as "−$0.00".
  return { minor: minor + 0, currency: assertCurrency(currency) };
}

/**
 * Round a real number of minor units to a whole one, halves away from zero
 * (2.5 → 3, −2.5 → −3): the rule banks use on a statement line, and the
 * one that keeps a charge and its refund exact negatives of each other.
 *
 * The tolerance absorbs binary noise and nothing more: 1.005 * 100 is
 * 100.49999999999999 in floating point, and a person reading "1.005" means
 * the half. It is a few ulps of the value, so a genuine 2.4999999 still
 * rounds down.
 */
export function roundHalfAwayFromZero(value: number): number {
  if (!Number.isFinite(value)) throw new MoneyError(`Not an amount: ${value}`);
  const sign = value < 0 ? -1 : 1;
  const magnitude = Math.abs(value);
  const tolerance = 16 * Number.EPSILON * Math.max(1, magnitude);
  // Compare the fraction rather than adding 0.5: the addition can itself
  // round (0.49999999999999994 + 0.5 is exactly 1 in floating point).
  const whole = Math.floor(magnitude);
  const rounded = magnitude - whole + tolerance >= 0.5 ? whole + 1 : whole;
  const result = sign * rounded;
  if (!Number.isSafeInteger(result)) {
    throw new MoneyError(`Amount is too large to represent exactly: ${value}`);
  }
  return result + 0;
}

/** A currency written next to an amount: "CAD", "C$", "US$", "Rs.", "₹". */
const CURRENCY_MARK = /^(?:[A-Z]{3}|[A-Z]{1,2}\$|Rs\.?|[$₹€£¥₩₦₱฿₫])/i;

/**
 * "1,234.56", "-12.5", "₹ 1,00,000", "(45.00)", "Rs.250 DR" → Money. Parsed
 * as text so no float ever holds the amount; digits past the currency's
 * precision are rounded half away from zero. Throws on anything else — a
 * stray letter is an error, not something to strip and guess around.
 *
 * DR / CR are how Indian (and some Canadian) statements mark direction:
 * DR (debit) is money out, CR (credit) is money in.
 */
export function parseAmount(input: string | number, currency: string): Money {
  const exponent = exponentOf(assertCurrency(currency));
  let text = (
    typeof input === "number" ? numberToPlainString(input) : input
  ).trim();

  // Direction may be written one way: DR/CR, brackets, or a sign before or
  // after. Two of them ("--5", "(-5)", "-5 DR") is ambiguous, not a double
  // negative, and is refused rather than resolved by guessing.
  let negative = false;
  let marks = 0;
  const flip = (isNegative: boolean) => {
    marks += 1;
    negative = isNegative;
  };
  const direction = /\s*(DR|CR)\.?$/i.exec(text);
  if (direction) {
    flip(direction[1].toUpperCase() === "DR");
    text = text.slice(0, direction.index).trim();
  }
  // Accounting negatives: "(45.00)".
  const bracketed = /^\((.*)\)$/.exec(text);
  if (bracketed) {
    flip(true);
    text = bracketed[1].trim();
  }
  // A sign may come before the currency: "-$12.00".
  if (/^[-−]/.test(text)) {
    flip(true);
    text = text.slice(1).trim();
  }
  text = text.replace(CURRENCY_MARK, "").trim();
  const trailing = /\s*(?:[A-Z]{3})$/i.exec(text);
  if (trailing) text = text.slice(0, trailing.index);
  // Grouping — thousands or the Indian lakh style (1,00,000).
  text = text.replace(/[\s,_']/g, "");
  if (/^[-−]/.test(text)) {
    flip(true);
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    flip(false);
    text = text.slice(1);
  }
  if (text.endsWith("-")) {
    // Some bank exports put the sign last: "45.00-".
    flip(true);
    text = text.slice(0, -1);
  }
  if (marks > 1) throw new MoneyError(`Ambiguous sign: "${input}"`);

  const match = /^(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match || (match[1] === "" && (match[2] ?? "") === "")) {
    throw new MoneyError(`Not an amount: "${input}"`);
  }
  const whole = match[1] === "" ? "0" : match[1];
  const fraction = match[2] ?? "";
  const kept = fraction.slice(0, exponent).padEnd(exponent, "0");
  let minor = Number(`${whole}${kept}`);
  if (!Number.isSafeInteger(minor)) {
    throw new MoneyError(
      `Amount is too large to represent exactly: "${input}"`,
    );
  }
  if (fraction.length > exponent && Number(fraction[exponent]) >= 5) minor += 1;
  return money(negative ? -minor : minor, currency);
}

/** A JS number as plain decimal text, never "1e-7". */
function numberToPlainString(value: number): string {
  if (!Number.isFinite(value)) throw new MoneyError(`Not an amount: ${value}`);
  const text = String(value);
  if (!/e/i.test(text)) return text;
  return value.toFixed(20).replace(/0+$/, "").replace(/\.$/, "");
}

/** The amount as a decimal number — for display maths and charts only. */
export function toMajor({ minor, currency }: Money): number {
  return minor / 10 ** exponentOf(currency);
}

/** "12.34" for an input field: exact, no grouping, no symbol. */
export function toInputString({ minor, currency }: Money): string {
  const exponent = exponentOf(currency);
  const sign = minor < 0 ? "-" : "";
  const digits = String(Math.abs(minor)).padStart(exponent + 1, "0");
  if (exponent === 0) return `${sign}${digits}`;
  return `${sign}${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;
}

function sameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(
      `Cannot combine ${a.currency} with ${b.currency} — convert one at a rate first`,
    );
  }
}

export function add(a: Money, b: Money): Money {
  sameCurrency(a, b);
  return money(a.minor + b.minor, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  sameCurrency(a, b);
  return money(a.minor - b.minor, a.currency);
}

export function sum(amounts: readonly Money[], currency: string): Money {
  let total = 0;
  for (const amount of amounts) {
    if (amount.currency !== currency) {
      throw new MoneyError(
        `Cannot add ${amount.currency} into a ${currency} total — convert it first`,
      );
    }
    total += amount.minor;
    if (!Number.isSafeInteger(total)) {
      throw new MoneyError("Total is too large to represent exactly");
    }
  }
  return money(total, currency);
}

/** `amount × ratio`, rounded once. For percentages, interest, tax. */
export function multiply(amount: Money, ratio: number): Money {
  if (!Number.isFinite(ratio)) throw new MoneyError(`Not a ratio: ${ratio}`);
  return money(roundHalfAwayFromZero(amount.minor * ratio), amount.currency);
}

/**
 * Split an amount by weights so the parts add back to the whole exactly.
 * The remainder goes one unit at a time to the largest fractional parts —
 * $10.00 three ways is 3.34, 3.33, 3.33, never 3.33 × 3 with a cent lost.
 */
export function allocate(amount: Money, weights: readonly number[]): Money[] {
  if (weights.length === 0) throw new MoneyError("Nothing to split between");
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) {
    throw new MoneyError("Split weights must be zero or more");
  }
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) throw new MoneyError("Split weights cannot all be zero");

  const sign = amount.minor < 0 ? -1 : 1;
  const whole = Math.abs(amount.minor);
  const exact = weights.map((w) => (whole * w) / total);
  const parts = exact.map(Math.floor);
  let left = whole - parts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; left > 0; i = (i + 1) % order.length) {
    // Never give a remainder to a zero weight.
    if (weights[order[i].index] > 0) {
      parts[order[i].index] += 1;
      left -= 1;
    }
  }
  return parts.map((part) => money(sign * part, amount.currency));
}

/**
 * Convert at `rate` (units of `to` per one unit of `from`), crossing the two
 * currencies' exponents: 1,000.00 CAD at 61.25 is ₹61,250.00, and 100 JPY at
 * 0.0091 is $0.91.
 */
export function convert(amount: Money, rate: number, to: string): Money {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new MoneyError(`Not an exchange rate: ${rate}`);
  }
  assertCurrency(to);
  if (amount.currency === to) return amount;
  const shift = exponentOf(to) - exponentOf(amount.currency);
  return money(roundHalfAwayFromZero(amount.minor * rate * 10 ** shift), to);
}

/**
 * The rate implied by two real amounts (units of `to` per one `from`) —
 * what a remittance actually delivered, before comparing it with market.
 */
export function impliedRate(from: Money, to: Money): number {
  if (from.minor === 0) throw new MoneyError("No rate from a zero amount");
  const shift = exponentOf(from.currency) - exponentOf(to.currency);
  return Math.abs(to.minor / from.minor) * 10 ** shift;
}

export interface FormatOptions {
  /** "+$12.34" for positives, where direction matters. */
  signed?: boolean;
  /** "$1.2K" in cramped places. */
  compact?: boolean;
  /** Drop ".00" on whole amounts. */
  trimZeros?: boolean;
}

/**
 * For people. INR groups the Indian way (₹1,00,000.00); everything else by
 * thousands. Uses the same exponent as the arithmetic, never Intl's opinion
 * of how many decimals a currency has.
 */
export function formatMoney(
  amount: Money,
  options: FormatOptions = {},
): string {
  const exponent = exponentOf(amount.currency);
  const locale = amount.currency === "INR" ? "en-IN" : "en-CA";
  const major = toMajor(amount);
  const whole = amount.minor % 10 ** exponent === 0;
  const digits = options.trimZeros && whole ? 0 : exponent;

  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: amount.currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: options.compact ? 0 : digits,
    maximumFractionDigits: options.compact ? 1 : digits,
    notation: options.compact ? "compact" : "standard",
    signDisplay: options.signed ? "exceptZero" : "auto",
  }).format(major);
  return formatted.replace("-", "−");
}
