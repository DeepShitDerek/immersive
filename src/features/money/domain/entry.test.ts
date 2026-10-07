import { describe, expect, it } from "vitest";
import {
  buildDraft,
  emptyEntry,
  type EntryForm,
  formFromTransaction,
  suggestReceived,
} from "./entry";
import { buildRateTable } from "./fx";
import type { Transaction } from "./ledger";

const accounts = new Map([
  ["chq", { id: "chq", currency: "CAD", openingDate: "2026-01-01" }],
  ["visa", { id: "visa", currency: "CAD", openingDate: "2026-01-01" }],
  ["nro", { id: "nro", currency: "INR", openingDate: "2026-01-01" }],
]);
const rates = buildRateTable([
  { base: "CAD", quote: "INR", asOf: "2026-02-01", rate: 61 },
]);
const form = (overrides: Partial<EntryForm>): EntryForm => ({
  ...emptyEntry("2026-02-10", "chq"),
  ...overrides,
});
const build = (f: EntryForm) => buildDraft(f, accounts, "CAD", rates);

describe("buildDraft", () => {
  it("makes a typed expense negative and prices it", () => {
    const { draft, problems } = build(
      form({
        description: "Groceries",
        lines: [{ categoryId: "food", amount: "45.20", memo: "" }],
      }),
    );
    expect(problems).toEqual([]);
    expect(draft?.postings).toEqual([
      {
        accountId: "chq",
        categoryId: "food",
        amountMinor: -4520,
        memo: null,
        fxRate: 1,
        baseAmountMinor: -4520,
      },
    ]);
  });

  it("keeps income and refunds positive", () => {
    expect(
      build(
        form({
          kind: "income",
          description: "Pay",
          lines: [{ categoryId: null, amount: "2500", memo: "" }],
        }),
      ).draft?.postings[0].amountMinor,
    ).toBe(250000);
    expect(
      build(
        form({
          kind: "refund",
          description: "Return",
          lines: [{ categoryId: null, amount: "20", memo: "" }],
        }),
      ).draft?.postings[0].amountMinor,
    ).toBe(2000);
  });

  it("splits one purchase over several categories", () => {
    const { draft } = build(
      form({
        description: "Costco",
        lines: [
          { categoryId: "food", amount: "80", memo: "" },
          { categoryId: "home", amount: "15.50", memo: "bulbs" },
          { categoryId: null, amount: "", memo: "" },
        ],
      }),
    );
    expect(
      draft?.postings.map((p) => [p.categoryId, p.amountMinor, p.memo]),
    ).toEqual([
      ["food", -8000, null],
      ["home", -1550, "bulbs"],
    ]);
  });

  it("uses the payee as the description when none is given", () => {
    expect(
      build(
        form({
          payee: "Loblaws",
          lines: [{ categoryId: null, amount: "5", memo: "" }],
        }),
      ).draft?.description,
    ).toBe("Loblaws");
  });

  it.each([
    [
      { lines: [{ categoryId: null, amount: "", memo: "" }], description: "x" },
      /Enter an amount/,
    ],
    [
      {
        lines: [{ categoryId: null, amount: "-5", memo: "" }],
        description: "x",
      },
      /more than zero/,
    ],
    [
      {
        lines: [{ categoryId: null, amount: "abc", memo: "" }],
        description: "x",
      },
      /Not an amount/,
    ],
    [
      { lines: [{ categoryId: null, amount: "5", memo: "" }], description: "" },
      /Describe/,
    ],
    [
      {
        accountId: "",
        lines: [{ categoryId: null, amount: "5", memo: "" }],
        description: "x",
      },
      /Choose an account/,
    ],
    [
      {
        date: "2025-12-31",
        lines: [{ categoryId: null, amount: "5", memo: "" }],
        description: "x",
      },
      /before it was opened/,
    ],
    [
      {
        date: "31/12/2025",
        lines: [{ categoryId: null, amount: "5", memo: "" }],
        description: "x",
      },
      /Choose a date/,
    ],
  ])("refuses %o", (overrides, message) => {
    const result = build(form(overrides as Partial<EntryForm>));
    expect(result.draft).toBeNull();
    expect(result.problems.join(" ")).toMatch(message);
  });

  it("builds a same-currency transfer that balances", () => {
    const { draft } = build(
      form({
        kind: "transfer",
        description: "Pay card",
        fromAccountId: "chq",
        toAccountId: "visa",
        amountOut: "300",
      }),
    );
    expect(draft?.postings.map((p) => [p.accountId, p.amountMinor])).toEqual([
      ["chq", -30000],
      ["visa", 30000],
    ]);
  });

  it("builds a remittance with both real amounts, a fee and the market rate", () => {
    const { draft, problems } = build(
      form({
        kind: "transfer",
        description: "Send home",
        fromAccountId: "chq",
        toAccountId: "nro",
        amountOut: "1000",
        amountIn: "60000",
        fee: "4.99",
        feeCategoryId: "fees",
        provider: "Wise",
        marketRate: "61",
      }),
    );
    expect(problems).toEqual([]);
    expect(draft).toMatchObject({ provider: "Wise", marketRate: 61 });
    expect(
      draft?.postings.map((p) => [
        p.accountId,
        p.categoryId,
        p.amountMinor,
        p.baseAmountMinor,
      ]),
    ).toEqual([
      ["chq", null, -100000, -100000],
      ["nro", null, 6000000, 98361],
      ["chq", "fees", -499, -499],
    ]);
  });

  it.each([
    [{ toAccountId: "chq" }, /two different accounts/],
    [{ toAccountId: "" }, /where the money/],
    [{ toAccountId: "nro", amountIn: "" }, /amount received/],
    [{ fee: "2", feeCategoryId: null }, /category for the fee/],
    [{ marketRate: "-1" }, /market rate/],
  ])("refuses a transfer with %o", (overrides, message) => {
    const result = build(
      form({
        kind: "transfer",
        description: "t",
        fromAccountId: "chq",
        toAccountId: "visa",
        amountOut: "10",
        ...overrides,
      }),
    );
    expect(result.problems.join(" ")).toMatch(message);
  });

  it("stores a foreign posting unpriced when no rate exists for its date", () => {
    const { draft } = build(
      form({
        kind: "expense",
        description: "Chai",
        accountId: "nro",
        date: "2026-01-15",
        lines: [{ categoryId: null, amount: "50", memo: "" }],
      }),
    );
    expect(draft?.postings[0]).toMatchObject({
      fxRate: null,
      baseAmountMinor: null,
    });
  });
});

describe("formFromTransaction", () => {
  const base: Omit<Transaction, "kind" | "postings"> = {
    id: "t",
    date: "2026-02-20",
    status: "pending",
    description: "Send home",
    payee: null,
    notes: "for mum",
    provider: "Wise",
    marketRate: 61,
    scheduleId: null,
    occurrenceDate: null,
    importHash: null,
  };
  const p = (
    accountId: string,
    amountMinor: number,
    categoryId: string | null = null,
  ) => ({
    accountId,
    categoryId,
    amountMinor,
    fxRate: null,
    baseAmountMinor: null,
  });

  it("round-trips a remittance through the form", () => {
    const txn: Transaction = {
      ...base,
      kind: "transfer",
      postings: [p("chq", -100000), p("nro", 6000000), p("chq", -499, "fees")],
    };
    const f = formFromTransaction(txn, accounts)!;
    expect(f).toMatchObject({
      fromAccountId: "chq",
      toAccountId: "nro",
      amountOut: "1000.00",
      amountIn: "60000.00",
      fee: "4.99",
      feeCategoryId: "fees",
      marketRate: "61",
      pending: true,
      notes: "for mum",
    });
    const rebuilt = buildDraft(f, accounts, "CAD", rates).draft!;
    expect(rebuilt.postings.map((x) => x.amountMinor)).toEqual(
      txn.postings.map((x) => x.amountMinor),
    );
    expect(rebuilt.status).toBe("pending");
  });

  it("round-trips a split expense", () => {
    const txn: Transaction = {
      ...base,
      kind: "expense",
      provider: null,
      marketRate: null,
      postings: [p("visa", -8000, "food"), p("visa", -1550, "home")],
    };
    const rebuilt = buildDraft(
      formFromTransaction(txn, accounts)!,
      accounts,
      "CAD",
      rates,
    ).draft!;
    expect(rebuilt.postings.map((x) => [x.categoryId, x.amountMinor])).toEqual([
      ["food", -8000],
      ["home", -1550],
    ]);
  });

  it("declines shapes the form would mangle", () => {
    expect(
      formFromTransaction(
        { ...base, kind: "adjustment", postings: [p("chq", -1)] },
        accounts,
      ),
    ).toBeNull();
    expect(
      formFromTransaction(
        {
          ...base,
          kind: "transfer",
          postings: [p("chq", -2), p("visa", 1), p("nro", 1)],
        },
        accounts,
      ),
    ).toBeNull();
  });
});

describe("suggestReceived", () => {
  it("converts at the known rate", () => {
    expect(suggestReceived("1000", "CAD", "INR", "2026-02-10", rates)).toEqual({
      amount: "61000.00",
      rate: 61,
    });
  });
  it("offers nothing without a rate, amount or second currency", () => {
    expect(
      suggestReceived("1000", "CAD", "INR", "2026-01-10", rates),
    ).toBeNull();
    expect(suggestReceived("", "CAD", "INR", "2026-02-10", rates)).toBeNull();
    expect(suggestReceived("5", "CAD", "CAD", "2026-02-10", rates)).toBeNull();
  });
});
