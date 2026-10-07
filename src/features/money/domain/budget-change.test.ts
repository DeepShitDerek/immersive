import { describe, expect, it } from "vitest";
import { type Budget, budgetChange } from "./budget";

const budget = (
  id: string,
  fromMonth: string,
  amountMinor: number,
  rollover = false,
): Budget => ({ id, categoryId: "food", fromMonth, amountMinor, rollover });

describe("budgetChange", () => {
  it("saves a first budget from the month shown", () => {
    expect(budgetChange([], "food", "2026-10", 60000, false)).toEqual({
      kind: "save",
      budget: {
        categoryId: "food",
        fromMonth: "2026-10-01",
        amountMinor: 60000,
        rollover: false,
      },
    });
  });

  it("does nothing when the amount and rollover are what is in force", () => {
    const budgets = [budget("a", "2026-08-01", 60000, true)];
    expect(budgetChange(budgets, "food", "2026-10", 60000, true)).toEqual({
      kind: "none",
    });
  });

  it("does nothing when a category with no budget is left empty", () => {
    expect(budgetChange([], "food", "2026-10", 0, false)).toEqual({
      kind: "none",
    });
  });

  it("removes the row when the budget cleared was only ever set this month", () => {
    // Saving a zero here would leave a row that says nothing.
    const budgets = [budget("a", "2026-10-01", 60000)];
    expect(budgetChange(budgets, "food", "2026-10", 0, false)).toEqual({
      kind: "delete",
      id: "a",
    });
  });

  it("ends an earlier budget from this month, leaving the months before as they were", () => {
    const budgets = [budget("a", "2026-08-01", 60000)];
    expect(budgetChange(budgets, "food", "2026-10", 0, false)).toEqual({
      kind: "save",
      budget: {
        categoryId: "food",
        fromMonth: "2026-10-01",
        amountMinor: 0,
        rollover: false,
      },
    });
  });

  it("ends the budget, not just this month's change, when an earlier one would come back", () => {
    // Removing October's row would put August's 600 back in force.
    const budgets = [
      budget("a", "2026-08-01", 60000),
      budget("b", "2026-10-01", 80000),
    ];
    expect(budgetChange(budgets, "food", "2026-10", 0, false)).toEqual({
      kind: "save",
      budget: {
        categoryId: "food",
        fromMonth: "2026-10-01",
        amountMinor: 0,
        rollover: false,
      },
    });
  });

  it("ignores other categories' budgets", () => {
    const budgets = [
      { ...budget("x", "2026-08-01", 60000), categoryId: "rent" },
      budget("a", "2026-10-01", 60000),
    ];
    expect(budgetChange(budgets, "food", "2026-10", 0, false)).toEqual({
      kind: "delete",
      id: "a",
    });
  });
});
