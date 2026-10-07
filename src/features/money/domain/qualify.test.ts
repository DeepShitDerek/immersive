import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOCUMENTS,
  documentProgress,
  recentInquiries,
} from "./applications";
import {
  debtServiceRatios,
  housingExtras,
  insurancePremiumRate,
  maximumMortgage,
  minimumDownPayment,
  qualifyingPayment,
  qualifyingRate,
  revolvingPayment,
} from "./qualify";

describe("stress test", () => {
  it("qualifies at the contract rate + 2, never below the floor", () => {
    expect(qualifyingRate(4.5)).toBe(6.5);
    expect(qualifyingRate(2.99)).toBe(5.25);
    expect(qualifyingRate(3.25)).toBe(5.25);
  });

  it("prices the qualifying payment higher than the contract payment", () => {
    // $400,000 at 4.5% qualifies at 6.5%: ~$2,684/month over 25 years.
    const payment = qualifyingPayment(40_000_000, 4.5, 300);
    expect(payment).toBeGreaterThan(266_000);
    expect(payment).toBeLessThan(270_000);
  });
});

describe("down payment and insurance", () => {
  it.each([
    [40_000_000, 2_000_000], // $400k: 5%
    [50_000_000, 2_500_000], // $500k: 5%
    [70_000_000, 4_500_000], // $700k: $25k + 10% of $200k
    [150_000_000, 30_000_000], // $1.5M: 20%
    [0, 0],
  ])("minimum down on %i is %i", (price, down) => {
    expect(minimumDownPayment(price)).toBe(down);
  });

  it("charges CMHC by loan-to-value", () => {
    expect(insurancePremiumRate(40_000_000, 50_000_000)).toBeNull(); // 80%
    expect(insurancePremiumRate(42_500_000, 50_000_000)).toBe(0.028); // 85%
    expect(insurancePremiumRate(45_000_000, 50_000_000)).toBe(0.031); // 90%
    expect(insurancePremiumRate(47_500_000, 50_000_000)).toBe(0.04); // 95%
    expect(() => insurancePremiumRate(48_000_000, 50_000_000)).toThrow();
  });
});

describe("debt service ratios", () => {
  const costs = {
    propertyTaxMonthlyMinor: 30_000,
    heatingMonthlyMinor: 10_000,
    condoFeesMonthlyMinor: 40_000,
  };

  it("counts half the condo fees", () => {
    expect(housingExtras(costs)).toBe(60_000);
  });

  it("computes GDS and TDS against gross income", () => {
    const r = debtServiceRatios({
      grossMonthlyIncomeMinor: 800_000,
      mortgagePaymentMinor: 240_000,
      costs,
      otherDebtPaymentsMinor: 60_000,
    })!;
    expect(r.gds).toBeCloseTo(0.375);
    expect(r.tds).toBeCloseTo(0.45);
    expect(r).toMatchObject({ passesGds: true, passesTds: false });
    expect(
      debtServiceRatios({
        grossMonthlyIncomeMinor: 0,
        mortgagePaymentMinor: 1,
        costs,
        otherDebtPaymentsMinor: 0,
      }),
    ).toBeNull();
  });

  it("finds the largest mortgage both ratios allow, which then just passes", () => {
    const input = {
      grossMonthlyIncomeMinor: 800_000,
      costs,
      otherDebtPaymentsMinor: 60_000,
      contractRatePct: 4.5,
      amortizationMonths: 300,
    };
    const max = maximumMortgage(input);
    expect(max).toBeGreaterThan(0);
    const at = debtServiceRatios({
      ...input,
      mortgagePaymentMinor: qualifyingPayment(max, 4.5, 300),
    })!;
    expect(at.passesGds && at.passesTds).toBe(true);
    const over = debtServiceRatios({
      ...input,
      mortgagePaymentMinor: qualifyingPayment(max + 500_000, 4.5, 300),
    })!;
    expect(over.passesGds && over.passesTds).toBe(false);
    expect(
      maximumMortgage({ ...input, otherDebtPaymentsMinor: 10_000_000 }),
    ).toBe(0);
  });

  it("counts 3% of a revolving balance", () => {
    expect(revolvingPayment(400_000)).toBe(12_000);
    expect(revolvingPayment(-500)).toBe(0);
  });
});

describe("applications", () => {
  it("lists newcomer documents for every product", () => {
    for (const docs of Object.values(DEFAULT_DOCUMENTS)) {
      expect(docs.length).toBeGreaterThan(2);
      expect(new Set(docs).size).toBe(docs.length);
      expect(docs.every((d) => d.length <= 160)).toBe(true);
    }
    expect(DEFAULT_DOCUMENTS.mortgage.join(" ")).toMatch(/PR card/);
  });

  it("counts hard inquiries in the last year", () => {
    expect(
      recentInquiries(
        [
          { hardInquiryOn: "2025-08-01" },
          { hardInquiryOn: "2026-03-01" },
          { hardInquiryOn: null },
          { hardInquiryOn: "2026-12-01" },
        ],
        "2026-09-24",
      ),
    ).toEqual(["2026-03-01"]);
  });

  it("measures document progress", () => {
    expect(
      documentProgress([
        { status: "needed" },
        { status: "ready" },
        { status: "sent" },
      ]),
    ).toEqual({ done: 2, total: 3 });
  });
});
