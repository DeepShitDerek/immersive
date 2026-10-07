import type {
  AccountKind,
  Registration,
  TransactionKind,
} from "../domain/ledger";
import type { Bucket } from "../domain/model";

/** Words for the codes the ledger stores. */

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  chequing: "Chequing",
  savings: "Savings",
  credit_card: "Credit card",
  line_of_credit: "Line of credit",
  cash: "Cash",
  investment: "Investment",
  loan: "Loan",
  mortgage: "Mortgage",
  asset: "Asset (car, property…)",
  wallet: "Wallet (Wise, PayPal…)",
};

/** How accounts are grouped on the accounts screen. */
export const ACCOUNT_GROUPS: { label: string; kinds: AccountKind[] }[] = [
  {
    label: "Everyday banking",
    kinds: ["chequing", "savings", "cash", "wallet"],
  },
  { label: "Credit", kinds: ["credit_card", "line_of_credit"] },
  { label: "Investments", kinds: ["investment"] },
  { label: "Loans & mortgages", kinds: ["loan", "mortgage"] },
  { label: "Other assets", kinds: ["asset"] },
];

export const REGISTRATION_LABEL: Record<Registration, string> = {
  none: "Not registered",
  tfsa: "TFSA",
  rrsp: "RRSP",
  fhsa: "FHSA",
  resp: "RESP",
  rrif: "RRIF",
  lira: "LIRA",
  nre: "NRE",
  nro: "NRO",
  fcnr: "FCNR",
  ppf: "PPF",
  epf: "EPF",
};

export const REGISTRATION_HINT: Partial<Record<Registration, string>> = {
  tfsa: "Tax-free growth and withdrawals; contribution room is limited.",
  rrsp: "Contributions reduce your taxable income; taxed when withdrawn.",
  fhsa: "For a first home: deductible in, tax-free out for a qualifying purchase.",
  nre: "Rupee account for money earned abroad; interest tax-free in India, repatriable.",
  nro: "Rupee account for income earned in India; interest taxed in India.",
  fcnr: "Fixed deposit held in a foreign currency at an Indian bank.",
  ppf: "Indian Public Provident Fund.",
  epf: "Indian Employees' Provident Fund.",
};

const COUNTRY_LABEL: Record<string, string> = {
  CA: "Canada",
  IN: "India",
  US: "United States",
  GB: "United Kingdom",
  AE: "UAE",
};

export const countryLabel = (code: string): string =>
  COUNTRY_LABEL[code] ?? code;

export const TRANSACTION_KIND_LABEL: Record<TransactionKind, string> = {
  expense: "Expense",
  income: "Income",
  refund: "Refund",
  transfer: "Transfer",
  adjustment: "Balance adjustment",
};

export const BUCKET_LABEL: Record<Bucket, string> = {
  income: "Income",
  need: "Needs",
  want: "Wants",
  save: "Savings",
};

export const PROVINCES: { code: string; name: string }[] = [
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland and Labrador" },
  { code: "NS", name: "Nova Scotia" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" },
  { code: "YT", name: "Yukon" },
];

/** The currencies `money_currency` is seeded with, most likely first. */
export const ALL_CURRENCIES = [
  "CAD",
  "INR",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "AUD",
  "SGD",
  "NZD",
  "SAR",
  "QAR",
  "KWD",
  "BHD",
  "OMR",
  "HKD",
  "JPY",
  "KRW",
  "CNY",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "TRY",
  "PKR",
  "BDT",
  "LKR",
  "NPR",
  "PHP",
  "MYR",
  "THB",
  "IDR",
  "VND",
  "MXN",
  "BRL",
  "ZAR",
  "NGN",
  "KES",
  "EGP",
];

/** "Feb 3", or "Feb 3, 2025" outside the current year. */
export function shortDate(iso: string, today: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    ...(iso.slice(0, 4) !== today.slice(0, 4) && { year: "numeric" }),
    timeZone: "UTC",
  });
}
