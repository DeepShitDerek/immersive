import { describe, expect, it } from "vitest";
import type { Application } from "./applications";
import { buildRateTable } from "./fx";
import { type Account, balances, type Transaction } from "./ledger";
import { lenderReport } from "./lender-report";
import type { LoanTerms } from "./loan";

const account = (
  overrides: Partial<Account> & Pick<Account, "id">,
): Account => ({
  name: overrides.id,
  kind: "chequing",
  registration: "none",
  country: "CA",
  currency: "CAD",
  institutionId: null,
  openingBalanceMinor: 0,
  openingDate: "2025-01-01",
  creditLimitMinor: null,
  statementDay: null,
  paymentDueDay: null,
  interestRate: null,
  isLiquid: true,
  inNetWorth: true,
  archivedAt: null,
  ...overrides,
});

const accounts = [
  account({ id: "chq", openingBalanceMinor: 1_000_000 }),
  account({
    id: "tfsa",
    kind: "savings",
    registration: "tfsa",
    openingBalanceMinor: 3_000_000,
  }),
  account({
    id: "fhsa",
    kind: "savings",
    registration: "fhsa",
    openingBalanceMinor: 1_600_000,
  }),
  account({
    id: "nro",
    kind: "savings",
    registration: "nro",
    country: "IN",
    currency: "INR",
    openingBalanceMinor: 60_000_000,
  }),
  account({
    id: "visa",
    kind: "credit_card",
    creditLimitMinor: 500_000,
    openingBalanceMinor: -120_000,
  }),
  account({ id: "car", kind: "loan", openingBalanceMinor: -1_500_000 }),
  account({
    id: "jp",
    currency: "JPY",
    country: "JP",
    openingBalanceMinor: 10_000,
  }),
];
const loans = new Map<string, LoanTerms>([
  [
    "car",
    {
      principalMinor: 2_000_000,
      annualRate: 6.99,
      compounding: "monthly",
      frequency: "monthly",
      paymentMinor: 39_593,
      amortizationMonths: 60,
      termMonths: null,
      firstPaymentDate: "2025-02-01",
      prepaymentAllowancePct: null,
    },
  ],
]);
const pay = (date: string, amount: number): Transaction => ({
  id: date,
  date,
  kind: "income",
  status: "cleared",
  description: "Pay",
  payee: null,
  notes: null,
  provider: null,
  marketRate: null,
  scheduleId: null,
  occurrenceDate: null,
  importHash: null,
  postings: [
    {
      accountId: "chq",
      categoryId: "salary",
      amountMinor: amount,
      fxRate: 1,
      baseAmountMinor: amount,
    },
  ],
});
const spend = (date: string, amount: number): Transaction => ({
  ...pay(date, -amount),
  id: `s${date}`,
  kind: "expense",
  postings: [
    {
      accountId: "chq",
      categoryId: "rent",
      amountMinor: -amount,
      fxRate: 1,
      baseAmountMinor: -amount,
    },
  ],
});
const transactions = [
  pay("2026-07-15", 500_000),
  spend("2026-07-20", 300_000),
  pay("2026-08-15", 500_000),
  spend("2026-08-20", 350_000),
  pay("2026-09-15", 500_000),
];
const rates = buildRateTable([
  { base: "CAD", quote: "INR", asOf: "2026-01-01", rate: 60 },
]);
const today = "2026-09-24";

const report = (application: Application | null = null) =>
  lenderReport({
    today,
    base: "CAD",
    residentSince: "2023-05-01",
    incomeSources: [
      {
        id: "e",
        name: "Acme",
        employment: "full_time",
        role: "Engineer",
        grossAnnualMinor: 9_600_000,
        currency: "CAD",
        startDate: "2024-03-01",
        endDate: null,
        country: "CA",
        notes: null,
      },
      {
        id: "old",
        name: "Old job",
        employment: "contract",
        role: null,
        grossAnnualMinor: 1_000_000,
        currency: "CAD",
        startDate: "2023-01-01",
        endDate: "2024-01-01",
        country: "CA",
        notes: null,
      },
    ],
    accounts,
    transactions,
    balanceByAccount: balances(accounts, transactions, today),
    loans,
    rates,
    scores: [
      {
        id: "1",
        bureau: "equifax",
        score: 690,
        asOf: "2026-01-01",
        source: null,
      },
      {
        id: "2",
        bureau: "equifax",
        score: 712,
        asOf: "2026-09-01",
        source: null,
      },
    ],
    applications: [{ hardInquiryOn: "2026-06-01" }],
    application,
  });

describe("lender report", () => {
  it("counts current gross income and tenure, not past jobs", () => {
    const r = report();
    expect(r.income.sources.map((s) => s.name)).toEqual(["Acme"]);
    expect(r.income.grossAnnualMinor).toBe(9_600_000);
    expect(r.income.grossMonthlyMinor).toBe(800_000);
    expect(r.income.sources[0].tenureMonths).toBe(30);
    expect(r.monthsInCanada).toBe(40);
  });

  it("averages twelve full months of real cash flow, skipping empty months", () => {
    const r = report();
    // July and August count; September is the current, partial month.
    expect(r.cashflow).toEqual({
      months: 2,
      avgIncomeMinor: 500_000,
      avgSpendingMinor: 325_000,
      avgSavedMinor: 175_000,
    });
  });

  it("groups assets, converts India, and names what it could not convert", () => {
    const r = report();
    expect(r.assets.registered.map((l) => l.accountId).sort()).toEqual([
      "fhsa",
      "tfsa",
    ]);
    expect(r.assets.india).toEqual([
      {
        accountId: "nro",
        name: "nro",
        detail: "INR · NRO",
        amountMinor: 1_000_000,
      },
    ]);
    expect(r.unconverted).toEqual(["jp"]);
  });

  it("lists debts with the payment a lender counts", () => {
    const r = report();
    expect(r.liabilities.find((l) => l.accountId === "visa")).toMatchObject({
      amountMinor: 120_000,
      limitMinor: 500_000,
      monthlyPaymentMinor: 3_600,
    });
    expect(r.liabilities.find((l) => l.accountId === "car")).toMatchObject({
      amountMinor: 1_500_000,
      monthlyPaymentMinor: 39_593,
    });
    expect(r.totals.monthlyDebtPaymentsMinor).toBe(43_193);
    expect(r.totals.netWorthMinor).toBe(
      r.totals.assetsMinor - r.totals.liabilitiesMinor,
    );
  });

  it("keeps the latest score per bureau and the year's inquiries", () => {
    const r = report();
    expect(r.credit.latest).toEqual([
      {
        id: "2",
        bureau: "equifax",
        score: 712,
        asOf: "2026-09-01",
        source: null,
      },
    ]);
    expect(r.credit.inquiriesLastYear).toEqual(["2026-06-01"]);
  });

  it("checks a mortgage at the stress-test rate", () => {
    const application: Application = {
      id: "a",
      lender: "Maple Bank",
      product: "mortgage",
      status: "planning",
      amountMinor: null,
      currency: "CAD",
      rate: 4.5,
      termMonths: 60,
      amortizationMonths: 300,
      purchasePriceMinor: 45_000_000,
      downPaymentMinor: 4_500_000,
      propertyTaxMonthlyMinor: 30_000,
      heatingMonthlyMinor: 10_000,
      condoFeesMonthlyMinor: 0,
      submittedOn: null,
      decidedOn: null,
      hardInquiryOn: null,
      notes: null,
      documents: [],
    };
    const m = report(application).mortgage!;
    expect(m.minimumDownMinor).toBe(2_250_000);
    expect(m.downPaymentOk).toBe(true);
    expect(m.insuranceRate).toBe(0.031);
    expect(m.mortgageMinor).toBe(Math.round(40_500_000 * 1.031));
    expect(m.qualifyingRate).toBe(6.5);
    expect(m.ratios?.gds).toBeGreaterThan(0.3);
    expect(m.maximumMortgageMinor).toBeGreaterThan(0);
    expect(m.downPaymentHistory.map((h) => h.accountId)).toContain("fhsa");
  });

  it("flags a down payment below the minimum and an uninsurable one", () => {
    const base: Application = {
      id: "a",
      lender: "x",
      product: "mortgage" as const,
      status: "planning" as const,
      amountMinor: null,
      currency: "CAD",
      rate: 4.5,
      termMonths: null,
      amortizationMonths: 300,
      propertyTaxMonthlyMinor: null,
      heatingMonthlyMinor: null,
      condoFeesMonthlyMinor: null,
      submittedOn: null,
      decidedOn: null,
      hardInquiryOn: null,
      purchasePriceMinor: null,
      downPaymentMinor: null,
      notes: null,
      documents: [],
    };
    const low = report({
      ...base,
      purchasePriceMinor: 70_000_000,
      downPaymentMinor: 3_500_000,
    }).mortgage!;
    expect(low.downPaymentOk).toBe(false);
    expect(low.insurable).toBe(true);
    const tiny = report({
      ...base,
      purchasePriceMinor: 70_000_000,
      downPaymentMinor: 1_000_000,
    }).mortgage!;
    expect(tiny.insurable).toBe(false);
    expect(
      report({
        ...base,
        product: "credit_card",
        purchasePriceMinor: null,
        downPaymentMinor: null,
      }).mortgage,
    ).toBeNull();
  });
});
