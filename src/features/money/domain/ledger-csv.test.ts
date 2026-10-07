import { describe, expect, it } from "vitest";
import type { Transaction } from "./ledger";
import type { Category } from "./model";
import { csvCell, ledgerCsv } from "./ledger-csv";

describe("ledger CSV", () => {
  it("writes one row per posting, in each account's own currency, exactly", () => {
    const accounts = new Map([
      ["chq", { name: "Chequing", currency: "CAD" }],
      ["jpy", { name: "Yen, travel", currency: "JPY" }],
    ]);
    const categories = new Map([
      ["food", { id: "food", name: "Food" } as Category],
    ]);
    const transfer = {
      id: "t1",
      date: "2026-09-01",
      kind: "transfer",
      status: "cleared",
      description: 'Move "spare" cash',
      payee: null,
      notes: null,
      postings: [
        {
          accountId: "chq",
          categoryId: null,
          amountMinor: -10005,
          fxRate: null,
          baseAmountMinor: null,
        },
        {
          accountId: "jpy",
          categoryId: "food",
          amountMinor: 11000,
          fxRate: null,
          baseAmountMinor: null,
        },
      ],
    } as unknown as Transaction;

    const lines = ledgerCsv([transfer], accounts, categories).split("\r\n");
    expect(lines[0]).toBe(
      "date,description,payee,kind,status,account,category,amount,currency,memo,notes,transaction_id",
    );
    expect(lines[1]).toBe(
      '2026-09-01,"Move ""spare"" cash",,transfer,cleared,Chequing,Uncategorised,-100.05,CAD,,,t1',
    );
    expect(lines[2]).toBe(
      '2026-09-01,"Move ""spare"" cash",,transfer,cleared,"Yen, travel",Food,11000,JPY,,,t1',
    );
    expect(lines[3]).toBe("");
  });

  it("defuses text a spreadsheet would run as a formula, but not negative amounts", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-12.34", false)).toBe("-12.34");
  });
});
