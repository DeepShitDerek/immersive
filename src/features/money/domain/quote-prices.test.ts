import { describe, expect, it } from "vitest";
import type { Security } from "./invest";
import { pricesFromQuotes, watchedSecurities } from "./quote-prices";

const security = (id: string, symbol: string, currency: string) =>
  ({
    id,
    symbol,
    name: symbol,
    currency,
    assetClass: "equity",
    region: "canada",
    notes: null,
  }) as unknown as Security;

const held = [
  security("s1", "XEQT", "CAD"),
  security("s2", "VFV", "CAD"),
  security("s3", "BTC", "CAD"),
  security("s4", "AAPL", "USD"),
];

describe("today's prices from Discover", () => {
  it("uses a quote only in the security's own currency", () => {
    const { prices, skipped } = pricesFromQuotes(
      held,
      [
        { symbol: "xeqt", price: 31.2, currency: "CAD" },
        { symbol: "VFV", price: 140.5, currency: "USD" }, // same ticker, other listing
        { symbol: "BTC", price: 0, currency: "CAD" },
        { symbol: "AAPL", price: 227.1, currency: null },
      ],
      "2026-09-25",
    );
    expect(prices).toEqual([
      { securityId: "s1", date: "2026-09-25", price: 31.2 },
    ]);
    expect(skipped).toEqual([
      { symbol: "VFV", reason: "quoted in USD, held in CAD" },
      { symbol: "BTC", reason: "no usable price" },
      { symbol: "AAPL", reason: "the quote's currency is unknown" },
    ]);
  });

  it("offers the fetch only for held securities that are on the watchlist", () => {
    expect(
      watchedSecurities(held, ["btc", "TSLA"]).map((s) => s.symbol),
    ).toEqual(["BTC"]);
  });
});
