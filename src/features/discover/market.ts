/**
 * Money and markets, read from the browser without a key.
 *
 * What is *not* here matters as much as what is. Equity indices — S&P, TSX,
 * Nifty — have no keyless source a browser can reach: Yahoo's endpoint rate
 * limits and sends no `access-control-allow-origin`, and Stooq's CSV is gone.
 * Everything else needs a key, which in a static export means publishing it.
 * So this covers currencies, crypto and published economic figures, and the UI
 * says plainly that indices are missing rather than substituting something
 * that looks like them.
 *
 * The currency panel is the one that earns its place. Someone earning in one
 * country and sending money to family in another has a real, recurring
 * question — *is this a good week to send* — and a thirty-day rate series
 * answers it far better than today's number alone.
 */

const FX = "https://api.frankfurter.dev/v1";

/* ── Currencies ──────────────────────────────────────────────────────────── */

export function fxSeriesUrl(
  base: string,
  quote: string,
  days = 30,
  now = new Date(),
): string {
  const from = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - days,
  );
  return `${FX}/${isoDate(from)}..${isoDate(now)}?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(quote)}`;
}

/** Local calendar fields, not an ISO slice — the trap fixed across this app. */
function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export interface RateSeries {
  dates: string[];
  values: number[];
  latest: number;
  average: number;
  /** How far today sits above or below the period average, as a percent. */
  deviation: number;
  high: number;
  low: number;
}

export function parseRateSeries(
  body: unknown,
  quote: string,
): RateSeries | null {
  const rates = (body as { rates?: Record<string, Record<string, number>> })
    ?.rates;
  if (!rates || typeof rates !== "object") return null;

  // Sorted explicitly: object key order is not a guarantee worth resting a
  // chart on, and a series drawn out of order is a scribble.
  const dates = Object.keys(rates).sort();
  const values: number[] = [];
  const kept: string[] = [];

  for (const date of dates) {
    const value = rates[date]?.[quote];
    if (typeof value === "number" && Number.isFinite(value)) {
      values.push(value);
      kept.push(date);
    }
  }

  if (values.length === 0) return null;

  const latest = values[values.length - 1];
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    dates: kept,
    values,
    latest,
    average,
    // Guarded: an average of zero is not a real rate, but dividing by it would
    // produce Infinity and render as a very confident recommendation.
    deviation: average === 0 ? 0 : ((latest - average) / average) * 100,
    high: Math.max(...values),
    low: Math.min(...values),
  };
}

export type SendSignal = "good" | "fair" | "poor";

/**
 * Whether today is a good day to send money home.
 *
 * Deliberately coarse. This compares today's rate against the last month's
 * average and nothing else — it is not a forecast, and three buckets is the
 * most that comparison can honestly support. A precise-looking score from one
 * moving average would imply an authority it does not have.
 */
export function sendSignal(deviation: number): SendSignal {
  if (deviation >= 0.5) return "good";
  if (deviation <= -0.5) return "poor";
  return "fair";
}

export function describeSignal(signal: SendSignal, quote: string): string {
  if (signal === "good")
    return `Above the month's average — a good week to send ${quote}`;
  if (signal === "poor")
    return `Below the month's average — worth waiting if you can`;
  return "About average for the month";
}

/* ── Crypto ──────────────────────────────────────────────────────────────── */

const COINS = [
  { id: "bitcoin", label: "Bitcoin", symbol: "BTC" },
  { id: "ethereum", label: "Ethereum", symbol: "ETH" },
] as const;

export function cryptoUrl(vs = "usd"): string {
  const ids = COINS.map((coin) => coin.id).join(",");
  return `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${encodeURIComponent(vs)}&include_24hr_change=true`;
}

export interface Coin {
  id: string;
  label: string;
  symbol: string;
  price: number;
  change24h: number;
}

export function parseCoins(body: unknown, vs = "usd"): Coin[] {
  if (typeof body !== "object" || body === null) return [];
  const data = body as Record<string, Record<string, number>>;

  return COINS.map((coin): Coin | null => {
    const entry = data[coin.id];
    const price = entry?.[vs];
    if (typeof price !== "number" || !Number.isFinite(price)) return null;

    const change = entry[`${vs}_24h_change`];
    return {
      ...coin,
      price,
      // A missing change is zero, not absent: the row is about the price, and
      // hiding it entirely over one field would be worse.
      change24h:
        typeof change === "number" && Number.isFinite(change) ? change : 0,
    };
  }).filter((coin): coin is Coin => coin !== null);
}

/* ── Economic indicators ─────────────────────────────────────────────────── */

/**
 * World Bank indicators, which are annual and published in arrears.
 *
 * Slow data, deliberately labelled as such. Inflation for the year you are
 * living through does not exist yet, and a panel that implies otherwise is
 * worse than one that says "2025".
 */
export const INDICATORS = {
  inflation: "FP.CPI.TOTL.ZG",
  unemployment: "SL.UEM.TOTL.ZS",
} as const;

export function indicatorUrl(country: string, indicator: string): string {
  return `https://api.worldbank.org/v2/country/${encodeURIComponent(country)}/indicator/${encodeURIComponent(indicator)}?format=json&per_page=8`;
}

export interface Indicator {
  label: string;
  year: string;
  value: number;
}

/**
 * The most recent year that actually has a figure.
 *
 * The API returns the last several years with `null` for the ones not yet
 * published, so taking the first row gives an empty panel most of the time.
 */
export function parseIndicator(body: unknown): Indicator | null {
  if (!Array.isArray(body) || body.length < 2) return null;
  const rows = body[1];
  if (!Array.isArray(rows)) return null;

  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const record = row as Record<string, unknown>;

    const value = record.value;
    const year = record.date;
    if (typeof value !== "number" || typeof year !== "string") continue;

    const indicator = record.indicator as { value?: string } | undefined;
    return {
      label: indicator?.value ?? "Indicator",
      year,
      value,
    };
  }

  return null;
}

/** `2.0723…` → `2.1%`. Six decimal places is not a fact anyone needs. */
/**
 * A percentage. A change carries its "+", so its direction never rests on
 * colour (1.4.1); a level (unemployment, inflation) is `signed: false`.
 */
export function formatPercent(
  value: number,
  digits = 1,
  signed = true,
): string {
  return `${signed && value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}
