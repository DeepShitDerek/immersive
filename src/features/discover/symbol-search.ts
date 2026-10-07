import type { InstrumentKind } from "./watchlist";

/**
 * Finding an instrument by name, so nobody has to know its ticker.
 *
 * Typing a raw symbol and an exchange code is a bad ask — most people know
 * "Shopify", not that it is `SHOP` on NASDAQ *and* `SHOP` on the TSX at
 * different prices in different currencies. That ambiguity is exactly why the
 * watchlist has an exchange field, and exactly why the field cannot reasonably
 * be filled by hand.
 *
 * Both search endpoints are **keyless and CORS-open**, which was tested:
 *
 * - **Twelve Data `symbol_search`** answers without a token, unlike its quote
 *   endpoint. So searching works before any key is configured, even though
 *   pricing does not — the shape of the whole module.
 * - **CoinGecko `search`** covers coins.
 *
 * A result carries the venue and currency with it, so choosing one fills in
 * everything the entry needs and the exchange is never typed.
 */

export interface SymbolResult {
  symbol: string;
  name: string;
  kind: InstrumentKind;
  exchange: string | null;
  currency: string | null;
  country: string | null;
  /** For crypto, CoinGecko's id — the thing its price endpoint is keyed on. */
  providerId?: string | null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function symbolSearchUrl(query: string): string {
  // Encoded, not interpolated: a query containing `&` would truncate the URL
  // and silently search for something else.
  return `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(
    query,
  )}&outputsize=12`;
}

function coinSearchUrl(query: string): string {
  return `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(
    query,
  )}`;
}

/**
 * Twelve Data's `instrument_type`, mapped to the kinds the watchlist stores.
 *
 * The list is deliberately incomplete: anything unrecognised becomes `stock`
 * rather than being dropped, because a result you cannot categorise is still a
 * result, and losing it would make the search look broken for exactly the
 * instruments that are unusual enough to be worth searching for.
 */
function kindFromInstrumentType(type: string | null): InstrumentKind {
  const value = (type ?? "").toLowerCase();

  if (value.includes("etf")) return "etf";
  if (value.includes("fund") || value.includes("mutual")) return "fund";
  if (value.includes("index")) return "index";
  if (value.includes("bond")) return "bond";
  if (value.includes("digital") || value.includes("crypto")) return "crypto";
  return "stock";
}

function parseSymbolResults(body: unknown): SymbolResult[] {
  const rows = (body as { data?: unknown[] } | null)?.data;
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row): SymbolResult | null => {
      if (typeof row !== "object" || row === null) return null;
      const record = row as Record<string, unknown>;

      const symbol = text(record.symbol);
      if (!symbol) return null;

      return {
        symbol,
        name: text(record.instrument_name) ?? symbol,
        kind: kindFromInstrumentType(text(record.instrument_type)),
        exchange: text(record.exchange),
        currency: text(record.currency),
        country: text(record.country),
      };
    })
    .filter((result): result is SymbolResult => result !== null);
}

function parseCoinResults(body: unknown): SymbolResult[] {
  const coins = (body as { coins?: unknown[] } | null)?.coins;
  if (!Array.isArray(coins)) return [];

  return coins
    .map((row): SymbolResult | null => {
      if (typeof row !== "object" || row === null) return null;
      const record = row as Record<string, unknown>;

      const symbol = text(record.symbol);
      const id = text(record.id);
      if (!symbol || !id) return null;

      return {
        symbol: symbol.toUpperCase(),
        name: text(record.name) ?? symbol,
        kind: "crypto",
        // A coin trades everywhere; naming one venue would be a false
        // precision, and the watchlist's uniqueness key treats null as its own
        // venue, so two coins never collide with an equity of the same ticker.
        exchange: null,
        currency: null,
        country: null,
        providerId: id,
      };
    })
    .filter((result): result is SymbolResult => result !== null);
}

/**
 * Search both, coins first.
 *
 * Coins lead because CoinGecko's results are the ones that can be priced
 * immediately with no key — putting the actionable results at the top is worth
 * more than alphabetical fairness between two providers.
 *
 * Each request resolves rather than throws, so one provider being down
 * shortens the list instead of emptying it.
 */
export async function searchSymbols(
  query: string,
  fetchJson: <T>(url: string) => Promise<T | null>,
  limit = 10,
): Promise<SymbolResult[]> {
  const term = query.trim();
  // Two characters is where a prefix search stops being a scan of everything.
  if (term.length < 2) return [];

  const [equities, coins] = await Promise.all([
    fetchJson<unknown>(symbolSearchUrl(term)),
    fetchJson<unknown>(coinSearchUrl(term)),
  ]);

  const results = [
    ...(coins === null ? [] : parseCoinResults(coins)).slice(0, 3),
    ...(equities === null ? [] : parseSymbolResults(equities)),
  ];

  // The same listing can appear twice across providers; keyed on the pair the
  // watchlist itself treats as unique.
  const seen = new Set<string>();
  return results
    .filter((result) => {
      const key = `${result.symbol.toUpperCase()}|${result.exchange ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
