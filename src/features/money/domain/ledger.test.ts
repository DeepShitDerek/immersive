import { describe, expect, it } from "vitest";
import { buildRateTable } from "./fx";
import {
  type Account,
  balances,
  creditUtilisation,
  everydayAccount,
  type Posting,
  register,
  type Transaction,
  validateAccount,
  validateTransaction,
  valuation,
} from "./ledger";

/**
 * The same fixtures and cases as db/test/20-money.sql, so the form-side
 * validation and the database agree on every rule.
 */

const account = (
  overrides: Partial<Account> & Pick<Account, "id">,
): Account => ({
  name: overrides.id,
  kind: "chequing",
  registration: "none",
  country: "CA",
  currency: "CAD",
  institutionId: null,
  openingBalanceMinor: 0,
  openingDate: "2026-01-01",
  creditLimitMinor: null,
  statementDay: null,
  paymentDueDay: null,
  interestRate: null,
  isLiquid: true,
  inNetWorth: true,
  archivedAt: null,
  ...overrides,
});

const chequing = account({ id: "chq", openingBalanceMinor: 100000 });
const visa = account({
  id: "visa",
  kind: "credit_card",
  creditLimitMinor: 500000,
});
const nro = account({
  id: "nro",
  kind: "savings",
  registration: "nro",
  country: "IN",
  currency: "INR",
});
const tfsa = account({ id: "tfsa", kind: "savings", registration: "tfsa" });
const future = account({
  id: "future",
  kind: "savings",
  openingBalanceMinor: 5000,
});
const accounts = [chequing, visa, nro, tfsa, future];
const byId = new Map(accounts.map((a) => [a.id, a]));

const post = (
  accountId: string,
  amountMinor: number,
  categoryId: string | null = null,
): Posting => ({
  accountId,
  categoryId,
  amountMinor,
  fxRate: null,
  baseAmountMinor: null,
});

let seq = 0;
const txn = (
  date: string,
  kind: Transaction["kind"],
  postings: Posting[],
  extra: Partial<Transaction> = {},
): Transaction => ({
  id: `t${(seq += 1)}`,
  date,
  kind,
  status: "cleared",
  description: extra.description ?? kind,
  payee: null,
  notes: null,
  provider: null,
  marketRate: null,
  scheduleId: null,
  occurrenceDate: null,
  importHash: null,
  postings,
  ...extra,
});

const problems = (t: Transaction) => validateTransaction(t, byId);

describe("validateAccount mirrors the account CHECKs", () => {
  const base = {
    name: "X",
    kind: "savings" as const,
    currency: "CAD",
    country: "CA",
    creditLimitMinor: null,
    statementDay: null,
    paymentDueDay: null,
  };
  it.each([
    [
      {
        ...base,
        registration: "tfsa" as const,
        country: "IN",
        currency: "INR",
      },
      /Canadian/,
    ],
    [{ ...base, registration: "nre" as const }, /Indian/],
    [
      {
        ...base,
        kind: "chequing" as const,
        registration: "none" as const,
        creditLimitMinor: 1000,
      },
      /Only cards/,
    ],
    [
      { ...base, kind: "credit_card" as const, registration: "tfsa" as const },
      /can be registered/,
    ],
    [{ ...base, registration: "none" as const, name: "  " }, /name/],
    [
      {
        ...base,
        kind: "credit_card" as const,
        registration: "none" as const,
        statementDay: 32,
      },
      /1–31/,
    ],
  ])("refuses %o", (input, message) => {
    expect(validateAccount(input).join(" ")).toMatch(message);
  });

  it("accepts a TFSA in Canada and an NRO in India", () => {
    expect(validateAccount({ ...base, registration: "tfsa" })).toEqual([]);
    expect(
      validateAccount({
        ...base,
        registration: "nro",
        country: "IN",
        currency: "INR",
      }),
    ).toEqual([]);
  });
});

describe("validateTransaction mirrors money_check_transaction", () => {
  it.each([
    [
      "an expense taking money in",
      txn("2026-02-03", "expense", [post("chq", 4500)]),
      /take money out/,
    ],
    [
      "an expense over two accounts",
      txn("2026-02-03", "expense", [post("chq", -100), post("visa", -100)]),
      /one account/,
    ],
    [
      "negative income",
      txn("2026-02-03", "income", [post("chq", -100)]),
      /bring money in/,
    ],
    [
      "a negative refund",
      txn("2026-02-03", "refund", [post("chq", -100)]),
      /bring money in/,
    ],
    [
      "a date before the account opened",
      txn("2025-12-31", "expense", [post("chq", -100)]),
      /before it was opened/,
    ],
    ["no postings", txn("2026-02-03", "expense", []), /at least one/],
    [
      "a two-line adjustment",
      txn("2026-02-03", "adjustment", [post("chq", -1), post("chq", -1)]),
      /single amount/,
    ],
    [
      "a zero line",
      txn("2026-02-03", "expense", [post("chq", 0)]),
      /other than zero/,
    ],
    [
      "an unknown account",
      txn("2026-02-03", "expense", [post("nope", -1)]),
      /Choose an account/,
    ],
    [
      "an unbalanced transfer",
      txn("2026-02-16", "transfer", [post("chq", -7500), post("tfsa", 7400)]),
      /balance/,
    ],
    [
      "a transfer to itself",
      txn("2026-02-16", "transfer", [post("chq", -100), post("chq", 100)]),
      /two different accounts/,
    ],
    [
      "a one-way transfer",
      txn("2026-02-16", "transfer", [post("chq", -100), post("tfsa", -100)]),
      /leaving one account and arriving/,
    ],
    [
      "a fee that arrives",
      txn("2026-02-16", "transfer", [
        post("chq", -100),
        post("tfsa", 100),
        post("tfsa", 5, "fees"),
      ]),
      /fee takes money out/,
    ],
    [
      "a market rate on an expense",
      txn("2026-02-16", "expense", [post("chq", -100)], { marketRate: 61 }),
      /market rate/,
    ],
    [
      "a blank description",
      txn("2026-02-16", "expense", [post("chq", -100)], { description: " " }),
      /Describe/,
    ],
    [
      "a half-priced line",
      txn("2026-02-16", "expense", [{ ...post("nro", -100), fxRate: 0.016 }]),
      /go together/,
    ],
  ])("refuses %s", (_label, t, message) => {
    expect(problems(t).join(" ")).toMatch(message);
  });

  it.each([
    [
      "an expense",
      txn("2026-02-03", "expense", [post("chq", -4500, "groceries")]),
    ],
    [
      "a split expense",
      txn("2026-02-04", "expense", [
        post("visa", -8000, "groceries"),
        post("visa", -1500, "fees"),
      ]),
    ],
    [
      "a refund",
      txn("2026-02-06", "refund", [post("visa", 2000, "groceries")]),
    ],
    ["income", txn("2026-02-15", "income", [post("chq", 250000, "salary")])],
    [
      "a card payment",
      txn("2026-02-16", "transfer", [post("chq", -7500), post("visa", 7500)]),
    ],
    [
      "a remittance with a fee",
      txn(
        "2026-02-20",
        "transfer",
        [post("chq", -100000), post("nro", 6000000), post("chq", -499, "fees")],
        { marketRate: 61 },
      ),
    ],
    ["an adjustment", txn("2026-02-21", "adjustment", [post("chq", -1)])],
  ])("accepts %s", (_label, t) => {
    expect(problems(t)).toEqual([]);
  });
});

describe("balances", () => {
  const history = [
    txn("2026-02-03", "expense", [post("chq", -4500, "groceries")]),
    txn("2026-02-04", "expense", [
      post("visa", -8000, "groceries"),
      post("visa", -1500, "fees"),
    ]),
    txn("2026-02-06", "refund", [post("visa", 2000, "groceries")]),
    txn("2026-02-15", "income", [post("chq", 250000, "salary")]),
    txn("2026-02-17", "transfer", [post("chq", -8000), post("visa", 8000)]),
    txn("2026-02-20", "transfer", [
      post("chq", -100000),
      post("nro", 6000000),
      post("chq", -499, "fees"),
    ]),
    txn("2026-03-01", "expense", [post("chq", -500)], { status: "pending" }),
  ];

  it("matches money_balances() for the same history", () => {
    const at = balances(accounts, history, "2026-12-31");
    expect(at.get("chq")).toMatchObject({
      balanceMinor: 236501,
      clearedMinor: 237001,
    });
    expect(at.get("visa")?.balanceMinor).toBe(500);
    expect(at.get("nro")).toMatchObject({
      balanceMinor: 6000000,
      currency: "INR",
    });
    expect(at.get("future")?.balanceMinor).toBe(5000);
    expect(
      balances(accounts, history, "2026-02-10").get("chq")?.balanceMinor,
    ).toBe(95500);
  });

  it("keeps a running register, same-day order preserved", () => {
    const lines = register(chequing, history);
    expect(lines.map((l) => l.balanceMinor)).toEqual([
      95500, 345500, 337500, 237001, 236501,
    ]);
    expect(lines[3].changeMinor).toBe(-100499);
  });

  it("never loses a unit over a long random history", () => {
    const random: Transaction[] = [];
    let expected = chequing.openingBalanceMinor;
    for (let i = 0; i < 3000; i += 1) {
      const amount = Math.floor((Math.random() - 0.5) * 1e6) || 1;
      expected += amount;
      random.push(
        txn("2026-05-01", amount < 0 ? "expense" : "income", [
          post("chq", amount),
        ]),
      );
    }
    expect(
      balances([chequing], random, "2026-12-31").get("chq")?.balanceMinor,
    ).toBe(expected);
    expect(register(chequing, random).at(-1)?.balanceMinor).toBe(expected);
  });
});

describe("valuation", () => {
  const rates = buildRateTable([
    { base: "CAD", quote: "INR", asOf: "2026-02-01", rate: 60 },
  ]);
  const at = new Map([
    ["chq", { balanceMinor: 237001, clearedMinor: 237001, currency: "CAD" }],
    ["visa", { balanceMinor: -42000, clearedMinor: -42000, currency: "CAD" }],
    ["nro", { balanceMinor: 6000000, clearedMinor: 6000000, currency: "INR" }],
    ["jp", { balanceMinor: 1000, clearedMinor: 1000, currency: "JPY" }],
  ]);
  const withYen = [
    ...accounts,
    account({ id: "jp", currency: "JPY", country: "JP" }),
  ];

  it("adds assets and liabilities in the base currency, by country", () => {
    const v = valuation(withYen, at, "CAD", "2026-03-01", rates);
    expect(v.assets.minor).toBe(237001 + 100000);
    expect(v.liabilities.minor).toBe(-42000);
    expect(v.total.minor).toBe(237001 + 100000 - 42000);
    expect(v.byCountry.get("IN")?.minor).toBe(100000);
    expect(v.byCountry.get("CA")?.minor).toBe(237001 - 42000);
  });

  it("names what it could not price instead of dropping it", () => {
    const v = valuation(withYen, at, "CAD", "2026-03-01", rates);
    expect(v.unpriced).toEqual([{ minor: 1000, currency: "JPY" }]);
  });

  it("leaves out accounts excluded from net worth", () => {
    const excluded = withYen.map((a) =>
      a.id === "chq" ? { ...a, inNetWorth: false } : a,
    );
    expect(
      valuation(excluded, at, "CAD", "2026-03-01", rates).assets.minor,
    ).toBe(100000);
  });
});

describe("everydayAccount", () => {
  it("prefers chequing in the main currency over whatever sorts first", () => {
    const list = [nro, tfsa, visa, chequing];
    expect(everydayAccount(list, "CAD")?.id).toBe("chq");
    expect(everydayAccount([nro, visa, tfsa], "CAD")?.id).toBe("visa");
    expect(everydayAccount([nro], "CAD")?.id).toBe("nro");
    expect(
      everydayAccount([{ ...chequing, archivedAt: "2026-01-01" }, tfsa], "CAD")
        ?.id,
    ).toBe("tfsa");
    expect(everydayAccount([], "CAD")).toBeUndefined();
  });
});

describe("credit utilisation", () => {
  it("measures what is owed against the limit", () => {
    const at = new Map([
      ["visa", { balanceMinor: -150000, clearedMinor: 0, currency: "CAD" }],
    ]);
    const result = creditUtilisation(accounts, at);
    expect(result.cards).toEqual([
      { accountId: "visa", usedMinor: 150000, limitMinor: 500000, ratio: 0.3 },
    ]);
    expect(result.overallRatio).toBe(0.3);
  });

  it("treats a card in credit as unused, and skips cards without a limit", () => {
    const noLimit = account({ id: "amex", kind: "credit_card" });
    const at = new Map([
      ["visa", { balanceMinor: 500, clearedMinor: 500, currency: "CAD" }],
    ]);
    const result = creditUtilisation([...accounts, noLimit], at);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].usedMinor).toBe(0);
  });

  it("gives no overall ratio across currencies", () => {
    const usd = account({
      id: "usd",
      kind: "credit_card",
      currency: "USD",
      creditLimitMinor: 100000,
    });
    expect(creditUtilisation([visa, usd], new Map()).overallRatio).toBeNull();
  });
});
