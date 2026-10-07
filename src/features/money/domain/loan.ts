import {
  addDays,
  addMonths,
  daysInMonth,
  type IsoDate,
  makeDate,
  monthOf,
  yearOf,
  dayOf,
} from "./dates";
import { roundHalfAwayFromZero } from "./money";

/**
 * Loans and mortgages.
 *
 * The rate a lender quotes is annual; what matters is the rate per payment,
 * and that depends on how often interest compounds. Canadian fixed-rate
 * mortgages must compound semi-annually (Interest Act s.6), so 5% on a
 * Canadian mortgage costs a little less than 5% on a loan that compounds
 * monthly — the reason a US calculator gives a Canadian the wrong payment.
 *
 * As everywhere in this module, a float computes a ratio and an amount is
 * rounded once, where it becomes money. Each period's interest is rounded to
 * the minor unit; the last payment clears the balance exactly.
 */

export type Compounding = "monthly" | "semiannual" | "daily";
export const PAYMENT_FREQUENCIES = [
  "monthly",
  "semimonthly",
  "biweekly",
  "accelerated_biweekly",
  "weekly",
  "accelerated_weekly",
] as const;
export type PaymentFrequency = (typeof PAYMENT_FREQUENCIES)[number];

export interface LoanTerms {
  principalMinor: number;
  annualRate: number;
  compounding: Compounding;
  frequency: PaymentFrequency;
  /** The lender's payment, or null to amortise exactly. */
  paymentMinor: number | null;
  amortizationMonths: number;
  termMonths: number | null;
  firstPaymentDate: IsoDate;
  prepaymentAllowancePct: number | null;
}

/** Enough for a sixty-year weekly loan, and a hard stop for anything else. */
const MAX_PERIODS = 60 * 52 + 1;

export function paymentsPerYear(frequency: PaymentFrequency): number {
  switch (frequency) {
    case "monthly":
      return 12;
    case "semimonthly":
      return 24;
    case "biweekly":
    case "accelerated_biweekly":
      return 26;
    case "weekly":
    case "accelerated_weekly":
      return 52;
  }
}

/** The interest rate per payment period, as a fraction. */
export function periodicRate(
  annualRatePct: number,
  compounding: Compounding,
  perYear: number,
): number {
  if (!(annualRatePct >= 0) || !Number.isFinite(annualRatePct))
    throw new Error(`Not a rate: ${annualRatePct}`);
  const r = annualRatePct / 100;
  const periodsPerYear =
    compounding === "monthly" ? 12 : compounding === "semiannual" ? 2 : 365;
  return Math.pow(1 + r / periodsPerYear, periodsPerYear / perYear) - 1;
}

/** The level payment that repays `principal` over `n` periods at `rate` per period. */
export function levelPayment(
  principalMinor: number,
  rate: number,
  periods: number,
): number {
  if (principalMinor <= 0) return 0;
  if (periods <= 0) return principalMinor;
  const exact =
    rate === 0
      ? principalMinor / periods
      : (principalMinor * rate) / (1 - Math.pow(1 + rate, -periods));
  // Never a zero payment: 1¢ over twelve months at 5% would otherwise
  // round to nothing and never be repaid.
  return Math.max(1, roundHalfAwayFromZero(exact));
}

/**
 * The scheduled payment for these terms. Accelerated frequencies pay the
 * *monthly* payment divided (half every two weeks, a quarter every week),
 * which is what makes them accelerated: 26 halves are 13 monthly payments.
 */
export function scheduledPayment(
  terms: Pick<
    LoanTerms,
    | "principalMinor"
    | "annualRate"
    | "compounding"
    | "frequency"
    | "paymentMinor"
    | "amortizationMonths"
  >,
): number {
  if (terms.paymentMinor) return terms.paymentMinor;
  if (
    terms.frequency === "accelerated_biweekly" ||
    terms.frequency === "accelerated_weekly"
  ) {
    const monthly = levelPayment(
      terms.principalMinor,
      periodicRate(terms.annualRate, terms.compounding, 12),
      terms.amortizationMonths,
    );
    return Math.max(
      1,
      roundHalfAwayFromZero(
        monthly / (terms.frequency === "accelerated_biweekly" ? 2 : 4),
      ),
    );
  }
  const perYear = paymentsPerYear(terms.frequency);
  return levelPayment(
    terms.principalMinor,
    periodicRate(terms.annualRate, terms.compounding, perYear),
    Math.round((terms.amortizationMonths * perYear) / 12),
  );
}

/** The k-th payment date (0-based) from the first. */
export function paymentDate(
  first: IsoDate,
  frequency: PaymentFrequency,
  k: number,
): IsoDate {
  switch (frequency) {
    case "monthly":
      return addMonths(first, k, dayOf(first));
    case "semimonthly": {
      // The first day, and fifteen days later (or the month's end).
      const month = addMonths(first, Math.floor(k / 2), dayOf(first));
      if (k % 2 === 0) return month;
      const y = yearOf(month);
      const m = monthOf(month);
      return makeDate(y, m, Math.min(dayOf(first) + 15, daysInMonth(y, m)));
    }
    case "biweekly":
    case "accelerated_biweekly":
      return addDays(first, 14 * k);
    case "weekly":
    case "accelerated_weekly":
      return addDays(first, 7 * k);
  }
}

interface ScheduleRow {
  date: IsoDate;
  paymentMinor: number;
  interestMinor: number;
  principalMinor: number;
  extraMinor: number;
  balanceMinor: number;
}

export interface AmortizationResult {
  rows: ScheduleRow[];
  totalInterestMinor: number;
  totalPaidMinor: number;
  payoffDate: IsoDate | null;
  /** The payment does not cover the interest: the balance never falls. */
  neverEnds: boolean;
}

export interface ScheduleInput {
  balanceMinor: number;
  annualRate: number;
  compounding: Compounding;
  frequency: PaymentFrequency;
  paymentMinor: number;
  firstPaymentDate: IsoDate;
  /** Added to every payment. */
  extraPerPaymentMinor?: number;
  /** One-off prepayments, applied on the first payment on or after their date. */
  lumpSums?: { date: IsoDate; amountMinor: number }[];
  /** Change the rate from a date (a renewal), re-amortising or keeping the payment. */
  rateChange?: { date: IsoDate; annualRate: number; newPaymentMinor?: number };
}

export function amortize(input: ScheduleInput): AmortizationResult {
  const perYear = paymentsPerYear(input.frequency);
  let rate = periodicRate(input.annualRate, input.compounding, perYear);
  let payment = input.paymentMinor;
  let balance = input.balanceMinor;
  const lumps = [...(input.lumpSums ?? [])].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const rows: ScheduleRow[] = [];
  let totalInterest = 0;
  let totalPaid = 0;
  let rateChanged = false;

  for (let k = 0; balance > 0 && k < MAX_PERIODS; k += 1) {
    const date = paymentDate(input.firstPaymentDate, input.frequency, k);
    if (input.rateChange && !rateChanged && date >= input.rateChange.date) {
      rateChanged = true;
      rate = periodicRate(
        input.rateChange.annualRate,
        input.compounding,
        perYear,
      );
      if (input.rateChange.newPaymentMinor)
        payment = input.rateChange.newPaymentMinor;
    }
    const interest = roundHalfAwayFromZero(balance * rate);
    if (payment <= interest && k === 0) {
      return {
        rows: [],
        totalInterestMinor: 0,
        totalPaidMinor: 0,
        payoffDate: null,
        neverEnds: true,
      };
    }
    if (payment <= interest) {
      return {
        rows,
        totalInterestMinor: totalInterest,
        totalPaidMinor: totalPaid,
        payoffDate: null,
        neverEnds: true,
      };
    }
    let extra = input.extraPerPaymentMinor ?? 0;
    while (lumps.length && lumps[0].date <= date)
      extra += lumps.shift()!.amountMinor;

    const due = Math.min(payment, balance + interest);
    const principal = due - interest;
    const extraApplied = Math.min(extra, balance - principal);
    balance -= principal + extraApplied;
    totalInterest += interest;
    totalPaid += due + extraApplied;
    rows.push({
      date,
      paymentMinor: due,
      interestMinor: interest,
      principalMinor: principal,
      extraMinor: extraApplied,
      balanceMinor: balance,
    });
  }
  return {
    rows,
    totalInterestMinor: totalInterest,
    totalPaidMinor: totalPaid,
    payoffDate:
      balance === 0 && rows.length ? rows[rows.length - 1].date : null,
    neverEnds: balance > 0,
  };
}

/** When the term ends and the mortgage renews, or null for a loan with no term. */
export function renewalDate(
  terms: Pick<LoanTerms, "firstPaymentDate" | "termMonths">,
): IsoDate | null {
  return terms.termMonths
    ? addMonths(terms.firstPaymentDate, terms.termMonths)
    : null;
}

/** The remaining schedule from what is owed now, on the loan's own terms. */
export function projectFromBalance(
  terms: LoanTerms,
  owedMinor: number,
  from: IsoDate,
  whatIf: Pick<
    ScheduleInput,
    "extraPerPaymentMinor" | "lumpSums" | "rateChange"
  > = {},
): AmortizationResult {
  // The next payment on the loan's calendar on or after `from`.
  let k = 0;
  while (
    paymentDate(terms.firstPaymentDate, terms.frequency, k) < from &&
    k < MAX_PERIODS
  )
    k += 1;
  return amortize({
    balanceMinor: owedMinor,
    annualRate: terms.annualRate,
    compounding: terms.compounding,
    frequency: terms.frequency,
    paymentMinor: scheduledPayment(terms),
    firstPaymentDate: paymentDate(terms.firstPaymentDate, terms.frequency, k),
    ...whatIf,
  });
}

/** How a payment of `paymentMinor` splits, for recording it in the ledger. */
export function splitPayment(
  owedMinor: number,
  annualRate: number,
  compounding: Compounding,
  frequency: PaymentFrequency,
  paymentMinor: number,
) {
  const interest = Math.min(
    paymentMinor,
    roundHalfAwayFromZero(
      owedMinor *
        periodicRate(annualRate, compounding, paymentsPerYear(frequency)),
    ),
  );
  const principal = Math.min(owedMinor, paymentMinor - interest);
  return { interestMinor: interest, principalMinor: principal };
}

// ── Paying down several debts ───────────────────────────────────────────────

export interface Debt {
  id: string;
  name: string;
  /** What is owed, positive. */
  balanceMinor: number;
  annualRate: number;
  minimumPaymentMinor: number;
}

export interface PayoffPlan {
  feasible: boolean;
  /** Why not, when not. */
  reason: string | null;
  months: number;
  totalInterestMinor: number;
  /** Each debt and the month (1-based) it is cleared. */
  order: { id: string; month: number }[];
}

/**
 * A month-by-month plan for clearing several debts with a fixed monthly
 * budget. Every debt gets its minimum; everything left over goes to one
 * target — the highest rate first (avalanche: least interest) or the
 * smallest balance first (snowball: quickest wins). A cleared debt's
 * minimum rolls into the next target. Interest is simple monthly (annual
 * rate ÷ 12), which is how cards and lines of credit charge.
 */
export function planPayoff(
  debts: readonly Debt[],
  monthlyBudgetMinor: number,
  strategy: "avalanche" | "snowball",
): PayoffPlan {
  const live = debts.filter((d) => d.balanceMinor > 0).map((d) => ({ ...d }));
  const minimums = live.reduce(
    (t, d) => t + Math.min(d.minimumPaymentMinor, d.balanceMinor),
    0,
  );
  if (live.length === 0)
    return {
      feasible: true,
      reason: null,
      months: 0,
      totalInterestMinor: 0,
      order: [],
    };
  if (monthlyBudgetMinor < minimums) {
    return {
      feasible: false,
      reason: "The budget does not cover the minimum payments.",
      months: 0,
      totalInterestMinor: 0,
      order: [],
    };
  }
  const rank = (a: Debt, b: Debt) =>
    strategy === "avalanche"
      ? b.annualRate - a.annualRate || a.balanceMinor - b.balanceMinor
      : a.balanceMinor - b.balanceMinor || b.annualRate - a.annualRate;

  let totalInterest = 0;
  const order: { id: string; month: number }[] = [];
  for (let month = 1; month <= 600; month += 1) {
    for (const debt of live) {
      if (debt.balanceMinor <= 0) continue;
      const interest = roundHalfAwayFromZero(
        (debt.balanceMinor * debt.annualRate) / 1200,
      );
      debt.balanceMinor += interest;
      totalInterest += interest;
    }
    let left = monthlyBudgetMinor;
    for (const debt of live) {
      if (debt.balanceMinor <= 0) continue;
      const pay = Math.min(debt.minimumPaymentMinor, debt.balanceMinor, left);
      debt.balanceMinor -= pay;
      left -= pay;
    }
    for (const debt of [...live].filter((d) => d.balanceMinor > 0).sort(rank)) {
      if (left <= 0) break;
      const pay = Math.min(left, debt.balanceMinor);
      debt.balanceMinor -= pay;
      left -= pay;
    }
    for (const debt of live) {
      if (debt.balanceMinor <= 0 && !order.some((o) => o.id === debt.id))
        order.push({ id: debt.id, month });
    }
    if (live.every((d) => d.balanceMinor <= 0)) {
      return {
        feasible: true,
        reason: null,
        months: month,
        totalInterestMinor: totalInterest,
        order,
      };
    }
  }
  return {
    feasible: false,
    reason: "At this budget the debts are not cleared within 50 years.",
    months: 600,
    totalInterestMinor: totalInterest,
    order,
  };
}
