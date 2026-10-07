import { describe, expect, it } from "vitest";
import { buildRateTable, priceInBase, quoteAge, remittanceCost } from "./fx";
import { money } from "./money";

const rates = buildRateTable([
  { base: "CAD", quote: "INR", asOf: "2026-02-02", rate: 60 },
  { base: "CAD", quote: "INR", asOf: "2026-02-06", rate: 61 },
  { base: "USD", quote: "CAD", asOf: "2026-02-05", rate: 1.35 },
  { base: "USD", quote: "EUR", asOf: "2026-02-04", rate: 0.9 },
  { base: "CAD", quote: "BAD", asOf: "2026-02-04", rate: 0 },
]);

describe("rate lookup", () => {
  it("uses the latest rate on or before the day", () => {
    expect(rates.quote("CAD", "INR", "2026-02-05")).toMatchObject({
      rate: 60,
      asOf: "2026-02-02",
      route: "direct",
    });
    expect(rates.quote("CAD", "INR", "2026-02-06")?.rate).toBe(61);
    expect(rates.quote("CAD", "INR", "2026-12-31")?.rate).toBe(61);
    expect(rates.quote("CAD", "INR", "2026-02-01")).toBeNull();
  });

  it("inverts and crosses when it has to", () => {
    expect(rates.quote("INR", "CAD", "2026-02-06")).toMatchObject({
      route: "inverse",
    });
    expect(rates.quote("INR", "CAD", "2026-02-06")!.rate).toBeCloseTo(
      1 / 61,
      12,
    );
    const cross = rates.quote("EUR", "CAD", "2026-02-10")!;
    expect(cross.route).toBe("cross");
    expect(cross.rate).toBeCloseTo(1.35 / 0.9, 12);
    expect(cross.asOf).toBe("2026-02-04");
  });

  it("returns null with no route and ignores nonsense rows", () => {
    expect(rates.quote("CAD", "JPY", "2026-02-10")).toBeNull();
    expect(rates.quote("CAD", "BAD", "2026-02-10")).toBeNull();
    expect(rates.quote("CAD", "CAD", "2026-02-10")).toMatchObject({
      rate: 1,
      route: "same",
    });
  });

  it("reports how stale a quote is", () => {
    const q = rates.quote("CAD", "INR", "2026-02-20")!;
    expect(quoteAge(q, "2026-02-20")).toBe(14);
  });
});

describe("pricing a posting", () => {
  it("prices the base currency at 1 and others at the day's rate", () => {
    expect(
      priceInBase(money(-4500, "CAD"), "CAD", "2026-02-06", rates),
    ).toEqual({ fxRate: 1, baseAmountMinor: -4500 });
    const inr = priceInBase(money(6100000, "INR"), "CAD", "2026-02-06", rates)!;
    expect(inr.baseAmountMinor).toBe(100000);
  });

  it("refuses to guess when there is no rate", () => {
    expect(
      priceInBase(money(100, "JPY"), "CAD", "2026-02-06", rates),
    ).toBeNull();
  });
});

describe("remittance cost", () => {
  it("adds the hidden FX margin to the visible fee", () => {
    // Sent $1,000.00 plus a $4.99 fee; ₹60,000 arrived; market was 61.
    const cost = remittanceCost({
      sent: money(-100000, "CAD"),
      received: money(6000000, "INR"),
      fee: money(-499, "CAD"),
      marketRate: 61,
    });
    expect(cost.deliveredRate).toBeCloseTo(60, 10);
    expect(cost.atMarket).toEqual(money(6100000, "INR"));
    expect(cost.marginReceived).toEqual(money(100000, "INR")); // ₹1,000 short
    expect(cost.totalCost).toEqual(money(1639 + 499, "CAD")); // $16.39 + $4.99
    expect(cost.costRatio).toBeCloseTo(0.02138, 4);
  });

  it("shows a better-than-market rate as a negative margin", () => {
    const cost = remittanceCost({
      sent: money(100000, "CAD"),
      received: money(6120000, "INR"),
      fee: money(0, "CAD"),
      marketRate: 61,
    });
    expect(cost.marginReceived.minor).toBe(-20000);
    expect(cost.totalCost.minor).toBeLessThan(0);
  });

  it("refuses a fee in the wrong currency", () => {
    expect(() =>
      remittanceCost({
        sent: money(1, "CAD"),
        received: money(1, "INR"),
        fee: money(1, "INR"),
        marketRate: 61,
      }),
    ).toThrow();
  });
});
