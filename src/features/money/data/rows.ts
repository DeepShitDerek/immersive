import type {
  Account,
  AccountKind,
  Posting,
  Registration,
  Transaction,
  TransactionKind,
  TransactionStatus,
} from "../domain/ledger";
import type { RateRow } from "../domain/fx";
import type { Budget } from "../domain/budget";
import type { Goal } from "../domain/goals";
import type {
  Application,
  ApplicationStatus,
  CreditProduct,
  DocumentStatus,
} from "../domain/applications";
import type { CreditScore, IncomeSource } from "../domain/lender-report";
import type {
  AssetClass,
  Price,
  Region,
  Security,
  Trade,
  TradeKind,
} from "../domain/invest";
import type { Compounding, LoanTerms, PaymentFrequency } from "../domain/loan";
import type { RoomEntry, RoomRegistration } from "../domain/room";
import type { Frequency, Schedule, ScheduleKind } from "../domain/schedule";
import type { Bucket, Category, MoneySettings } from "../domain/model";
import { DEFAULT_SETTINGS } from "../domain/model";

export { DEFAULT_SETTINGS };
export type { Category, MoneySettings };

/**
 * Database rows ↔ domain objects.
 *
 * Rows are snake_case and carry Postgres types as PostgREST serialises them:
 * BIGINT and NUMERIC arrive as numbers or numeric strings, dates as
 * "YYYY-MM-DD". Everything is normalised here, once, so the domain never
 * sees a string where it expects an amount.
 */

/** BIGINT minor units → a safe integer, or an error rather than a wrong number. */
export function toMinor(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isSafeInteger(n)) {
    throw new Error(`Not a whole amount from the database: ${String(value)}`);
  }
  return n;
}

const toMinorOrNull = (value: unknown): number | null =>
  value == null ? null : toMinor(value);

function toRate(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) {
    throw new Error(`Not a rate from the database: ${String(value)}`);
  }
  return n;
}

export interface SettingsRow {
  user_id?: string;
  base_currency: string;
  home_currency: string;
  province: string | null;
  birth_year: number | null;
  resident_since: string | null;
  needs_pct: number | string;
  wants_pct: number | string;
  save_pct: number | string;
  emergency_months: number | string;
}

export const settingsFromRow = (row: SettingsRow): MoneySettings => ({
  baseCurrency: row.base_currency,
  homeCurrency: row.home_currency,
  province: row.province,
  birthYear: row.birth_year,
  residentSince: row.resident_since,
  needsPct: Number(row.needs_pct),
  wantsPct: Number(row.wants_pct),
  savePct: Number(row.save_pct),
  emergencyMonths: Number(row.emergency_months),
});

export const settingsToRow = (
  s: MoneySettings,
): Omit<SettingsRow, "user_id"> => ({
  base_currency: s.baseCurrency,
  home_currency: s.homeCurrency,
  province: s.province,
  birth_year: s.birthYear,
  resident_since: s.residentSince,
  needs_pct: s.needsPct,
  wants_pct: s.wantsPct,
  save_pct: s.savePct,
  emergency_months: s.emergencyMonths,
});

export interface AccountRow {
  id: string;
  institution_id: string | null;
  name: string;
  kind: AccountKind;
  registration: Registration;
  country: string;
  currency: string;
  opening_balance_minor: number | string;
  opening_date: string;
  credit_limit_minor: number | string | null;
  statement_day: number | null;
  payment_due_day: number | null;
  interest_rate: number | string | null;
  is_liquid: boolean;
  in_net_worth: boolean;
  import_ref: string | null;
  color: string | null;
  notes: string | null;
  sort_order: number;
  archived_at: string | null;
}

/** An account with the fields only the UI needs. */
export interface AccountRecord extends Account {
  importRef: string | null;
  color: string | null;
  notes: string | null;
  sortOrder: number;
}

export const accountFromRow = (row: AccountRow): AccountRecord => ({
  id: row.id,
  institutionId: row.institution_id,
  name: row.name,
  kind: row.kind,
  registration: row.registration,
  country: row.country,
  currency: row.currency,
  openingBalanceMinor: toMinor(row.opening_balance_minor),
  openingDate: row.opening_date,
  creditLimitMinor: toMinorOrNull(row.credit_limit_minor),
  statementDay: row.statement_day,
  paymentDueDay: row.payment_due_day,
  interestRate: row.interest_rate == null ? null : Number(row.interest_rate),
  isLiquid: row.is_liquid,
  inNetWorth: row.in_net_worth,
  archivedAt: row.archived_at,
  importRef: row.import_ref,
  color: row.color,
  notes: row.notes,
  sortOrder: row.sort_order,
});

export const accountToRow = (a: Omit<AccountRecord, "id" | "archivedAt">) => ({
  institution_id: a.institutionId,
  name: a.name.trim(),
  kind: a.kind,
  registration: a.registration,
  country: a.country,
  currency: a.currency,
  opening_balance_minor: a.openingBalanceMinor,
  opening_date: a.openingDate,
  credit_limit_minor: a.creditLimitMinor,
  statement_day: a.statementDay,
  payment_due_day: a.paymentDueDay,
  interest_rate: a.interestRate,
  is_liquid: a.isLiquid,
  in_net_worth: a.inNetWorth,
  import_ref: a.importRef || null,
  color: a.color,
  notes: a.notes || null,
  sort_order: a.sortOrder,
});

export interface CategoryRow {
  id: string;
  parent_id: string | null;
  name: string;
  bucket: Bucket;
  is_essential: boolean;
  icon: string | null;
  color: string | null;
  sort_order: number;
  archived_at: string | null;
}

export const categoryFromRow = (row: CategoryRow): Category => ({
  id: row.id,
  parentId: row.parent_id,
  name: row.name,
  bucket: row.bucket,
  isEssential: row.is_essential,
  icon: row.icon,
  color: row.color,
  sortOrder: row.sort_order,
  archivedAt: row.archived_at,
});

export interface PostingRow {
  account_id: string;
  category_id: string | null;
  amount_minor: number | string;
  memo: string | null;
  fx_rate: number | string | null;
  base_amount_minor: number | string | null;
}

export interface TransactionRow {
  id: string;
  date: string;
  kind: TransactionKind;
  status: TransactionStatus;
  description: string;
  payee: string | null;
  notes: string | null;
  provider: string | null;
  market_rate: number | string | null;
  schedule_id: string | null;
  occurrence_date: string | null;
  import_hash: string | null;
  money_posting: PostingRow[];
}

const postingFromRow = (row: PostingRow): Posting => ({
  accountId: row.account_id,
  categoryId: row.category_id,
  amountMinor: toMinor(row.amount_minor),
  memo: row.memo,
  fxRate: toRate(row.fx_rate),
  baseAmountMinor: toMinorOrNull(row.base_amount_minor),
});

export const transactionFromRow = (row: TransactionRow): Transaction => ({
  id: row.id,
  date: row.date,
  kind: row.kind,
  status: row.status,
  description: row.description,
  payee: row.payee,
  notes: row.notes,
  provider: row.provider,
  marketRate: toRate(row.market_rate),
  scheduleId: row.schedule_id,
  occurrenceDate: row.occurrence_date,
  importHash: row.import_hash,
  postings: (row.money_posting ?? []).map(postingFromRow),
});

/** What the write RPCs take. */
export interface TransactionDraft {
  date: string;
  kind: TransactionKind;
  status?: TransactionStatus;
  description: string;
  payee?: string | null;
  notes?: string | null;
  rawDescription?: string | null;
  provider?: string | null;
  marketRate?: number | null;
  scheduleId?: string | null;
  occurrenceDate?: string | null;
  importHash?: string | null;
  postings: Posting[];
}

export const draftToRpc = (draft: TransactionDraft) => ({
  p_transaction: {
    date: draft.date,
    kind: draft.kind,
    status: draft.status ?? "cleared",
    description: draft.description.trim(),
    payee: draft.payee?.trim() || null,
    notes: draft.notes?.trim() || null,
    raw_description: draft.rawDescription ?? null,
    provider: draft.provider?.trim() || null,
    // As text, so NUMERIC keeps every digit the float had.
    market_rate: draft.marketRate == null ? null : String(draft.marketRate),
    schedule_id: draft.scheduleId ?? null,
    occurrence_date: draft.occurrenceDate ?? null,
    import_hash: draft.importHash ?? null,
  },
  p_postings: draft.postings.map((p) => ({
    account_id: p.accountId,
    category_id: p.categoryId,
    amount_minor: p.amountMinor,
    memo: p.memo?.trim() || null,
    fx_rate: p.fxRate == null ? null : String(p.fxRate),
    base_amount_minor: p.baseAmountMinor,
  })),
});

export interface RateDbRow {
  base: string;
  quote: string;
  as_of: string;
  rate: number | string;
  source: string | null;
}

export const rateFromRow = (row: RateDbRow): RateRow => ({
  base: row.base,
  quote: row.quote,
  asOf: row.as_of,
  rate: toRate(row.rate) ?? 0,
});

// ── Planning (phase 3) ─────────────────────────────────────────────────────

export interface ScheduleRow {
  id: string;
  name: string;
  kind: ScheduleKind;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  amount_minor: number | string;
  to_amount_minor: number | string | null;
  is_estimate: boolean;
  frequency: Frequency;
  start_date: string;
  end_date: string | null;
  day_one: number | null;
  day_two: number | null;
  payee: string | null;
  notes: string | null;
  archived_at: string | null;
}

export const scheduleFromRow = (row: ScheduleRow): Schedule => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  accountId: row.account_id,
  toAccountId: row.to_account_id,
  categoryId: row.category_id,
  amountMinor: toMinor(row.amount_minor),
  toAmountMinor: toMinorOrNull(row.to_amount_minor),
  isEstimate: row.is_estimate,
  frequency: row.frequency,
  startDate: row.start_date,
  endDate: row.end_date,
  dayOne: row.day_one,
  dayTwo: row.day_two,
  payee: row.payee,
  notes: row.notes,
  archivedAt: row.archived_at,
});

export const scheduleToRow = (
  s: Omit<Schedule, "id" | "archivedAt">,
): Omit<ScheduleRow, "id" | "archived_at"> => ({
  name: s.name.trim(),
  kind: s.kind,
  account_id: s.accountId,
  to_account_id: s.kind === "transfer" ? s.toAccountId : null,
  category_id: s.kind === "transfer" ? null : s.categoryId,
  amount_minor: s.amountMinor,
  to_amount_minor: s.kind === "transfer" ? s.toAmountMinor : null,
  is_estimate: s.isEstimate,
  frequency: s.frequency,
  start_date: s.startDate,
  end_date: s.endDate,
  day_one: s.frequency === "semimonthly" ? s.dayOne : null,
  day_two: s.frequency === "semimonthly" ? s.dayTwo : null,
  payee: s.payee?.trim() || null,
  notes: s.notes?.trim() || null,
});

export interface BudgetRow {
  id: string;
  category_id: string;
  from_month: string;
  amount_minor: number | string;
  rollover: boolean;
}

export const budgetFromRow = (row: BudgetRow): Budget => ({
  id: row.id,
  categoryId: row.category_id,
  fromMonth: row.from_month,
  amountMinor: toMinor(row.amount_minor),
  rollover: row.rollover,
});

export interface GoalRow {
  id: string;
  name: string;
  target_minor: number | string;
  currency: string;
  target_date: string | null;
  notes: string | null;
  sort_order: number;
  achieved_at: string | null;
  archived_at: string | null;
  money_goal_account: { account_id: string }[];
}

export const goalFromRow = (row: GoalRow): Goal => ({
  id: row.id,
  name: row.name,
  targetMinor: toMinor(row.target_minor),
  currency: row.currency,
  targetDate: row.target_date,
  accountIds: (row.money_goal_account ?? []).map((link) => link.account_id),
  notes: row.notes,
  achievedAt: row.achieved_at,
  archivedAt: row.archived_at,
});

// ── Financing (phase 4) ────────────────────────────────────────────────────

export interface LoanRow {
  id: string;
  account_id: string;
  lender: string | null;
  principal_minor: number | string;
  annual_rate: number | string;
  rate_type: "fixed" | "variable";
  compounding: Compounding;
  payment_frequency: PaymentFrequency;
  payment_minor: number | string | null;
  amortization_months: number;
  term_months: number | null;
  first_payment_date: string;
  prepayment_allowance_pct: number | string | null;
  notes: string | null;
}

export interface Loan extends LoanTerms {
  id: string;
  accountId: string;
  lender: string | null;
  rateType: "fixed" | "variable";
  notes: string | null;
}

export const loanFromRow = (row: LoanRow): Loan => ({
  id: row.id,
  accountId: row.account_id,
  lender: row.lender,
  principalMinor: toMinor(row.principal_minor),
  annualRate: Number(row.annual_rate),
  rateType: row.rate_type,
  compounding: row.compounding,
  frequency: row.payment_frequency,
  paymentMinor: toMinorOrNull(row.payment_minor),
  amortizationMonths: row.amortization_months,
  termMonths: row.term_months,
  firstPaymentDate: row.first_payment_date,
  prepaymentAllowancePct:
    row.prepayment_allowance_pct == null
      ? null
      : Number(row.prepayment_allowance_pct),
  notes: row.notes,
});

export const loanToRow = (l: Omit<Loan, "id">): Omit<LoanRow, "id"> => ({
  account_id: l.accountId,
  lender: l.lender?.trim() || null,
  principal_minor: l.principalMinor,
  annual_rate: l.annualRate,
  rate_type: l.rateType,
  compounding: l.compounding,
  payment_frequency: l.frequency,
  payment_minor: l.paymentMinor,
  amortization_months: l.amortizationMonths,
  term_months: l.termMonths,
  first_payment_date: l.firstPaymentDate,
  prepayment_allowance_pct: l.prepaymentAllowancePct,
  notes: l.notes?.trim() || null,
});

export interface IncomeSourceRow {
  id: string;
  name: string;
  employment: IncomeSource["employment"];
  role: string | null;
  gross_annual_minor: number | string;
  currency: string;
  start_date: string;
  end_date: string | null;
  country: string;
  notes: string | null;
}

export const incomeFromRow = (row: IncomeSourceRow): IncomeSource => ({
  id: row.id,
  name: row.name,
  employment: row.employment,
  role: row.role,
  grossAnnualMinor: toMinor(row.gross_annual_minor),
  currency: row.currency,
  startDate: row.start_date,
  endDate: row.end_date,
  country: row.country,
  notes: row.notes,
});

export const incomeToRow = (
  s: Omit<IncomeSource, "id">,
): Omit<IncomeSourceRow, "id"> => ({
  name: s.name.trim(),
  employment: s.employment,
  role: s.role?.trim() || null,
  gross_annual_minor: s.grossAnnualMinor,
  currency: s.currency,
  start_date: s.startDate,
  end_date: s.endDate,
  country: s.country,
  notes: s.notes?.trim() || null,
});

export interface CreditScoreRow {
  id: string;
  bureau: CreditScore["bureau"];
  score: number;
  as_of: string;
  source: string | null;
}

export const scoreFromRow = (row: CreditScoreRow): CreditScore => ({
  id: row.id,
  bureau: row.bureau,
  score: row.score,
  asOf: row.as_of,
  source: row.source,
});

interface ApplicationDocRow {
  id: string;
  application_id: string;
  name: string;
  status: DocumentStatus;
  note: string | null;
  sort_order: number;
}

export interface ApplicationRow {
  id: string;
  lender: string;
  product: CreditProduct;
  status: ApplicationStatus;
  amount_minor: number | string | null;
  currency: string;
  rate: number | string | null;
  term_months: number | null;
  amortization_months: number | null;
  purchase_price_minor: number | string | null;
  down_payment_minor: number | string | null;
  property_tax_monthly_minor: number | string | null;
  heating_monthly_minor: number | string | null;
  condo_fees_monthly_minor: number | string | null;
  submitted_on: string | null;
  decided_on: string | null;
  hard_inquiry_on: string | null;
  notes: string | null;
  money_application_doc: ApplicationDocRow[];
}

export const applicationFromRow = (row: ApplicationRow): Application => ({
  id: row.id,
  lender: row.lender,
  product: row.product,
  status: row.status,
  amountMinor: toMinorOrNull(row.amount_minor),
  currency: row.currency,
  rate: row.rate == null ? null : Number(row.rate),
  termMonths: row.term_months,
  amortizationMonths: row.amortization_months,
  purchasePriceMinor: toMinorOrNull(row.purchase_price_minor),
  downPaymentMinor: toMinorOrNull(row.down_payment_minor),
  propertyTaxMonthlyMinor: toMinorOrNull(row.property_tax_monthly_minor),
  heatingMonthlyMinor: toMinorOrNull(row.heating_monthly_minor),
  condoFeesMonthlyMinor: toMinorOrNull(row.condo_fees_monthly_minor),
  submittedOn: row.submitted_on,
  decidedOn: row.decided_on,
  hardInquiryOn: row.hard_inquiry_on,
  notes: row.notes,
  documents: [...(row.money_application_doc ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      note: d.note,
      sortOrder: d.sort_order,
    })),
});

export const applicationToRow = (
  a: Omit<Application, "id" | "documents">,
): Omit<ApplicationRow, "id" | "money_application_doc"> => ({
  lender: a.lender.trim(),
  product: a.product,
  status: a.status,
  amount_minor: a.amountMinor,
  currency: a.currency,
  rate: a.rate,
  term_months: a.termMonths,
  amortization_months: a.amortizationMonths,
  purchase_price_minor: a.product === "mortgage" ? a.purchasePriceMinor : null,
  down_payment_minor: a.product === "mortgage" ? a.downPaymentMinor : null,
  property_tax_monthly_minor:
    a.product === "mortgage" ? a.propertyTaxMonthlyMinor : null,
  heating_monthly_minor:
    a.product === "mortgage" ? a.heatingMonthlyMinor : null,
  condo_fees_monthly_minor:
    a.product === "mortgage" ? a.condoFeesMonthlyMinor : null,
  submitted_on: a.submittedOn,
  decided_on: a.decidedOn,
  hard_inquiry_on: a.hardInquiryOn,
  notes: a.notes?.trim() || null,
});

// ── Investing (phase 5) ────────────────────────────────────────────────────

export interface SecurityRow {
  id: string;
  symbol: string;
  name: string;
  currency: string;
  asset_class: AssetClass;
  region: Region;
  notes: string | null;
}

export const securityFromRow = (row: SecurityRow): Security => ({
  id: row.id,
  symbol: row.symbol,
  name: row.name,
  currency: row.currency,
  assetClass: row.asset_class,
  region: row.region,
  notes: row.notes,
});

export const securityToRow = (
  s: Omit<Security, "id">,
): Omit<SecurityRow, "id"> => ({
  symbol: s.symbol.trim().toUpperCase(),
  name: s.name.trim(),
  currency: s.currency,
  asset_class: s.assetClass,
  region: s.region,
  notes: s.notes?.trim() || null,
});

export interface PriceRow {
  security_id: string;
  date: string;
  price: number | string;
}

export const priceFromRow = (row: PriceRow): Price => {
  const price = Number(row.price);
  if (!Number.isFinite(price) || price <= 0)
    throw new Error(`Unreadable price for ${row.security_id} on ${row.date}`);
  return { securityId: row.security_id, date: row.date, price };
};

export interface TradeRow {
  id: string;
  account_id: string;
  security_id: string | null;
  date: string;
  kind: TradeKind;
  quantity: number | string | null;
  amount_minor: number | string;
  fee_minor: number | string;
  transaction_id: string | null;
  notes: string | null;
  created_at: string;
}

export const tradeFromRow = (row: TradeRow): Trade => ({
  id: row.id,
  accountId: row.account_id,
  securityId: row.security_id,
  date: row.date,
  kind: row.kind,
  quantity: row.quantity == null ? null : Number(row.quantity),
  amountMinor: toMinor(row.amount_minor),
  feeMinor: toMinor(row.fee_minor),
  transactionId: row.transaction_id,
  notes: row.notes,
  createdAt: row.created_at,
});

/** What money_save_trade takes: the trade, and for income or a fee the category and wording of its ledger transaction. */
export interface TradeDraft {
  id?: string;
  accountId: string;
  securityId: string | null;
  date: string;
  kind: TradeKind;
  quantity: number | null;
  amountMinor: number;
  feeMinor: number;
  notes: string | null;
  categoryId: string | null;
  description: string | null;
  /** Account currency → base, and the amount in the base currency (unsigned), for the ledger posting when they differ. */
  fxRate: number | null;
  baseAmountMinor: number | null;
}

export const tradeToRpc = (t: TradeDraft): Record<string, unknown> => ({
  id: t.id ?? null,
  account_id: t.accountId,
  security_id: t.securityId,
  date: t.date,
  kind: t.kind,
  // As a string, so NUMERIC keeps every digit.
  quantity: t.quantity == null ? null : String(t.quantity),
  amount_minor: t.amountMinor,
  fee_minor: t.feeMinor,
  notes: t.notes?.trim() || null,
  category_id: t.categoryId,
  description: t.description?.trim() || null,
  fx_rate: t.fxRate == null ? null : String(t.fxRate),
  base_amount_minor: t.baseAmountMinor,
});

export interface RoomRow {
  id: string;
  registration: RoomRegistration;
  year: number;
  room_minor: number | string;
  notes: string | null;
}

export interface RoomRecord extends RoomEntry {
  id: string;
  notes: string | null;
}

export const roomFromRow = (row: RoomRow): RoomRecord => ({
  id: row.id,
  registration: row.registration,
  year: row.year,
  roomMinor: toMinor(row.room_minor),
  notes: row.notes,
});
