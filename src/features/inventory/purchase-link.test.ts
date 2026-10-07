import { describe, expect, it } from "vitest";
import type { Transaction } from "@/features/money/domain/ledger";
import { purchaseOptions } from "./purchase-link";

const txn = (
  id: string,
  date: string,
  kind: string,
  postings: [string, number][],
  payee: string | null = null,
) =>
  ({
    id,
    date,
    kind,
    description: id,
    payee,
    postings: postings.map(([accountId, amountMinor]) => ({
      accountId,
      amountMinor,
      categoryId: null,
      fxRate: null,
      baseAmountMinor: null,
    })),
  }) as unknown as Transaction;

const accounts = new Map([
  ["visa", { currency: "CAD" }],
  ["yen", { currency: "JPY" }],
]);

describe("linking an item to the purchase", () => {
  it("offers expenses only, newest first, priced by what left the account", () => {
    const options = purchaseOptions(
      [
        txn("laptop", "2026-03-02", "expense", [["visa", -129999]], "Best Buy"),
        txn("salary", "2026-03-15", "income", [["visa", 500000]]),
        txn("move", "2026-03-20", "transfer", [
          ["visa", -1000],
          ["yen", 1000],
        ]),
        txn("camera", "2026-04-01", "expense", [["yen", -80000]]),
      ],
      accounts,
    );
    expect(options).toEqual([
      {
        id: "camera",
        date: "2026-04-01",
        description: "camera",
        amount: 80000,
        currency: "JPY",
      },
      {
        id: "laptop",
        date: "2026-03-02",
        description: "laptop — Best Buy",
        amount: 1299.99,
        currency: "CAD",
      },
    ]);
  });

  it("skips expenses whose account is unknown (archived or not loaded)", () => {
    expect(
      purchaseOptions(
        [txn("x", "2026-01-01", "expense", [["gone", -500]])],
        accounts,
      ),
    ).toEqual([]);
  });
});
