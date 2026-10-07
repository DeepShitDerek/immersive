import { describe, expect, it } from "vitest";
import { type Price, recentPrices } from "./invest";

const prices: Price[] = [
  { securityId: "xeqt", date: "2026-09-01", price: 33 },
  { securityId: "vfv", date: "2026-09-20", price: 150 },
  { securityId: "xeqt", date: "2026-09-23", price: 34.12 },
  { securityId: "xeqt", date: "2026-09-10", price: 33.5 },
];

describe("recentPrices", () => {
  it("lists one security's prices, newest first", () => {
    expect(recentPrices(prices, "xeqt", 10).map((p) => p.date)).toEqual([
      "2026-09-23",
      "2026-09-10",
      "2026-09-01",
    ]);
  });

  it("stops at the limit, keeping the newest", () => {
    expect(recentPrices(prices, "xeqt", 2).map((p) => p.date)).toEqual([
      "2026-09-23",
      "2026-09-10",
    ]);
  });

  it("is empty for a security with no prices", () => {
    expect(recentPrices(prices, "none", 10)).toEqual([]);
  });
});
