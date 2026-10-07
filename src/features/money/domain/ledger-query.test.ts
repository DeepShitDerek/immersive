import { describe, expect, it } from "vitest";
import type { Transaction } from "./ledger";
import {
  childrenIndex,
  filterTransactions,
  isUncategorised,
} from "./ledger-query";

const t = (id: string, overrides: Partial<Transaction>): Transaction => ({
  id,
  date: "2026-02-10",
  kind: "expense",
  status: "cleared",
  description: id,
  payee: null,
  notes: null,
  provider: null,
  marketRate: null,
  scheduleId: null,
  occurrenceDate: null,
  importHash: null,
  postings: [],
  ...overrides,
});
const p = (
  accountId: string,
  amountMinor: number,
  categoryId: string | null = null,
) => ({
  accountId,
  categoryId,
  amountMinor,
  fxRate: 1,
  baseAmountMinor: amountMinor,
});

const all = [
  t("coffee", {
    description: "TIM HORTONS #12",
    notes: "with Priya",
    postings: [p("chq", -250, "coffee")],
  }),
  t("groceries", {
    date: "2026-03-01",
    postings: [p("visa", -8000, "groceries"), p("visa", -500)],
  }),
  t("pay", {
    kind: "income",
    date: "2026-02-15",
    postings: [p("chq", 250000, "salary")],
  }),
  t("send", {
    kind: "transfer",
    provider: "Wise",
    postings: [p("chq", -100000), p("nro", 6000000)],
  }),
  t("pending", { status: "pending", postings: [p("chq", -100, "coffee")] }),
];
const ids = (list: Transaction[]) => list.map((x) => x.id);

describe("filterTransactions", () => {
  it("filters by account, kind, status and date range", () => {
    expect(ids(filterTransactions(all, { accountId: "nro" }))).toEqual([
      "send",
    ]);
    expect(ids(filterTransactions(all, { kind: "income" }))).toEqual(["pay"]);
    expect(ids(filterTransactions(all, { status: "pending" }))).toEqual([
      "pending",
    ]);
    expect(
      ids(filterTransactions(all, { from: "2026-02-11", to: "2026-02-28" })),
    ).toEqual(["pay"]);
  });

  it("finds every word, in any order, across description, notes and provider", () => {
    expect(ids(filterTransactions(all, { text: "priya tim" }))).toEqual([
      "coffee",
    ]);
    expect(ids(filterTransactions(all, { text: "wise" }))).toEqual(["send"]);
    expect(ids(filterTransactions(all, { text: "  " }))).toHaveLength(5);
  });

  it("includes a parent's children when filtering by category", () => {
    const children = childrenIndex([
      { id: "coffee", parentId: "dining" },
      { id: "dining", parentId: null },
    ]);
    expect(
      ids(
        filterTransactions(all, { categoryId: "dining", childrenOf: children }),
      ),
    ).toEqual(["coffee", "pending"]);
    expect(ids(filterTransactions(all, { categoryId: "coffee" }))).toEqual([
      "coffee",
      "pending",
    ]);
  });

  it("finds uncategorised spending, never transfers", () => {
    expect(ids(filterTransactions(all, { categoryId: "none" }))).toEqual([
      "groceries",
    ]);
    expect(isUncategorised(all[3])).toBe(false);
  });
});
