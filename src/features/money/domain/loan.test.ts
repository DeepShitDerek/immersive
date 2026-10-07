import { describe, expect, it } from "vitest";
import {
  amortize,
  type LoanTerms,
  levelPayment,
  paymentDate,
  periodicRate,
  planPayoff,
  projectFromBalance,
  renewalDate,
  scheduledPayment,
  splitPayment,
} from "./loan";

const mortgage: LoanTerms = {
  principalMinor: 50_000_000,
  annualRate: 5,
  compounding: "semiannual",
  frequency: "monthly",
  paymentMinor: null,
  amortizationMonths: 300,
  termMonths: 60,
  firstPaymentDate: "2026-02-01",
  prepaymentAllowancePct: 15,
};

describe("rates and payments", () => {
  it("compounds a Canadian mortgage semi-annually", () => {
    expect(periodicRate(5, "semiannual", 12)).toBeCloseTo(
      Math.pow(1.025, 1 / 6) - 1,
      15,
    );
    expect(periodicRate(6, "monthly", 12)).toBeCloseTo(0.005, 15);
  });

  it("matches published payments", () => {
    // $500,000 at 5%, 25 years: ~$2,908 in Canada, ~$2,923 with monthly compounding.
    const canadian = scheduledPayment(mortgage);
    expect(canadian).toBeGreaterThanOrEqual(290_795);
    expect(canadian).toBeLessThanOrEqual(290_805);
    const us = scheduledPayment({ ...mortgage, compounding: "monthly" });
    expect(us).toBeGreaterThanOrEqual(292_290);
    expect(us).toBeLessThanOrEqual(292_300);
    // $20,000 car loan at 6.99%, 60 months: ~$395.9.
    const car = scheduledPayment({
      ...mortgage,
      principalMinor: 2_000_000,
      annualRate: 6.99,
      compounding: "monthly",
      amortizationMonths: 60,
    });
    expect(car).toBeGreaterThanOrEqual(39_588);
    expect(car).toBeLessThanOrEqual(39_595);
  });

  it("halves the monthly payment for accelerated bi-weekly", () => {
    expect(
      scheduledPayment({ ...mortgage, frequency: "accelerated_biweekly" }),
    ).toBe(Math.round(scheduledPayment(mortgage) / 2));
    // Plain bi-weekly amortises over the same 25 years, so pays less each time.
    expect(
      scheduledPayment({ ...mortgage, frequency: "biweekly" }),
    ).toBeLessThan(
      scheduledPayment({ ...mortgage, frequency: "accelerated_biweekly" }),
    );
  });

  it("uses the lender's payment when there is one", () => {
    expect(scheduledPayment({ ...mortgage, paymentMinor: 300_000 })).toBe(
      300_000,
    );
  });

  it("never computes a zero payment", () => {
    expect(levelPayment(1, 0.05 / 12, 12)).toBe(1);
    expect(levelPayment(0, 0.01, 12)).toBe(0);
    expect(levelPayment(1200, 0, 12)).toBe(100);
  });

  it("walks the payment calendar without drifting", () => {
    expect(paymentDate("2026-01-31", "monthly", 1)).toBe("2026-02-28");
    expect(paymentDate("2026-01-31", "monthly", 2)).toBe("2026-03-31");
    expect(paymentDate("2026-01-01", "biweekly", 2)).toBe("2026-01-29");
    expect(paymentDate("2026-01-01", "semimonthly", 1)).toBe("2026-01-16");
    expect(paymentDate("2026-01-20", "semimonthly", 3)).toBe("2026-02-28");
  });
});

describe("amortization", () => {
  const base = {
    balanceMinor: 50_000_000,
    annualRate: 5,
    compounding: "semiannual" as const,
    frequency: "monthly" as const,
    paymentMinor: scheduledPayment(mortgage),
    firstPaymentDate: "2026-02-01",
  };

  it("repays exactly what is owed, ending at zero", () => {
    const result = amortize(base);
    expect(
      result.rows.reduce((t, r) => t + r.principalMinor + r.extraMinor, 0),
    ).toBe(50_000_000);
    expect(result.rows.at(-1)?.balanceMinor).toBe(0);
    expect(result.rows.length).toBeGreaterThanOrEqual(299);
    expect(result.rows.length).toBeLessThanOrEqual(301);
    expect(result.totalPaidMinor).toBe(result.totalInterestMinor + 50_000_000);
  });

  /**
   * What must hold for any loan paid at its own level payment.
   *
   * The payment is rounded to a whole cent, so each period can fall up to
   * half a cent short, and that shortfall compounds. On an ordinary loan it
   * is nothing; on a very small one, or a long one at a high rate, it adds
   * periods, and a payment that rounds down to the interest never repays at
   * all. The schedule's length is therefore bounded by the shortfall's
   * future value, not by a flat "months + 1".
   */
  function expectInvariants(balance: number, rate: number, months: number) {
    const i = periodicRate(rate, "monthly", 12);
    const payment = levelPayment(balance, i, months);
    const result = amortize({
      ...base,
      balanceMinor: balance,
      annualRate: rate,
      compounding: "monthly",
      paymentMinor: payment,
    });
    const label = `balance ${balance}, rate ${rate}, months ${months}, payment ${payment}`;
    if (result.neverEnds) {
      // Only when the rounded payment does not clear the first period's interest.
      expect(payment, label).toBeLessThanOrEqual(Math.ceil(balance * i) + 1);
      return;
    }
    expect(
      result.rows.reduce((t, r) => t + r.principalMinor + r.extraMinor, 0),
      label,
    ).toBe(balance);
    expect(result.rows.at(-1)?.balanceMinor, label).toBe(0);
    const shortfall =
      i === 0 ? 0.5 * months : (0.5 * (Math.pow(1 + i, months) - 1)) / i;
    expect(result.rows.length, label).toBeLessThanOrEqual(
      months + 1 + Math.ceil((shortfall / payment) * 1.5),
    );
  }

  it("holds its invariants over many loans", () => {
    // Seeded (mulberry32), not Math.random: the same 2,000 loans every run, so
    // a failure here is a regression and never the luck of the draw.
    let seed = 0x5eed1234;
    const random = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let n = 0; n < 2000; n += 1) {
      expectInvariants(
        1 + Math.floor(random() * 1e8),
        random() * 25,
        1 + Math.floor(random() * 360),
      );
    }
  });

  it("holds its invariants for loans small enough that cent rounding matters", () => {
    // Each of these failed the old flat bound when Math.random happened on it.
    expectInvariants(28621, 9.41328124966329, 218);
    expectInvariants(335, 12.074093850013307, 35);
    expectInvariants(2811, 14.334498922946034, 248);
    expectInvariants(1413954, 24.106787272836662, 359);
  });

  it("reports a loan whose rounded payment only covers the interest as never ending", () => {
    // $7.60 at 17.49% over 263 months: the level payment rounds to 11 cents,
    // and the first month's interest is 11 cents.
    const payment = levelPayment(
      760,
      periodicRate(17.4888881738231, "monthly", 12),
      263,
    );
    const result = amortize({
      ...base,
      balanceMinor: 760,
      annualRate: 17.4888881738231,
      compounding: "monthly",
      paymentMinor: payment,
    });
    expect(result.neverEnds).toBe(true);
  });

  it("finishes years early when paid accelerated bi-weekly", () => {
    const monthly = amortize(base);
    const accelerated = amortize({
      ...base,
      frequency: "accelerated_biweekly",
      paymentMinor: scheduledPayment({
        ...mortgage,
        frequency: "accelerated_biweekly",
      }),
    });
    expect(accelerated.payoffDate! < monthly.payoffDate!).toBe(true);
    expect(accelerated.totalInterestMinor).toBeLessThan(
      monthly.totalInterestMinor,
    );
  });

  it("saves interest with a lump sum and with extra each payment", () => {
    const plain = amortize(base);
    const lump = amortize({
      ...base,
      lumpSums: [{ date: "2027-01-15", amountMinor: 2_000_000 }],
    });
    const extra = amortize({ ...base, extraPerPaymentMinor: 20_000 });
    for (const faster of [lump, extra]) {
      expect(faster.totalInterestMinor).toBeLessThan(plain.totalInterestMinor);
      expect(faster.rows.length).toBeLessThan(plain.rows.length);
      expect(
        faster.rows.reduce((t, r) => t + r.principalMinor + r.extraMinor, 0),
      ).toBe(50_000_000);
    }
  });

  it("says so when a payment cannot cover the interest", () => {
    expect(amortize({ ...base, paymentMinor: 100_000 }).neverEnds).toBe(true);
    const renewal = amortize({
      ...base,
      rateChange: { date: "2031-02-01", annualRate: 30 },
    });
    expect(renewal.neverEnds).toBe(true);
  });

  it("re-prices at renewal", () => {
    const higher = amortize({
      ...base,
      rateChange: {
        date: "2031-02-01",
        annualRate: 6.5,
        newPaymentMinor: 320_000,
      },
    });
    const row = higher.rows.find((r) => r.date === "2031-02-01")!;
    expect(row.paymentMinor).toBe(320_000);
    expect(higher.rows.reduce((t, r) => t + r.principalMinor, 0)).toBe(
      50_000_000,
    );
    expect(renewalDate(mortgage)).toBe("2031-02-01");
    expect(renewalDate({ ...mortgage, termMonths: null })).toBeNull();
  });

  it("projects the rest of a loan from what is owed today", () => {
    const rest = projectFromBalance(mortgage, 45_000_000, "2028-06-15");
    expect(rest.rows[0].date).toBe("2028-07-01");
    expect(rest.rows.reduce((t, r) => t + r.principalMinor, 0)).toBe(
      45_000_000,
    );
  });

  it("splits a payment into interest and principal", () => {
    const { interestMinor, principalMinor } = splitPayment(
      2_000_000,
      6,
      "monthly",
      "monthly",
      40_000,
    );
    expect(interestMinor).toBe(10_000);
    expect(principalMinor).toBe(30_000);
    expect(
      splitPayment(5_000, 6, "monthly", "monthly", 40_000).principalMinor,
    ).toBe(5_000);
  });
});

describe("paying down several debts", () => {
  const debts = [
    {
      id: "card",
      name: "Visa",
      balanceMinor: 400_000,
      annualRate: 20.99,
      minimumPaymentMinor: 12_000,
    },
    {
      id: "loc",
      name: "Line of credit",
      balanceMinor: 1_000_000,
      annualRate: 9.5,
      minimumPaymentMinor: 20_000,
    },
    {
      id: "small",
      name: "Store card",
      balanceMinor: 50_000,
      annualRate: 29.99,
      minimumPaymentMinor: 2_500,
    },
  ];

  it("avalanche pays less interest than snowball, and both clear everything", () => {
    const avalanche = planPayoff(debts, 100_000, "avalanche");
    const snowball = planPayoff(debts, 100_000, "snowball");
    expect(avalanche.feasible && snowball.feasible).toBe(true);
    expect(avalanche.order.map((o) => o.id)).toHaveLength(3);
    expect(avalanche.totalInterestMinor).toBeLessThanOrEqual(
      snowball.totalInterestMinor,
    );
    expect(avalanche.order[0].id).toBe("small"); // highest rate
    expect(snowball.order[0].id).toBe("small"); // smallest balance
  });

  it("refuses a budget below the minimums, and one that never finishes", () => {
    expect(planPayoff(debts, 30_000, "avalanche")).toMatchObject({
      feasible: false,
    });
    expect(
      planPayoff(
        [
          {
            id: "x",
            name: "x",
            balanceMinor: 10_000_000,
            annualRate: 30,
            minimumPaymentMinor: 1_000,
          },
        ],
        1_000,
        "avalanche",
      ).feasible,
    ).toBe(false);
    expect(planPayoff([], 1_000, "snowball")).toMatchObject({
      feasible: true,
      months: 0,
    });
  });
});
