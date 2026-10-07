import type { Price, Security } from "./invest";

/**
 * Today's prices for held securities, from quotes Discover fetched.
 *
 * Money has no price feed on purpose: nothing about the portfolio leaves the
 * browser. This is the opt-in exception, for symbols the owner already sends
 * to a quote provider from the Discover watchlist. It only matches and checks.
 * A quote is used only when its currency is known and is the security's own:
 * a USD quote for a CAD-listed ETF with the same ticker is a different price,
 * and converting it would put a confident wrong number in the ledger.
 */

export interface QuoteForPricing {
  /** The watchlist entry's symbol, as the owner typed it. */
  symbol: string;
  price: number;
  /** The quote's currency, else the currency set on the watchlist entry. */
  currency: string | null;
}

export interface PricesFromQuotes {
  prices: Price[];
  skipped: { symbol: string; reason: string }[];
}

const norm = (symbol: string) => symbol.trim().toUpperCase();

export function pricesFromQuotes(
  securities: readonly Security[],
  quotes: readonly QuoteForPricing[],
  date: string,
): PricesFromQuotes {
  const bySymbol = new Map(quotes.map((q) => [norm(q.symbol), q]));
  const prices: Price[] = [];
  const skipped: PricesFromQuotes["skipped"] = [];

  for (const security of securities) {
    const quote = bySymbol.get(norm(security.symbol));
    if (!quote) continue; // Not on the watchlist, or no quote came back.
    if (!(quote.price > 0)) {
      skipped.push({ symbol: security.symbol, reason: "no usable price" });
    } else if (!quote.currency) {
      skipped.push({
        symbol: security.symbol,
        reason: "the quote's currency is unknown",
      });
    } else if (quote.currency.toUpperCase() !== security.currency) {
      skipped.push({
        symbol: security.symbol,
        reason: `quoted in ${quote.currency.toUpperCase()}, held in ${security.currency}`,
      });
    } else {
      prices.push({ securityId: security.id, date, price: quote.price });
    }
  }
  return { prices, skipped };
}

/** Securities that are also on the watchlist, so a fetch is worth offering. */
export function watchedSecurities(
  securities: readonly Security[],
  watchlistSymbols: readonly string[],
): Security[] {
  const watched = new Set(watchlistSymbols.map(norm));
  return securities.filter((s) => watched.has(norm(s.symbol)));
}
