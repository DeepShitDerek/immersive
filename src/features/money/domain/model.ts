/**
 * The money module's shared record shapes, in domain terms
 * (camelCase, amounts as safe integers). `data/rows.ts` maps database rows
 * onto these; nothing here knows the database exists.
 */

export interface MoneySettings {
  baseCurrency: string;
  homeCurrency: string;
  province: string | null;
  birthYear: number | null;
  residentSince: string | null;
  needsPct: number;
  wantsPct: number;
  savePct: number;
  emergencyMonths: number;
}

export const DEFAULT_SETTINGS: MoneySettings = {
  baseCurrency: "CAD",
  homeCurrency: "INR",
  province: null,
  birthYear: null,
  residentSince: null,
  needsPct: 50,
  wantsPct: 30,
  savePct: 20,
  emergencyMonths: 6,
};

export interface Institution {
  id: string;
  name: string;
  country: string;
  notes: string | null;
}

export type Bucket = "income" | "need" | "want" | "save";

export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  bucket: Bucket;
  isEssential: boolean;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  archivedAt: string | null;
}

export interface Rule {
  id: string;
  priority: number;
  match: "contains" | "starts_with" | "equals" | "regex";
  pattern: string;
  accountId: string | null;
  categoryId: string | null;
  payee: string | null;
  isActive: boolean;
}

export interface Reconciliation {
  id: string;
  accountId: string;
  asOf: string;
  statementBalanceMinor: number;
  note: string | null;
}
