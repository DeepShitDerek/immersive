import { addMonths, type IsoDate } from "./dates";

/**
 * Credit applications: the documents a lender will ask a newcomer
 * for, and the hard inquiries on the credit file.
 */

export const CREDIT_PRODUCTS = [
  "mortgage",
  "auto_loan",
  "personal_loan",
  "line_of_credit",
  "credit_card",
  "student_loan",
  "other",
] as const;
export type CreditProduct = (typeof CREDIT_PRODUCTS)[number];

export const APPLICATION_STATUSES = [
  "planning",
  "submitted",
  "conditional",
  "approved",
  "declined",
  "withdrawn",
  "funded",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type DocumentStatus = "needed" | "ready" | "sent";

export interface Application {
  id: string;
  lender: string;
  product: CreditProduct;
  status: ApplicationStatus;
  amountMinor: number | null;
  currency: string;
  rate: number | null;
  termMonths: number | null;
  amortizationMonths: number | null;
  purchasePriceMinor: number | null;
  downPaymentMinor: number | null;
  propertyTaxMonthlyMinor: number | null;
  heatingMonthlyMinor: number | null;
  condoFeesMonthlyMinor: number | null;
  submittedOn: IsoDate | null;
  decidedOn: IsoDate | null;
  hardInquiryOn: IsoDate | null;
  notes: string | null;
  documents: ApplicationDocument[];
}

export interface ApplicationDocument {
  id: string;
  name: string;
  status: DocumentStatus;
  note: string | null;
  sortOrder: number;
}

const IDENTITY = ["Passport", "PR card or work/study permit"];
const INCOME = [
  "Employment letter (role, salary, start date, permanent or not)",
  "Two most recent pay stubs",
];
const HISTORY = [
  "Notice of Assessment (if you have filed in Canada)",
  "T4 slips (if any)",
];

/** What a lender typically asks a newcomer for, by product. A starting list to edit. */
export const DEFAULT_DOCUMENTS: Record<CreditProduct, string[]> = {
  mortgage: [
    ...IDENTITY,
    ...INCOME,
    ...HISTORY,
    "90 days of bank statements for the down payment",
    "Proof of down payment source (gift letter, or transfer records from India)",
    "Signed purchase agreement",
    "MLS listing or property details",
    "Credit report (Equifax / TransUnion)",
  ],
  auto_loan: [
    ...IDENTITY,
    ...INCOME,
    "Driver's licence",
    "Bill of sale or dealer quote",
    "Proof of address",
  ],
  personal_loan: [
    ...IDENTITY,
    ...INCOME,
    "Proof of address",
    "Bank statements (last 3 months)",
  ],
  line_of_credit: [
    ...IDENTITY,
    ...INCOME,
    ...HISTORY,
    "Bank statements (last 3 months)",
  ],
  credit_card: [
    ...IDENTITY,
    "Proof of address",
    "Proof of income (pay stub or employment letter)",
  ],
  student_loan: [
    ...IDENTITY,
    "Letter of acceptance / enrolment",
    "Tuition fee statement",
  ],
  other: [...IDENTITY, ...INCOME],
};

/**
 * Hard inquiries in the last `months` months. Several close together lower
 * a score; a mortgage "rate shopping" window counts them as one, but
 * card and loan applications do not.
 */
export function recentInquiries(
  applications: readonly Pick<Application, "hardInquiryOn">[],
  today: IsoDate,
  months = 12,
): IsoDate[] {
  const since = addMonths(today, -months);
  return applications
    .map((a) => a.hardInquiryOn)
    .filter((d): d is IsoDate => !!d && d >= since && d <= today)
    .sort();
}

export const isOpen = (status: ApplicationStatus): boolean =>
  status === "planning" || status === "submitted" || status === "conditional";

/** Documents still to gather, and how far along the pack is. */
export function documentProgress(
  docs: readonly Pick<ApplicationDocument, "status">[],
): { done: number; total: number } {
  return {
    done: docs.filter((d) => d.status !== "needed").length,
    total: docs.length,
  };
}
