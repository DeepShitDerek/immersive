import type { InstrumentKind, WatchlistEntry } from "./watchlist";

/**
 * Prices for the watchlist, in two tiers.
 *
 * **Crypto needs no key.** CoinGecko is keyless and CORS-open, so a crypto
 * entry has a live price and a 24-hour change today, with nothing to configure.
 *
 * **Equities need one, and it has to be yours.** No keyless, CORS-open source
 * for stock, ETF or index quotes exists — that was tested, not assumed; see
 * `watchlist.ts` for what was tried and what each one returned. Finnhub and
 * Twelve Data are both CORS-open and both have a free tier, so a key you own
 * makes those rows live.
 *
 * The key is stored on `integration_settings`, which has RLS and **no public
 * read policy at all**, and Discover is an admin route — so the owner's own
 * browser reads it and it never enters the bundle. That is the same argument
 * as for the Discord webhook, and the reason a
 * `NEXT_PUBLIC_*` key is not an option here.
 *
 * **Funds and bonds stay a link-out.** Neither free tier covers them, and a
 * row that silently shows nothing while its neighbours show prices reads as a
 * bug. `quotableKinds` says which is which, so the UI can be explicit.
 */

export type QuoteProvider = "finnhub" | "twelvedata";

export const QUOTE_PROVIDERS: {
  id: QuoteProvider;
  label: string;
  /** Where to get a key, since the whole feature depends on the owner doing so. */
  signup: string;
  freeTier: string;
}[] = [
  {
    id: "finnhub",
    label: "Finnhub",
    signup: "https://finnhub.io/register",
    freeTier: "60 calls a minute",
  },
  {
    id: "twelvedata",
    label: "Twelve Data",
    signup: "https://twelvedata.com/pricing",
    freeTier: "800 calls a day",
  },
];

/** Kinds a provider can actually price. The rest link out. */
const QUOTABLE_KINDS: InstrumentKind[] = ["stock", "etf", "index", "crypto"];

export function isQuotable(kind: InstrumentKind, hasKey: boolean): boolean {
  if (kind === "crypto") return true; // keyless
  return hasKey && QUOTABLE_KINDS.includes(kind);
}

export interface Quote {
  /** Matches `WatchlistEntry.id`. */
  entryId: string;
  price: number;
  /** Percent, over the provider's own day. Null when it does not say. */
  change: number | null;
  currency: string | null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/* ── Crypto, keyless ─────────────────────────────────────────────────────── */

/**
 * CoinGecko is addressed by *id* (`bitcoin`), not by ticker (`BTC`).
 *
 * A watchlist stores what the owner typed, which will be the ticker, so the
 * two have to be bridged. The full coin list is a 400 kB document and pulling
 * it to resolve three symbols would be absurd, so common tickers are mapped
 * directly and anything else falls back to the lower-cased symbol — which is
 * correct surprisingly often, because CoinGecko ids and tickers coincide for
 * many smaller coins.
 *
 * A wrong id yields no entry in the response, which the parser treats as "no
 * quote" rather than as an error. Missing a price is the right failure here;
 * showing somebody else's is not.
 */
const COIN_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  DOT: "polkadot",
  MATIC: "matic-network",
  XRP: "ripple",
  DOGE: "dogecoin",
  LTC: "litecoin",
  LINK: "chainlink",
  AVAX: "avalanche-2",
  USDT: "tether",
  USDC: "usd-coin",
};

function coinIdFor(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  return COIN_IDS[upper] ?? upper.toLowerCase();
}

function cryptoQuotesUrl(symbols: string[], vs: string): string {
  const ids = Array.from(new Set(symbols.map(coinIdFor))).join(",");
  return (
    "https://api.coingecko.com/api/v3/simple/price" +
    `?ids=${encodeURIComponent(ids)}` +
    `&vs_currencies=${encodeURIComponent(vs.toLowerCase())}` +
    "&include_24hr_change=true"
  );
}

function parseCryptoQuotes(
  body: unknown,
  entries: WatchlistEntry[],
  vs: string,
): Quote[] {
  if (typeof body !== "object" || body === null) return [];
  const data = body as Record<string, Record<string, number>>;
  const currency = vs.toLowerCase();

  return entries
    .map((entry): Quote | null => {
      const row = data[coinIdFor(entry.symbol)];
      const price = num(row?.[currency]);
      if (price === null) return null;

      return {
        entryId: entry.id,
        price,
        change: num(row[`${currency}_24h_change`]),
        currency: vs.toUpperCase(),
      };
    })
    .filter((quote): quote is Quote => quote !== null);
}

/* ── Equities, keyed ─────────────────────────────────────────────────────── */

/**
 * One symbol per request, which is what both free tiers allow.
 *
 * Batch endpoints are a paid feature on both, so a watchlist of twelve
 * equities is twelve calls. That is within Finnhub's 60-a-minute and Twelve
 * Data's 800-a-day, and it is the reason the panel fetches on demand rather
 * than on every render.
 */
function equityQuoteUrl(
  provider: QuoteProvider,
  symbol: string,
  key: string,
): string {
  const ticker = encodeURIComponent(symbol.trim().toUpperCase());
  const token = encodeURIComponent(key);

  return provider === "finnhub"
    ? `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${token}`
    : `https://api.twelvedata.com/quote?symbol=${ticker}&apikey=${token}`;
}

/**
 * Both providers' shapes, normalised.
 *
 * Finnhub answers `{ c, dp }` — current and percent change — and returns
 * `c: 0` for a symbol it does not know rather than an error, which is exactly
 * the kind of confident wrong answer to guard against. A price of zero is
 * treated as no quote.
 */
function parseEquityQuote(
  provider: QuoteProvider,
  body: unknown,
  entryId: string,
): Quote | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;

  if (provider === "finnhub") {
    const price = num(record.c);
    // Finnhub reports an unknown symbol as a zero price, not as an error.
    if (price === null || price === 0) return null;
    return {
      entryId,
      price,
      change: num(record.dp),
      currency: null,
    };
  }

  const price = num(Number(record.close));
  if (price === null || price === 0) return null;
  return {
    entryId,
    price,
    change: num(Number(record.percent_change)),
    currency: typeof record.currency === "string" ? record.currency : null,
  };
}

/**
 * Every quote the current configuration can produce.
 *
 * Crypto in one call; equities one call each, and only when a key exists. Each
 * request resolves rather than throws — these sit on someone else's uptime and
 * behind whatever the browser's ad-blocker decides — so a provider being down
 * costs those rows their price and nothing else.
 */
export async function fetchQuotes(
  entries: WatchlistEntry[],
  options: {
    baseCurrency: string;
    provider?: QuoteProvider | null;
    key?: string | null;
    fetchJson: <T>(url: string) => Promise<T | null>;
  },
): Promise<Quote[]> {
  const { baseCurrency, provider, key, fetchJson } = options;

  const crypto = entries.filter((entry) => entry.kind === "crypto");
  const equities =
    provider && key
      ? entries.filter(
          (entry) =>
            entry.kind !== "crypto" && QUOTABLE_KINDS.includes(entry.kind),
        )
      : [];

  const [cryptoBody, equityBodies] = await Promise.all([
    crypto.length > 0
      ? fetchJson<unknown>(
          cryptoQuotesUrl(
            crypto.map((entry) => entry.symbol),
            baseCurrency,
          ),
        )
      : Promise.resolve(null),
    Promise.all(
      equities.map(async (entry) => ({
        entry,
        body: await fetchJson<unknown>(
          equityQuoteUrl(provider!, entry.symbol, key!),
        ),
      })),
    ),
  ]);

  return [
    ...(cryptoBody === null
      ? []
      : parseCryptoQuotes(cryptoBody, crypto, baseCurrency)),
    ...equityBodies
      .map(({ entry, body }) =>
        body === null ? null : parseEquityQuote(provider!, body, entry.id),
      )
      .filter((quote): quote is Quote => quote !== null),
  ];
}
