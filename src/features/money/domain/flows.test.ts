import { describe, expect, it } from "vitest";
import { periodFlows } from "./flows";
import type { Transaction } from "./ledger";

const p = (
  accountId: string,
  amountMinor: number,
  categoryId: string | null = null,
  base: number | null = amountMinor,
) => ({
  accountId,
  categoryId,
  amountMinor,
  fxRate: base === null ? null : 1,
  baseAmountMinor: base,
});
const t = (
  date: string,
  kind: Transaction["kind"],
  postings: Transaction["postings"],
  status: Transaction["status"] = "cleared",
) => ({
  date,
  kind,
  status,
  postings,
});

describe("periodFlows (mirrors money_day_flows)", () => {
  const history = [
    t("2026-02-03", "expense", [p("chq", -4500, "groceries")]),
    t("2026-02-04", "expense", [
      p("visa", -8000, "groceries"),
      p("visa", -1500, "fees"),
    ]),
    t("2026-02-06", "refund", [p("visa", 2000, "groceries")]),
    t("2026-02-15", "income", [p("chq", 250000, "salary")]),
    t("2026-02-17", "transfer", [p("chq", -8000), p("visa", 8000)]),
    t("2026-02-20", "transfer", [
      p("chq", -100000),
      p("nro", 6000000, null, 98361),
      p("chq", -499, "fees"),
    ]),
    t("2026-02-21", "expense", [p("nro", -5000, "chai", null)]),
    t("2026-02-22", "adjustment", [p("chq", -1)]),
    t("2026-03-01", "expense", [p("chq", -500)], "pending"),
    t("2026-01-31", "expense", [p("chq", -99999)]),
  ];
  const february = periodFlows(history, "2026-02-01", "2026-02-28");

  it("counts income, and spending less refunds plus transfer fees", () => {
    expect(february.incomeMinor).toBe(250000);
    expect(february.spendingMinor).toBe(4500 + 8000 + 1500 - 2000 + 499);
    expect(february.netMinor).toBe(250000 - 12499);
    expect(february.savingsRate).toBeCloseTo(0.95, 2);
  });

  it("never counts a transfer between own accounts, or an adjustment", () => {
    const onlyTransfer = periodFlows([history[4]], "2026-02-01", "2026-02-28");
    expect(onlyTransfer.spendingMinor).toBe(0);
    expect(onlyTransfer.incomeMinor).toBe(0);
    expect(
      periodFlows([history[7]], "2026-02-01", "2026-02-28").spendingMinor,
    ).toBe(0);
  });

  it("names unpriced postings instead of counting them at parity", () => {
    expect(february.unpriced).toBe(1);
  });

  it("splits by category, refunds netted against their category", () => {
    expect(february.spendingByCategory.get("groceries")).toBe(
      4500 + 8000 - 2000,
    );
    expect(february.spendingByCategory.get("fees")).toBe(1500 + 499);
    expect(february.incomeByCategory.get("salary")).toBe(250000);
  });

  it("leaves out pending rows and anything outside the period", () => {
    expect(periodFlows(history, "2026-03-01", "2026-03-31").spendingMinor).toBe(
      0,
    );
    expect(periodFlows([], "2026-03-01", "2026-03-31").savingsRate).toBeNull();
  });
});
