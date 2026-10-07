import { levelPayment, periodicRate } from "./loan";
import { roundHalfAwayFromZero } from "./money";

/**
 * How a Canadian lender sizes up a mortgage.
 *
 * These are published federal rules and CMHC guidelines, **as of 2025**.
 * Lenders apply their own on top, and the rules change; the screens say so
 * and date them. Nothing here is advice — it is the arithmetic a lender will
 * do, so the owner sees the answer before the lender does.
 */

export const RULES_AS_OF = "2025";

/** The minimum qualifying rate (OSFI B-20 / federal stress test). */
const QUALIFYING_FLOOR_PCT = 5.25;
/** Gross debt service and total debt service limits (CMHC). */
export const GDS_LIMIT = 0.39;
export const TDS_LIMIT = 0.44;
/** Share of a revolving balance lenders count as a monthly payment. */
const REVOLVING_PAYMENT_SHARE = 0.03;
/** The price above which a mortgage cannot be insured (Dec 2024). */
const INSURABLE_PRICE_CAP_MINOR = 150_000_000;

/** The stress-test rate: the contract rate + 2 points, or the floor, whichever is higher. */
export function qualifyingRate(contractRatePct: number): number {
  return Math.max(contractRatePct + 2, QUALIFYING_FLOOR_PCT);
}

/** Monthly principal and interest at the qualifying rate, semi-annual compounding. */
export function qualifyingPayment(
  mortgageMinor: number,
  contractRatePct: number,
  amortizationMonths: number,
): number {
  return levelPayment(
    mortgageMinor,
    periodicRate(qualifyingRate(contractRatePct), "semiannual", 12),
    amortizationMonths,
  );
}

/**
 * The smallest down payment allowed: 5% of the first $500,000, 10% of the
 * rest up to $1.5M; 20% of the whole price from $1.5M, where insurance
 * is not available.
 */
export function minimumDownPayment(priceMinor: number): number {
  if (priceMinor <= 0) return 0;
  if (priceMinor >= INSURABLE_PRICE_CAP_MINOR)
    return roundHalfAwayFromZero(priceMinor * 0.2);
  const first = Math.min(priceMinor, 50_000_000);
  const rest = Math.max(0, priceMinor - 50_000_000);
  return roundHalfAwayFromZero(first * 0.05 + rest * 0.1);
}

/**
 * CMHC's premium as a share of the mortgage, by loan-to-value, for an
 * insured (under 20% down) mortgage. Null when no premium applies (20% or
 * more down); throws past 95%, which cannot be insured.
 */
export function insurancePremiumRate(
  mortgageMinor: number,
  priceMinor: number,
): number | null {
  const ltv = mortgageMinor / priceMinor;
  if (ltv > 0.95 + 1e-12)
    throw new Error("A mortgage above 95% of the price cannot be insured");
  if (ltv <= 0.8 + 1e-12) return null;
  if (ltv <= 0.85 + 1e-12) return 0.028;
  if (ltv <= 0.9 + 1e-12) return 0.031;
  return 0.04;
}

export interface HousingCosts {
  propertyTaxMonthlyMinor: number;
  heatingMonthlyMinor: number;
  condoFeesMonthlyMinor: number;
}

/** What GDS counts besides the mortgage: tax, heat and half the condo fees. */
export const housingExtras = (costs: HousingCosts): number =>
  costs.propertyTaxMonthlyMinor +
  costs.heatingMonthlyMinor +
  roundHalfAwayFromZero(costs.condoFeesMonthlyMinor / 2);

export interface Ratios {
  gds: number;
  tds: number;
  passesGds: boolean;
  passesTds: boolean;
}

export function debtServiceRatios(input: {
  grossMonthlyIncomeMinor: number;
  mortgagePaymentMinor: number;
  costs: HousingCosts;
  otherDebtPaymentsMinor: number;
}): Ratios | null {
  if (input.grossMonthlyIncomeMinor <= 0) return null;
  const housing = input.mortgagePaymentMinor + housingExtras(input.costs);
  const gds = housing / input.grossMonthlyIncomeMinor;
  const tds =
    (housing + input.otherDebtPaymentsMinor) / input.grossMonthlyIncomeMinor;
  return { gds, tds, passesGds: gds <= GDS_LIMIT, passesTds: tds <= TDS_LIMIT };
}

/**
 * The largest mortgage the ratios allow: the smaller of what GDS and TDS
 * leave room for, as a payment, turned back into a principal at the
 * qualifying rate. Zero when the other costs already use the room.
 */
export function maximumMortgage(input: {
  grossMonthlyIncomeMinor: number;
  costs: HousingCosts;
  otherDebtPaymentsMinor: number;
  contractRatePct: number;
  amortizationMonths: number;
}): number {
  const extras = housingExtras(input.costs);
  const byGds = input.grossMonthlyIncomeMinor * GDS_LIMIT - extras;
  const byTds =
    input.grossMonthlyIncomeMinor * TDS_LIMIT -
    extras -
    input.otherDebtPaymentsMinor;
  const payment = Math.min(byGds, byTds);
  if (payment <= 0) return 0;
  const rate = periodicRate(
    qualifyingRate(input.contractRatePct),
    "semiannual",
    12,
  );
  const n = input.amortizationMonths;
  const principal =
    rate === 0 ? payment * n : (payment * (1 - Math.pow(1 + rate, -n))) / rate;
  return Math.max(0, Math.floor(principal));
}

/** The monthly payment lenders count for a revolving balance (card, line of credit). */
export const revolvingPayment = (owedMinor: number): number =>
  owedMinor > 0
    ? roundHalfAwayFromZero(owedMinor * REVOLVING_PAYMENT_SHARE)
    : 0;
