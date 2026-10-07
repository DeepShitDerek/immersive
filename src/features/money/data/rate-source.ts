import { isIsoDate } from "../domain/dates";
import type { RateRow } from "../domain/fx";

/**
 * Exchange rates from frankfurter.dev: the European Central Bank's
 * daily reference rates, free, keyless and CORS-enabled — no server of ours
 * is involved, which matters for a static site.
 *
 * ECB rates are mid-market reference rates published once a working day,
 * not what a bank or remittance service will give; that gap is what
 * `remittanceCost` measures. Currencies the ECB does not publish (AED, SAR,
 * KWD, …) have no rate from here and are entered by hand.
 *
 * Every response is validated; anything malformed yields no rows rather
 * than a wrong one.
 */

const ENDPOINT = "https://api.frankfurter.dev/v1";

/** What the ECB publishes (2025). */
const ECB_CURRENCIES: ReadonlySet<string> = new Set([
  "AUD",
  "BGN",
  "BRL",
  "CAD",
  "CHF",
  "CNY",
  "CZK",
  "DKK",
  "EUR",
  "GBP",
  "HKD",
  "HUF",
  "IDR",
  "ILS",
  "INR",
  "ISK",
  "JPY",
  "KRW",
  "MXN",
  "MYR",
  "NOK",
  "NZD",
  "PHP",
  "PLN",
  "RON",
  "SEK",
  "SGD",
  "THB",
  "TRY",
  "USD",
  "ZAR",
]);

export const hasPublishedRate = (currency: string): boolean =>
  ECB_CURRENCIES.has(currency);

type Fetch = typeof fetch;

function rowsFrom(
  base: string,
  byDate: Record<string, Record<string, unknown>>,
): RateRow[] {
  const rows: RateRow[] = [];
  for (const [date, quotes] of Object.entries(byDate)) {
    if (!isIsoDate(date) || !quotes || typeof quotes !== "object") continue;
    for (const [quote, value] of Object.entries(quotes)) {
      const rate = Number(value);
      if (
        /^[A-Z]{3}$/.test(quote) &&
        quote !== base &&
        Number.isFinite(rate) &&
        rate > 0
      ) {
        rows.push({ base, quote, asOf: date, rate });
      }
    }
  }
  return rows.sort(
    (a, b) => a.asOf.localeCompare(b.asOf) || a.quote.localeCompare(b.quote),
  );
}

/** The latest published rates from `base` into each of `quotes`. */
export async function fetchLatest(
  base: string,
  quotes: readonly string[],
  {
    fetchImpl = fetch,
    signal,
  }: { fetchImpl?: Fetch; signal?: AbortSignal } = {},
): Promise<RateRow[]> {
  const wanted = quotes.filter((q) => q !== base && hasPublishedRate(q));
  if (!hasPublishedRate(base) || wanted.length === 0) return [];
  const response = await fetchImpl(
    `${ENDPOINT}/latest?base=${base}&symbols=${wanted.join(",")}`,
    { signal },
  );
  if (!response.ok) throw new Error(`Rates unavailable (${response.status})`);
  const body = (await response.json()) as { date?: unknown; rates?: unknown };
  if (
    typeof body.date !== "string" ||
    !body.rates ||
    typeof body.rates !== "object"
  )
    return [];
  return rowsFrom(base, { [body.date]: body.rates as Record<string, unknown> });
}

/** Daily rates from `base` into `quotes` since `from` (inclusive). */
export async function fetchSeries(
  base: string,
  quotes: readonly string[],
  from: string,
  {
    fetchImpl = fetch,
    signal,
  }: { fetchImpl?: Fetch; signal?: AbortSignal } = {},
): Promise<RateRow[]> {
  const wanted = quotes.filter((q) => q !== base && hasPublishedRate(q));
  if (!hasPublishedRate(base) || wanted.length === 0 || !isIsoDate(from))
    return [];
  const response = await fetchImpl(
    `${ENDPOINT}/${from}..?base=${base}&symbols=${wanted.join(",")}`,
    { signal },
  );
  if (!response.ok) throw new Error(`Rates unavailable (${response.status})`);
  const body = (await response.json()) as { rates?: unknown };
  if (!body.rates || typeof body.rates !== "object") return [];
  return rowsFrom(base, body.rates as Record<string, Record<string, unknown>>);
}
