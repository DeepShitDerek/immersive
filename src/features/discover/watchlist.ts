/**
 * A watchlist for instruments this app cannot quote.
 *
 * ## What was tested, and what it means
 *
 * Every other source in Discover is keyless and CORS-open, because a static
 * export has no server: a key would travel as `NEXT_PUBLIC_*` and be compiled
 * into the bundle. Quotes for stocks, ETFs and funds are the one thing with no
 * such source, and that was checked rather than assumed:
 *
 * | Source           | Result                                                    |
 * | ---------------- | --------------------------------------------------------- |
 * | Yahoo Finance    | 429 on the first request; unofficial endpoint             |
 * | Stooq CSV        | 404 on its documented shapes, and sends no CORS headers   |
 * | marketdata.app   | answers for the single demo symbol `AAPL`, "No credentials provided" for everything else |
 * | Alpha Vantage, Finnhub, Twelve Data, Polygon, FMP | key required up front |
 *
 * CoinGecko (crypto) and Frankfurter (FX) *are* keyless and open, which is why
 * those two work today and equities do not.
 *
 * ## So the watchlist works in two modes, and says which
 *
 * **Without a key** it is a list you maintain: what you follow, what kind of
 * instrument it is, where it trades, and why you are watching it — with a link
 * out to a quote. That is genuinely useful and it is honest. No number is
 * invented to fill the space, which is the specific thing the brief ruled out.
 *
 * **With a key** — pasted into the admin, stored on `integration_settings`,
 * which has RLS and *no public read policy at all* — quotes appear. Discover is
 * an admin route, so the owner's own browser can read that row and the key
 * never enters the bundle. It is the same argument as for the Discord webhook.
 */

export type InstrumentKind =
  | "stock"
  | "etf"
  | "fund"
  | "index"
  | "crypto"
  | "bond";

export const INSTRUMENT_KINDS: { id: InstrumentKind; label: string }[] = [
  { id: "stock", label: "Stock" },
  { id: "etf", label: "ETF" },
  { id: "fund", label: "Mutual fund" },
  { id: "index", label: "Index" },
  { id: "crypto", label: "Crypto" },
  { id: "bond", label: "Bond" },
];

export interface WatchlistEntry {
  id: string;
  symbol: string;
  name?: string | null;
  kind: InstrumentKind;
  exchange?: string | null;
  currency?: string | null;
  note?: string | null;
  display_order?: number | null;
}

/**
 * Tidy a typed symbol without deciding it is wrong.
 *
 * Upper-cased and stripped of surrounding whitespace, because that is how
 * every venue prints them and a lower-case entry would sort away from its
 * neighbours. Interior characters are left alone: `BRK.B`, `SHOP.TO` and
 * `0P0000XYZ1` are all real, and a validator that only allowed letters would
 * reject two thirds of what a Canadian investor actually holds.
 */
export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Two entries are the same instrument if they name the same thing on the same venue. */
function isDuplicate(
  entries: WatchlistEntry[],
  symbol: string,
  exchange?: string | null,
): boolean {
  const wanted = normalizeSymbol(symbol);
  const venue = (exchange ?? "").trim().toUpperCase();

  return entries.some(
    (entry) =>
      normalizeSymbol(entry.symbol) === wanted &&
      (entry.exchange ?? "").trim().toUpperCase() === venue,
  );
}

export interface SymbolProblem {
  field: "symbol" | "exchange";
  message: string;
}

/**
 * What is wrong with an entry, or nothing.
 *
 * Bounds mirror `discover_watchlist`'s CHECK constraints, so a value the form
 * accepts cannot be one Postgres rejects — which surfaces as an opaque write
 * failure rather than as a message.
 */
export function validateEntry(
  entries: WatchlistEntry[],
  input: { symbol: string; exchange?: string | null },
): SymbolProblem | null {
  const symbol = normalizeSymbol(input.symbol);

  if (!symbol) {
    return { field: "symbol", message: "A symbol is needed." };
  }
  if (symbol.length > 32) {
    return { field: "symbol", message: "That is longer than any real ticker." };
  }
  if ((input.exchange ?? "").trim().length > 32) {
    return { field: "exchange", message: "Exchange is too long." };
  }
  if (isDuplicate(entries, symbol, input.exchange)) {
    return { field: "symbol", message: `${symbol} is already on the list.` };
  }

  return null;
}

/**
 * Where to go and look at the price.
 *
 * The honest substitute for a quote this app cannot fetch: one click to a
 * source that can. Yahoo is used because it covers every kind of instrument in
 * `INSTRUMENT_KINDS` including mutual funds, which most alternatives do not.
 *
 * The symbol is encoded rather than interpolated. `BRK.B` is fine; a symbol
 * containing `&` would truncate the query and silently look up something else,
 * which is the trap already recorded for the Discover topic search.
 */
export function quoteUrl(
  entry: Pick<WatchlistEntry, "symbol" | "kind">,
): string {
  const symbol = encodeURIComponent(normalizeSymbol(entry.symbol));

  if (entry.kind === "crypto") {
    return `https://www.coingecko.com/en/search?query=${symbol}`;
  }
  return `https://finance.yahoo.com/quote/${symbol}`;
}

/** Grouped for display, in the order `INSTRUMENT_KINDS` declares. */
export function groupByKind(
  entries: WatchlistEntry[],
): { kind: InstrumentKind; label: string; entries: WatchlistEntry[] }[] {
  return INSTRUMENT_KINDS.map(({ id, label }) => ({
    kind: id,
    label,
    entries: entries
      .filter((entry) => entry.kind === id)
      .sort(
        (a, b) =>
          (a.display_order ?? 0) - (b.display_order ?? 0) ||
          normalizeSymbol(a.symbol).localeCompare(normalizeSymbol(b.symbol)),
      ),
  })).filter((group) => group.entries.length > 0);
}
