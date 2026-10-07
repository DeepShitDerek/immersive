import { type Application, recentInquiries } from "./applications";
import {
  addDays,
  addMonths,
  daysBetween,
  endOfMonth,
  type IsoDate,
  startOfMonth,
} from "./dates";
import { periodFlows } from "./flows";
import type { RateTable } from "./fx";
import {
  type Account,
  type Balance,
  balances,
  CANADIAN_REGISTRATIONS,
  CREDIT_KINDS,
  isLiability,
  type Transaction,
} from "./ledger";
import { type LoanTerms, paymentsPerYear, scheduledPayment } from "./loan";
import { convert, money } from "./money";
import {
  debtServiceRatios,
  type HousingCosts,
  insurancePremiumRate,
  maximumMortgage,
  minimumDownPayment,
  qualifyingPayment,
  qualifyingRate,
  type Ratios,
  revolvingPayment,
} from "./qualify";

/**
 * Everything a lender asks, assembled from the ledger: income and
 * how long it has been earned, what the owner has (in Canada and in India),
 * what they owe and pay each month, how money has actually moved over the
 * last year, and — for a mortgage — the ratios at the stress-test rate.
 *
 * All in the base currency, at today's rates; anything that could not be
 * converted is listed rather than left out silently.
 */

export interface IncomeSource {
  id: string;
  name: string;
  employment:
    | "full_time"
    | "part_time"
    | "contract"
    | "self_employed"
    | "other";
  role: string | null;
  grossAnnualMinor: number;
  currency: string;
  startDate: IsoDate;
  endDate: IsoDate | null;
  country: string;
  notes: string | null;
}

export interface CreditScore {
  id: string;
  bureau: "equifax" | "transunion" | "other";
  score: number;
  asOf: IsoDate;
  source: string | null;
}

export type AssetGroup =
  | "banking"
  | "registered"
  | "investments"
  | "india"
  | "other";

interface ReportLine {
  accountId: string;
  name: string;
  detail: string;
  amountMinor: number;
}

export interface LenderReport {
  asOf: IsoDate;
  base: string;
  monthsInCanada: number | null;
  income: {
    sources: (IncomeSource & {
      grossAnnualBaseMinor: number | null;
      tenureMonths: number;
    })[];
    grossAnnualMinor: number;
    grossMonthlyMinor: number;
  };
  cashflow: {
    months: number;
    avgIncomeMinor: number;
    avgSpendingMinor: number;
    avgSavedMinor: number;
  };
  assets: Record<AssetGroup, ReportLine[]>;
  liabilities: (ReportLine & {
    limitMinor: number | null;
    monthlyPaymentMinor: number;
  })[];
  totals: {
    assetsMinor: number;
    liabilitiesMinor: number;
    netWorthMinor: number;
    monthlyDebtPaymentsMinor: number;
  };
  unconverted: string[];
  credit: { latest: CreditScore[]; inquiriesLastYear: IsoDate[] };
  mortgage: MortgageCheck | null;
}

interface MortgageCheck {
  priceMinor: number;
  downPaymentMinor: number;
  minimumDownMinor: number;
  downPaymentOk: boolean;
  insuranceRate: number | null;
  insurable: boolean;
  mortgageMinor: number;
  contractRate: number;
  qualifyingRate: number;
  qualifyingPaymentMinor: number;
  ratios: Ratios | null;
  maximumMortgageMinor: number;
  /** Down-payment accounts 90 days ago and now: lenders want the money to have been there. */
  downPaymentHistory: {
    accountId: string;
    name: string;
    ninetyDaysAgoMinor: number;
    nowMinor: number;
  }[];
}

const monthsBetween = (from: IsoDate, to: IsoDate) =>
  Math.max(0, Math.floor(daysBetween(from, to) / 30.4375));

export function lenderReport(input: {
  today: IsoDate;
  base: string;
  residentSince: IsoDate | null;
  incomeSources: readonly IncomeSource[];
  accounts: readonly Account[];
  transactions: readonly Transaction[];
  balanceByAccount: ReadonlyMap<string, Balance>;
  loans: ReadonlyMap<string, LoanTerms>;
  rates: RateTable;
  scores: readonly CreditScore[];
  applications: readonly Pick<Application, "hardInquiryOn">[];
  application?: Application | null;
}): LenderReport {
  const { today, base, rates } = input;
  const unconverted: string[] = [];
  const toBase = (
    minor: number,
    currency: string,
    label: string,
  ): number | null => {
    if (currency === base) return minor;
    const quote = rates.quote(currency, base, today);
    if (!quote) {
      if (minor !== 0) unconverted.push(label);
      return null;
    }
    return convert(money(minor, currency), quote.rate, base).minor;
  };

  // Income.
  const active = input.incomeSources.filter(
    (s) => !s.endDate || s.endDate >= today,
  );
  const sources = active.map((s) => ({
    ...s,
    grossAnnualBaseMinor: toBase(
      s.grossAnnualMinor,
      s.currency,
      `income from ${s.name}`,
    ),
    tenureMonths: monthsBetween(s.startDate, today),
  }));
  const grossAnnual = sources.reduce(
    (t, s) => t + (s.grossAnnualBaseMinor ?? 0),
    0,
  );

  // Twelve full months of cash flow, ending last month.
  const lastMonthEnd = addDays(startOfMonth(today), -1);
  const from = startOfMonth(addMonths(lastMonthEnd, -11));
  let months = 0;
  let income = 0;
  let spending = 0;
  for (
    let cursor = from;
    cursor <= lastMonthEnd;
    cursor = addMonths(cursor, 1)
  ) {
    const flows = periodFlows(input.transactions, cursor, endOfMonth(cursor));
    if (flows.incomeMinor === 0 && flows.spendingMinor === 0) continue;
    months += 1;
    income += flows.incomeMinor;
    spending += flows.spendingMinor;
  }
  const avg = (x: number) => (months ? Math.round(x / months) : 0);

  // Assets and liabilities.
  const assets: Record<AssetGroup, ReportLine[]> = {
    banking: [],
    registered: [],
    investments: [],
    india: [],
    other: [],
  };
  const liabilities: LenderReport["liabilities"] = [];
  for (const account of input.accounts) {
    if (account.archivedAt || !account.inNetWorth) continue;
    const balance = input.balanceByAccount.get(account.id)?.balanceMinor ?? 0;
    const inBase = toBase(balance, account.currency, account.name);
    if (inBase === null) continue;
    const detail = [
      account.currency !== base ? `${account.currency}` : null,
      account.registration !== "none"
        ? account.registration.toUpperCase()
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
    if (isLiability(account.kind)) {
      const owed = Math.max(0, -inBase);
      const loan = input.loans.get(account.id);
      let payment = 0;
      if (CREDIT_KINDS.includes(account.kind)) payment = revolvingPayment(owed);
      else if (loan) {
        const perPeriod =
          toBase(
            scheduledPayment(loan),
            account.currency,
            `${account.name} payment`,
          ) ?? 0;
        payment = Math.round(
          (perPeriod * paymentsPerYear(loan.frequency)) / 12,
        );
      }
      const limit = account.creditLimitMinor
        ? toBase(
            account.creditLimitMinor,
            account.currency,
            `${account.name} limit`,
          )
        : null;
      if (owed > 0 || limit)
        liabilities.push({
          accountId: account.id,
          name: account.name,
          detail,
          amountMinor: owed,
          limitMinor: limit,
          monthlyPaymentMinor: payment,
        });
      continue;
    }
    const line = {
      accountId: account.id,
      name: account.name,
      detail,
      amountMinor: inBase,
    };
    if (account.country === "IN") assets.india.push(line);
    else if (CANADIAN_REGISTRATIONS.includes(account.registration))
      assets.registered.push(line);
    else if (account.kind === "investment") assets.investments.push(line);
    else if (account.kind === "asset") assets.other.push(line);
    else assets.banking.push(line);
  }
  const assetsTotal = Object.values(assets)
    .flat()
    .reduce((t, l) => t + l.amountMinor, 0);
  const liabilitiesTotal = liabilities.reduce((t, l) => t + l.amountMinor, 0);
  const monthlyDebt = liabilities.reduce(
    (t, l) => t + l.monthlyPaymentMinor,
    0,
  );

  // Credit.
  const latest = new Map<string, CreditScore>();
  for (const score of input.scores) {
    const current = latest.get(score.bureau);
    if (!current || score.asOf > current.asOf) latest.set(score.bureau, score);
  }

  // Mortgage.
  let mortgage: MortgageCheck | null = null;
  const app = input.application;
  if (
    app &&
    app.product === "mortgage" &&
    app.purchasePriceMinor &&
    app.downPaymentMinor != null &&
    app.rate != null
  ) {
    const price =
      toBase(app.purchasePriceMinor, app.currency, "purchase price") ??
      app.purchasePriceMinor;
    const down =
      toBase(app.downPaymentMinor, app.currency, "down payment") ??
      app.downPaymentMinor;
    const minDown = minimumDownPayment(price);
    let premium: number | null = null;
    let insurable = true;
    try {
      premium = insurancePremiumRate(price - down, price);
    } catch {
      insurable = false;
    }
    const mortgageAmount = Math.round((price - down) * (1 + (premium ?? 0)));
    const amortization = app.amortizationMonths ?? 300;
    const payment = qualifyingPayment(mortgageAmount, app.rate, amortization);
    const costs: HousingCosts = {
      propertyTaxMonthlyMinor: app.propertyTaxMonthlyMinor ?? 0,
      heatingMonthlyMinor: app.heatingMonthlyMinor ?? 0,
      condoFeesMonthlyMinor: app.condoFeesMonthlyMinor ?? 0,
    };
    const grossMonthly = Math.round(grossAnnual / 12);
    const downAccounts = input.accounts.filter(
      (a) =>
        !a.archivedAt &&
        !isLiability(a.kind) &&
        a.isLiquid &&
        a.country === "CA",
    );
    const ninetyAgo = balances(
      downAccounts,
      input.transactions,
      addDays(today, -90),
    );
    mortgage = {
      priceMinor: price,
      downPaymentMinor: down,
      minimumDownMinor: minDown,
      downPaymentOk: down >= minDown,
      insuranceRate: premium,
      insurable,
      mortgageMinor: mortgageAmount,
      contractRate: app.rate,
      qualifyingRate: qualifyingRate(app.rate),
      qualifyingPaymentMinor: payment,
      ratios: debtServiceRatios({
        grossMonthlyIncomeMinor: grossMonthly,
        mortgagePaymentMinor: payment,
        costs,
        otherDebtPaymentsMinor: monthlyDebt,
      }),
      maximumMortgageMinor: maximumMortgage({
        grossMonthlyIncomeMinor: grossMonthly,
        costs,
        otherDebtPaymentsMinor: monthlyDebt,
        contractRatePct: app.rate,
        amortizationMonths: amortization,
      }),
      downPaymentHistory: downAccounts
        .map((a) => ({
          accountId: a.id,
          name: a.name,
          ninetyDaysAgoMinor:
            toBase(
              ninetyAgo.get(a.id)?.balanceMinor ?? 0,
              a.currency,
              a.name,
            ) ?? 0,
          nowMinor:
            toBase(
              input.balanceByAccount.get(a.id)?.balanceMinor ?? 0,
              a.currency,
              a.name,
            ) ?? 0,
        }))
        .filter((h) => h.nowMinor !== 0 || h.ninetyDaysAgoMinor !== 0),
    };
  }

  return {
    asOf: today,
    base,
    monthsInCanada: input.residentSince
      ? monthsBetween(input.residentSince, today)
      : null,
    income: {
      sources,
      grossAnnualMinor: grossAnnual,
      grossMonthlyMinor: Math.round(grossAnnual / 12),
    },
    cashflow: {
      months,
      avgIncomeMinor: avg(income),
      avgSpendingMinor: avg(spending),
      avgSavedMinor: avg(income - spending),
    },
    assets,
    liabilities,
    totals: {
      assetsMinor: assetsTotal,
      liabilitiesMinor: liabilitiesTotal,
      netWorthMinor: assetsTotal - liabilitiesTotal,
      monthlyDebtPaymentsMinor: monthlyDebt,
    },
    unconverted: [...new Set(unconverted)],
    credit: {
      latest: [...latest.values()],
      inquiriesLastYear: recentInquiries(input.applications, today),
    },
    mortgage,
  };
}
