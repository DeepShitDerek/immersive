import { describe, expect, it } from "vitest";
import { forecast, runwayMonths } from "./forecast";
import { buildRateTable } from "./fx";
import { type InsightFacts, insights } from "./insights";
import { buildPriceBook, type Trade } from "./invest";
import type { Account, Posting, Transaction } from "./ledger";
import {
  lastMonths,
  monthEnds,
  monthlySeries,
  netWorthHistory,
  remittances,
  taxYear,
} from "./reports";
import type { Schedule } from "./schedule";

const account = (a: Partial<Account> & Pick<Account, "id">): Account => ({
  name: a.id,
  kind: "chequing",
  registration: "none",
  country: "CA",
  currency: "CAD",
  institutionId: null,
  openingBalanceMinor: 0,
  openingDate: "2026-01-01",
  creditLimitMinor: null,
  statementDay: null,
  paymentDueDay: null,
  interestRate: null,
  isLiquid: true,
  inNetWorth: true,
  archivedAt: null,
  ...a,
});

const leg = (
  accountId: string,
  amountMinor: number,
  categoryId: string | null = null,
  baseAmountMinor: number | null = amountMinor,
): Posting => ({
  accountId,
  categoryId,
  amountMinor,
  fxRate: baseAmountMinor === null ? null : 1,
  baseAmountMinor,
});

let n = 0;
const txn = (
  t: Partial<Transaction> & Pick<Transaction, "date" | "kind" | "postings">,
): Transaction => ({
  id: `x${++n}`,
  status: "cleared",
  description: "",
  payee: null,
  notes: null,
  provider: null,
  marketRate: null,
  scheduleId: null,
  occurrenceDate: null,
  importHash: null,
  ...t,
});

const schedule = (
  s: Partial<Schedule> &
    Pick<Schedule, "id" | "kind" | "accountId" | "amountMinor" | "startDate">,
): Schedule => ({
  name: s.id,
  toAccountId: null,
  categoryId: null,
  toAmountMinor: null,
  isEstimate: false,
  frequency: "monthly",
  endDate: null,
  dayOne: null,
  dayTwo: null,
  payee: null,
  notes: null,
  archivedAt: null,
  ...s,
});

const rates = buildRateTable([
  { base: "CAD", quote: "INR", asOf: "2026-01-01", rate: 60 },
]);

describe("forecast", () => {
  const chq = account({ id: "chq" });
  const nro = account({
    id: "nro",
    currency: "INR",
    country: "IN",
    isLiquid: false,
  });
  const card = account({ id: "card", kind: "credit_card", isLiquid: false });
  const balanceByAccount = new Map([
    ["chq", { balanceMinor: 200_000, clearedMinor: 200_000, currency: "CAD" }],
    ["card", { balanceMinor: -50_000, clearedMinor: -50_000, currency: "CAD" }],
  ]);

  it("plays scheduled pay, bills and transfers forward day by day", () => {
    const f = forecast({
      today: "2026-03-10",
      days: 30,
      base: "CAD",
      accounts: [chq, nro, card],
      balanceByAccount,
      schedules: [
        schedule({
          id: "rent",
          kind: "expense",
          accountId: "chq",
          amountMinor: 150_000,
          startDate: "2026-04-01",
        }),
        schedule({
          id: "pay",
          kind: "income",
          accountId: "chq",
          amountMinor: 250_000,
          startDate: "2026-03-25",
        }),
        // Paying the card moves money out of the liquid total.
        schedule({
          id: "card",
          kind: "transfer",
          accountId: "chq",
          toAccountId: "card",
          amountMinor: 50_000,
          startDate: "2026-03-20",
        }),
        // Money home: out of chequing into an account that is not liquid.
        schedule({
          id: "home",
          kind: "transfer",
          accountId: "chq",
          toAccountId: "nro",
          amountMinor: 20_000,
          toAmountMinor: 1_200_000,
          startDate: "2026-03-15",
        }),
      ],
      transactions: [],
      skips: new Set(),
      rates,
    });
    expect(f.startMinor).toBe(200_000);
    expect(f.days).toHaveLength(31);
    expect(f.days.find((d) => d.date === "2026-03-15")!.balanceMinor).toBe(
      180_000,
    );
    expect(f.days.find((d) => d.date === "2026-03-20")!.balanceMinor).toBe(
      130_000,
    );
    expect(f.days.find((d) => d.date === "2026-03-25")!.balanceMinor).toBe(
      380_000,
    );
    expect(f.days.find((d) => d.date === "2026-04-01")!.balanceMinor).toBe(
      230_000,
    );
    expect(f.lowest).toEqual({ date: "2026-03-20", balanceMinor: 130_000 });
    expect(f.firstBelowZero).toBeNull();
    expect(f.endMinor).toBe(230_000);
    expect(f.overdue).toBe(0);
  });

  it("leaves past occurrences out of the line and counts the unrecorded ones", () => {
    const rent = schedule({
      id: "rent",
      kind: "expense",
      accountId: "chq",
      amountMinor: 150_000,
      startDate: "2026-01-01",
    });
    const phone = schedule({
      id: "phone",
      kind: "expense",
      accountId: "chq",
      amountMinor: 5_000,
      startDate: "2026-01-05",
    });
    const f = forecast({
      today: "2026-03-10",
      days: 5,
      base: "CAD",
      accounts: [chq],
      balanceByAccount,
      schedules: [rent, phone],
      transactions: [
        { scheduleId: "rent", occurrenceDate: "2026-03-01" },
        { scheduleId: "rent", occurrenceDate: "2026-02-01" },
      ],
      skips: new Set(["phone|2026-02-05"]),
      rates,
    });
    // Phone on 5 March was never recorded; the rent was, and February's phone skipped.
    expect(f.overdue).toBe(1);
    expect(f.events.map((e) => [e.label, e.date])).toEqual([]);
    expect(f.days[0].balanceMinor).toBe(200_000);
  });

  it("adds what-if scenarios each month and finds the first day below zero and the cushion", () => {
    const f = forecast({
      today: "2026-03-10",
      days: 60,
      base: "CAD",
      accounts: [chq],
      balanceByAccount,
      schedules: [],
      transactions: [],
      skips: new Set(),
      rates,
      scenarios: [
        {
          id: "s",
          label: "Send home",
          monthlyMinor: -120_000,
          day: 1,
          fromMonth: null,
        },
      ],
      cushionMinor: 100_000,
    });
    expect(f.events.map((e) => e.date)).toEqual(["2026-04-01", "2026-05-01"]);
    expect(f.firstBelowCushion).toBe("2026-04-01");
    expect(f.firstBelowZero).toBe("2026-05-01");
    expect(f.lowest.balanceMinor).toBe(-40_000);
  });

  it("names accounts it cannot convert", () => {
    const usd = account({ id: "usd", currency: "USD" });
    const f = forecast({
      today: "2026-03-10",
      days: 1,
      base: "CAD",
      accounts: [usd],
      balanceByAccount: new Map([
        ["usd", { balanceMinor: 100, clearedMinor: 100, currency: "USD" }],
      ]),
      schedules: [],
      transactions: [],
      skips: new Set(),
      rates,
    });
    expect(f.unpriced).toEqual(["usd"]);
    expect(f.startMinor).toBe(0);
  });

  it("computes the runway", () => {
    expect(runwayMonths(600_000, 200_000)).toBe(3);
    expect(runwayMonths(-5, 200_000)).toBe(0);
    expect(runwayMonths(600_000, 0)).toBeNull();
  });
});

describe("reports", () => {
  const chq = account({ id: "chq", openingBalanceMinor: 100_000 });
  const nro = account({
    id: "nro",
    currency: "INR",
    country: "IN",
    registration: "nro",
    openingDate: "2026-02-15",
    openingBalanceMinor: 6_000_000,
  });
  const tfsa = account({
    id: "tfsa",
    kind: "investment",
    registration: "tfsa",
    isLiquid: false,
  });
  const brokerage = account({ id: "brk", kind: "investment", isLiquid: false });
  const accounts = [chq, nro, tfsa, brokerage];
  const transactions = [
    txn({
      date: "2026-01-15",
      kind: "income",
      postings: [leg("chq", 500_000, "salary")],
    }),
    txn({
      date: "2026-01-20",
      kind: "expense",
      postings: [leg("chq", -150_000, "rent")],
    }),
    txn({
      date: "2026-02-15",
      kind: "income",
      postings: [leg("chq", 500_000, "salary")],
    }),
    txn({
      date: "2026-02-10",
      kind: "income",
      postings: [leg("tfsa", 3_000, "div")],
    }),
    txn({
      date: "2026-02-20",
      kind: "income",
      postings: [leg("nro", 60_000, "interest", 1_000)],
    }),
    txn({
      date: "2026-03-01",
      kind: "transfer",
      postings: [leg("chq", -200_000), leg("tfsa", 200_000)],
    }),
    txn({
      date: "2026-03-05",
      kind: "transfer",
      marketRate: 62,
      provider: "Wise",
      postings: [
        leg("chq", -100_000),
        leg("nro", 6_100_000, null, 100_000),
        leg("chq", -500, "fees"),
      ],
    }),
  ];

  it("lists months and a series of income, spending and savings rate", () => {
    expect(lastMonths("2026-03-10", 3)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
    expect(lastMonths("2026-01-10", 2)).toEqual(["2025-12", "2026-01"]);
    const [jan, feb] = monthlySeries(transactions, ["2026-01", "2026-02"]);
    expect(jan).toMatchObject({
      incomeMinor: 500_000,
      spendingMinor: 150_000,
      netMinor: 350_000,
      savingsRate: 0.7,
    });
    expect(feb.incomeMinor).toBe(504_000);
  });

  it("values net worth at each month end, leaving out accounts not yet opened", () => {
    expect(monthEnds("2026-01-10", "2026-03-10")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-10",
    ]);
    const points = netWorthHistory({
      dates: ["2026-01-31", "2026-02-28"],
      base: "CAD",
      accounts,
      transactions,
      trades: [],
      securities: new Map(),
      prices: buildPriceBook([]),
      rates,
    });
    expect(points[0].netMinor).toBe(100_000 + 350_000);
    // February: chequing 950,000; TFSA 3,000; NRO ₹60,600 at 60 = $1,010.00.
    expect(points[1].netMinor).toBe(950_000 + 3_000 + 101_000);
  });

  it("measures what a remittance cost against the entered market rate", () => {
    const r = remittances({
      transactions,
      accounts: new Map(accounts.map((a) => [a.id, a])),
      from: "2026-01-01",
      to: "2026-12-31",
      base: "CAD",
      rates,
    });
    expect(r.items).toHaveLength(1);
    const item = r.items[0];
    expect(item.rateSource).toBe("entered");
    expect(item.provider).toBe("Wise");
    // At 62, 1,000.00 would deliver ₹62,000; ₹61,000 arrived: ₹1,000 ≈ $16.13, plus the $5 fee.
    expect(item.cost?.totalCost.minor).toBe(1_613 + 500);
    expect(r.costBaseMinor).toBe(2_113);
    expect(r.sentBaseMinor).toBe(100_000);
  });

  it("gathers the tax year, leaving out sheltered income", () => {
    const trades: Trade[] = [
      {
        id: "b",
        accountId: "brk",
        securityId: "s",
        date: "2026-01-10",
        kind: "buy",
        quantity: 10,
        amountMinor: 100_000,
        feeMinor: 0,
        transactionId: null,
        notes: null,
        createdAt: "1",
      },
      {
        id: "s",
        accountId: "brk",
        securityId: "s",
        date: "2026-06-10",
        kind: "sell",
        quantity: 5,
        amountMinor: 70_000,
        feeMinor: 0,
        transactionId: null,
        notes: null,
        createdAt: "2",
      },
      {
        id: "d",
        accountId: "brk",
        securityId: "s",
        date: "2026-03-31",
        kind: "dividend",
        quantity: null,
        amountMinor: 1_500,
        feeMinor: 0,
        transactionId: "x",
        notes: null,
        createdAt: "3",
      },
    ];
    const t = taxYear({
      year: 2026,
      accounts,
      transactions,
      trades,
      base: "CAD",
      rates,
    });
    expect(t.totalIncomeMinor).toBe(500_000 + 500_000 + 1_000);
    expect(t.incomeByCategory.get("div")).toBeUndefined();
    expect(t.foreignIncomeMinor).toBe(1_000);
    expect(t.dividendsMinor).toBe(1_500);
    expect(t.realisedGainsMinor).toBe(20_000);
    expect(t.taxableGainsMinor).toBe(10_000);
    expect(t.tfsaContributedMinor).toBe(200_000);
    // NRO peak: ₹121,600 at 60 after the March transfer.
    expect(t.foreignPropertyPeakMinor).toBe(202_667);
    expect(t.t1135).toBe("not_required");
  });
});

describe("insights", () => {
  const facts: InsightFacts = {
    base: "CAD",
    lastMonth: {
      label: "August",
      incomeMinor: 500_000,
      spendingMinor: 350_000,
      savingsRate: 0.3,
    },
    priorAverage: { spendingMinor: 300_000, savingsRate: 0.4 },
    categoryChanges: [
      { name: "Groceries", lastMinor: 70_000, averageMinor: 50_000 },
      { name: "Coffee", lastMinor: 6_000, averageMinor: 5_000 },
    ],
    liquidMinor: 600_000,
    averageMonthlySpendingMinor: 300_000,
    cardsOver30: [],
    tfsaAvailableMinor: null,
    overBudget: [],
    dueThisWeek: [],
    remittanceCostThisYearMinor: 0,
    remittancesThisYear: 0,
    foreignPropertyPeakMinor: 0,
    renewals: [],
    stalePrices: [],
    forecastBelowZero: null,
  };

  it("states the amounts, not a meaningless rate, when far more went out than came in", () => {
    const far = insights({
      ...facts,
      lastMonth: {
        label: "September",
        incomeMinor: 1_000,
        spendingMinor: 157_081,
        savingsRate: -156.08,
      },
    });
    const detail = far.find((i) => i.id === "savings")?.detail ?? "";
    expect(detail).not.toMatch(/-\d{3,}%/);
    expect(detail).toMatch(/went out against/);
    const near = insights({
      ...facts,
      lastMonth: {
        label: "September",
        incomeMinor: 100_000,
        spendingMinor: 120_000,
        savingsRate: -0.2,
      },
    });
    expect(near.find((i) => i.id === "savings")?.detail).toMatch(
      /^Kept -20% of income/,
    );
  });

  it("says how many months of spending are set aside, with a tone to match", () => {
    expect(insights(facts).find((i) => i.id === "runway")).toMatchObject({
      tone: "warn",
      title: "2 months of spending set aside",
    });
    expect(
      insights({ ...facts, liquidMinor: 100_000 }).find(
        (i) => i.id === "runway",
      )?.tone,
    ).toBe("alert");
    expect(
      insights({ ...facts, liquidMinor: 2_000_000 }).find(
        (i) => i.id === "runway",
      )?.tone,
    ).toBe("good");
  });

  it("reports the savings rate against the months before, and the biggest category jump only", () => {
    const all = insights(facts);
    expect(all.find((i) => i.id === "savings")).toMatchObject({
      tone: "good",
      title: "August: kept 30% of what came in",
    });
    expect(all.find((i) => i.id === "savings")!.detail).toContain("40%");
    expect(
      all.filter((i) => i.id === "category-jump").map((i) => i.title),
    ).toEqual(["Groceries up $200.00 last month"]);
  });

  it("flags a negative month, the T1135, a coming renewal and a forecast shortfall, most urgent first", () => {
    const all = insights({
      ...facts,
      lastMonth: {
        label: "August",
        incomeMinor: 300_000,
        spendingMinor: 350_000,
        savingsRate: -1 / 6,
      },
      foreignPropertyPeakMinor: 12_000_000,
      renewals: [{ name: "Mortgage", date: "2026-12-01", days: 68 }],
      forecastBelowZero: "2026-10-01",
    });
    expect(all[0].tone).toBe("alert");
    expect(all.map((i) => i.id)).toEqual(
      expect.arrayContaining([
        "forecast-negative",
        "t1135",
        "renewal-Mortgage",
      ]),
    );
    expect(all.find((i) => i.id === "savings")!.title).toBe(
      "August: spent $500.00 more than came in",
    );
    expect(all.find((i) => i.id === "t1135")!.tone).toBe("alert");
    const tones = all.map((i) => i.tone);
    expect(tones).toEqual(
      [...tones].sort(
        (a, b) =>
          ["alert", "warn", "good", "info"].indexOf(a) -
          ["alert", "warn", "good", "info"].indexOf(b),
      ),
    );
  });

  it("stays quiet when there is nothing to say", () => {
    expect(
      insights({
        ...facts,
        lastMonth: null,
        priorAverage: null,
        categoryChanges: [],
        averageMonthlySpendingMinor: 0,
      }),
    ).toEqual([]);
  });
});
