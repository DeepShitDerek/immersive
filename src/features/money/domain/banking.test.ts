import { describe, expect, it } from "vitest";
import {
  categoryLabel,
  categoryOptions,
  rootOf,
  STARTER_CATEGORIES,
} from "./categories";
import { detectDelimiter, parseCsv } from "./csv";
import type { Category, Rule } from "./model";
import { applyRules, isValidPattern, ruleMatches } from "./rules";
import {
  detectDateOrder,
  guessMapping,
  parseStatementDate,
  readStatement,
  stableHash,
} from "./statement-import";

describe("parseCsv", () => {
  it("handles quotes, doubled quotes, quoted newlines, BOM and CRLF", () => {
    const text =
      '﻿Date,Description,Amount\r\n2026-02-05,"Tim Hortons, Queen St",-2.50\r\n2026-02-06,"He said ""hi""\nthen left",10\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ["Date", "Description", "Amount"],
      ["2026-02-05", "Tim Hortons, Queen St", "-2.50"],
      ["2026-02-06", 'He said "hi"\nthen left', "10"],
    ]);
  });

  it("detects semicolons and tabs", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
    expect(parseCsv("a;b\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps an empty trailing field", () => {
    expect(parseCsv("a,b,\n1,,3")).toEqual([
      ["a", "b", ""],
      ["1", "", "3"],
    ]);
  });
});

const rule = (overrides: Partial<Rule>): Rule => ({
  id: overrides.id ?? "r",
  priority: 100,
  match: "contains",
  pattern: "x",
  accountId: null,
  categoryId: "c",
  payee: null,
  isActive: true,
  ...overrides,
});

describe("rules", () => {
  it("matches case-insensitively, ignoring odd whitespace", () => {
    expect(
      ruleMatches(rule({ pattern: "tim hortons" }), "TIM  HORTONS #123"),
    ).toBe(true);
    expect(
      ruleMatches(
        rule({ match: "starts_with", pattern: "presto" }),
        "PRESTO AUTOLOAD",
      ),
    ).toBe(true);
    expect(
      ruleMatches(rule({ match: "equals", pattern: "netflix" }), "NETFLIX.COM"),
    ).toBe(false);
    expect(
      ruleMatches(
        rule({ match: "regex", pattern: "^amzn|amazon" }),
        "AMZN Mktp CA",
      ),
    ).toBe(true);
  });

  it("treats a pattern JavaScript cannot compile as no match", () => {
    expect(
      ruleMatches(rule({ match: "regex", pattern: "(?<=x" }), "anything"),
    ).toBe(false);
    expect(isValidPattern({ match: "regex", pattern: "(unclosed" })).toBe(
      false,
    );
    expect(isValidPattern({ match: "contains", pattern: "  " })).toBe(false);
  });

  it("picks the highest priority, respects account scope and skips inactive rules", () => {
    const rules = [
      rule({
        id: "general",
        pattern: "amazon",
        categoryId: "shopping",
        priority: 100,
      }),
      rule({
        id: "prime",
        pattern: "amazon prime",
        categoryId: "subs",
        priority: 200,
      }),
      rule({
        id: "off",
        pattern: "amazon",
        categoryId: "never",
        priority: 999,
        isActive: false,
      }),
      rule({
        id: "card-only",
        pattern: "amazon",
        categoryId: "card",
        priority: 500,
        accountId: "visa",
      }),
    ];
    expect(
      applyRules(rules, { description: "AMAZON PRIME*1234", accountId: "chq" })
        ?.ruleId,
    ).toBe("prime");
    expect(
      applyRules(rules, { description: "AMAZON.CA", accountId: "chq" })?.ruleId,
    ).toBe("general");
    expect(
      applyRules(rules, { description: "AMAZON.CA", accountId: "visa" })
        ?.ruleId,
    ).toBe("card-only");
    expect(
      applyRules(rules, { description: "LOBLAWS", accountId: "chq" }),
    ).toBeNull();
  });

  it("matches payee and description separately", () => {
    const rules = [
      rule({ match: "equals", pattern: "netflix", categoryId: "subs" }),
    ];
    expect(
      applyRules(rules, {
        description: "NETFLIX.COM 866",
        payee: "Netflix",
        accountId: "chq",
      })?.categoryId,
    ).toBe("subs");
  });
});

describe("categories", () => {
  const cats: Category[] = [
    {
      id: "h",
      parentId: null,
      name: "Housing",
      bucket: "need",
      isEssential: true,
      icon: null,
      color: null,
      sortOrder: 1,
      archivedAt: null,
    },
    {
      id: "r",
      parentId: "h",
      name: "Rent",
      bucket: "need",
      isEssential: true,
      icon: null,
      color: null,
      sortOrder: 0,
      archivedAt: null,
    },
    {
      id: "f",
      parentId: null,
      name: "Food",
      bucket: "want",
      isEssential: false,
      icon: null,
      color: null,
      sortOrder: 0,
      archivedAt: null,
    },
    {
      id: "x",
      parentId: "f",
      name: "Old",
      bucket: "want",
      isEssential: false,
      icon: null,
      color: null,
      sortOrder: 0,
      archivedAt: "2026-01-01",
    },
  ];
  const byId = new Map(cats.map((c) => [c.id, c]));

  it("lists parents in order with their children, archived hidden", () => {
    expect(categoryOptions(cats).map((o) => o.label)).toEqual([
      "Food",
      "Housing",
      "Housing › Rent",
    ]);
    expect(categoryOptions(cats, { includeArchived: true })).toHaveLength(4);
  });

  it("labels and rolls up", () => {
    expect(categoryLabel("r", byId)).toBe("Housing › Rent");
    expect(categoryLabel(null, byId)).toBe("Uncategorised");
    expect(rootOf("r", byId)).toBe("h");
    expect(rootOf("h", byId)).toBe("h");
  });

  it("ships a starter set that fits the schema", () => {
    const names = STARTER_CATEGORIES.map((c) => c.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const seed of STARTER_CATEGORIES) {
      expect(seed.name.length).toBeLessThanOrEqual(80);
      const kids = (seed.children ?? []).map((c) => c.toLowerCase());
      expect(new Set(kids).size).toBe(kids.length);
    }
    expect(STARTER_CATEGORIES.some((c) => c.bucket === "income")).toBe(true);
  });
});

describe("statement dates", () => {
  it.each([
    ["2026-02-05", "mdy", "2026-02-05"],
    ["02/05/2026", "mdy", "2026-02-05"],
    ["05/02/2026", "dmy", "2026-02-05"],
    ["05/02/26", "dmy", "2026-02-05"],
    ["5 Feb 2026", "mdy", "2026-02-05"],
    ["05-Feb-2026", "dmy", "2026-02-05"],
    ["Feb 5, 2026", "dmy", "2026-02-05"],
    ["20260205", "dmy", "2026-02-05"],
    ["2026-02-05 14:03:00", "dmy", "2026-02-05"],
    ["31/02/2026", "dmy", null],
    ["13/13/2026", "mdy", null],
    ["hello", "dmy", null],
  ] as const)("%s (%s) → %s", (raw, order, expected) => {
    expect(parseStatementDate(raw, order)).toBe(expected);
  });

  it("finds the one order that fits every row", () => {
    expect(detectDateOrder(["01/02/2026", "25/02/2026"], "CA")).toEqual({
      order: "dmy",
      ambiguous: false,
    });
    expect(detectDateOrder(["01/02/2026", "02/25/2026"], "IN")).toEqual({
      order: "mdy",
      ambiguous: false,
    });
  });

  it("breaks a real tie by the account's country, and says so", () => {
    expect(detectDateOrder(["01/02/2026", "03/04/2026"], "CA")).toEqual({
      order: "mdy",
      ambiguous: true,
    });
    expect(detectDateOrder(["01/02/2026", "03/04/2026"], "IN")).toEqual({
      order: "dmy",
      ambiguous: true,
    });
    expect(detectDateOrder(["2026-01-02"], "IN")).toEqual({
      order: "ymd",
      ambiguous: false,
    });
  });
});

describe("guessing the mapping", () => {
  it("reads an RBC-style export: two description columns, CAD$ amount", () => {
    const rows = parseCsv(
      [
        '"Account Type","Account Number","Transaction Date","Cheque Number","Description 1","Description 2","CAD$","USD$"',
        'Chequing,00000-1234567,2/5/2026,,"TIM HORTONS #1234","TORONTO ON",-2.50,',
        'Chequing,00000-1234567,2/15/2026,,"PAYROLL","ACME CORP",2500.00,',
      ].join("\n"),
    );
    const mapping = guessMapping(rows, "CA")!;
    expect(mapping).toMatchObject({
      hasHeader: true,
      date: 2,
      description: 4,
      descriptionExtra: 5,
      amount: 6,
      dateOrder: "mdy",
    });
    const { rows: read, problems } = readStatement(rows, mapping, {
      accountId: "chq",
      currency: "CAD",
    });
    expect(problems).toEqual([]);
    expect(
      read.map((r) => [r.date, r.description, r.amountMinor, r.kind]),
    ).toEqual([
      ["2026-02-05", "TIM HORTONS #1234 TORONTO ON", -250, "expense"],
      ["2026-02-15", "PAYROLL ACME CORP", 250000, "income"],
    ]);
  });

  it("reads a TD-style export: no header, debit and credit columns, a balance", () => {
    const rows = parseCsv(
      [
        "02/05/2026,TIM HORTONS,2.50,,997.50",
        "02/15/2026,PAYROLL,,2500.00,3497.50",
        "02/16/2026,RENT,1400.00,,2097.50",
      ].join("\n"),
    );
    const mapping = guessMapping(rows, "CA")!;
    expect(mapping).toMatchObject({
      hasHeader: false,
      date: 0,
      description: 1,
      debit: 2,
      credit: 3,
    });
    expect(
      readStatement(rows, mapping, {
        accountId: "chq",
        currency: "CAD",
      }).rows.map((r) => r.amountMinor),
    ).toEqual([-250, 250000, -140000]);
  });

  it("reads an HDFC-style export: DD/MM/YY, withdrawal and deposit, value date ignored", () => {
    const rows = parseCsv(
      [
        "Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance",
        "05/02/26,UPI-SWIGGY-12345,0000123,05/02/26,450.00,,10550.00",
        "25/02/26,NEFT-WISE PAYMENTS,0000456,25/02/26,,60000.00,70550.00",
      ].join("\n"),
    );
    const mapping = guessMapping(rows, "IN")!;
    expect(mapping).toMatchObject({
      hasHeader: true,
      date: 0,
      description: 1,
      debit: 4,
      credit: 5,
      dateOrder: "dmy",
    });
    const read = readStatement(rows, mapping, {
      accountId: "nro",
      currency: "INR",
    }).rows;
    expect(read.map((r) => [r.date, r.amountMinor])).toEqual([
      ["2026-02-05", -45000],
      ["2026-02-25", 6000000],
    ]);
  });

  it("reads an SBI-style export with month names", () => {
    const rows = parseCsv(
      [
        "Txn Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance",
        '5 Feb 2026,5 Feb 2026,ATM WDL,123,"2,000.00", ,"8,000.00"',
      ].join("\n"),
    );
    const mapping = guessMapping(rows, "IN")!;
    expect(mapping.date).toBe(0);
    expect(
      readStatement(rows, mapping, { accountId: "sbi", currency: "INR" })
        .rows[0],
    ).toMatchObject({
      date: "2026-02-05",
      amountMinor: -200000,
    });
  });

  it("reads RBC's USD$ column for a US-dollar account", () => {
    const rows = parseCsv(
      [
        "Account Type,Account Number,Transaction Date,Cheque Number,Description 1,Description 2,CAD$,USD$",
        "Chequing,01234-5678901,9/2/2026,,AMAZON.COM,,,-20.00",
      ].join("\n"),
    );
    const mapping = guessMapping(rows, "CA", { currency: "USD" })!;
    expect(mapping.amount).toBe(7);
    expect(
      readStatement(rows, mapping, { accountId: "usd", currency: "USD" })
        .rows[0].amountMinor,
    ).toBe(-2000);
  });

  it("reads a CIBC export: no header; date, description, money out, money in", () => {
    const rows = parseCsv(
      [
        '2026-09-02,"STARBUCKS #123 TORONTO, ON",4.50,',
        "2026-09-03,PAYROLL ACME CORP,,2500.00",
        "2026-09-05,E-TRANSFER,100.00,",
      ].join("\n"),
    );
    const mapping = guessMapping(rows, "CA")!;
    expect(mapping).toMatchObject({
      hasHeader: false,
      date: 0,
      description: 1,
      debit: 2,
      credit: 3,
      amount: null,
    });
    expect(
      readStatement(rows, mapping, {
        accountId: "chq",
        currency: "CAD",
      }).rows.map((r) => [r.description, r.amountMinor]),
    ).toEqual([
      ["STARBUCKS #123 TORONTO, ON", -450],
      ["PAYROLL ACME CORP", 250000],
      ["E-TRANSFER", -10000],
    ]);
  });

  it("reads a CIBC export with only money out, or only money in, as the right direction", () => {
    const out = parseCsv(
      ["2026-09-02,STARBUCKS,4.50,", "2026-09-05,RENT,1400.00,"].join("\n"),
    );
    expect(
      readStatement(out, guessMapping(out, "CA")!, {
        accountId: "chq",
        currency: "CAD",
      }).rows.map((r) => r.amountMinor),
    ).toEqual([-450, -140000]);
    const inn = parseCsv(["2026-09-03,PAYROLL,,2500.00"].join("\n"));
    expect(
      readStatement(inn, guessMapping(inn, "CA")!, {
        accountId: "chq",
        currency: "CAD",
      }).rows.map((r) => r.amountMinor),
    ).toEqual([250000]);
  });

  it("does not flip a card export that already says which way the money went", () => {
    const cibc = parseCsv(
      [
        "2026-09-02,STARBUCKS,4.50,,4500********1234",
        "2026-09-10,PAYMENT THANK YOU,,200.00,4500********1234",
      ].join("\n"),
    );
    const cibcMap = guessMapping(cibc, "CA", { card: true })!;
    expect(cibcMap.invertSign).toBe(false);
    expect(
      readStatement(cibc, cibcMap, {
        accountId: "visa",
        currency: "CAD",
      }).rows.map((r) => r.amountMinor),
    ).toEqual([-450, 20000]);

    const rbc = parseCsv(
      [
        "Account Type,Account Number,Transaction Date,Cheque Number,Description 1,Description 2,CAD$,USD$",
        "Visa,4510123412341234,9/3/2026,,AMAZON,,-20.00,",
        "Visa,4510123412341234,9/4/2026,,COFFEE,,-4.50,",
        "Visa,4510123412341234,9/20/2026,,PAYMENT - THANK YOU,,100.00,",
      ].join("\n"),
    );
    expect(guessMapping(rbc, "CA", { card: true })!.invertSign).toBe(false);

    const positive = parseCsv(
      [
        "Date,Description,Amount",
        "2026-02-05,COFFEE,4.50",
        "2026-02-06,BOOKS,30.00",
        "2026-02-20,PAYMENT,-100.00",
      ].join("\n"),
    );
    expect(guessMapping(positive, "CA", { card: true })!.invertSign).toBe(true);
  });

  it("uses a Dr/Cr column for direction", () => {
    const rows = parseCsv(
      [
        "Date,Description,Amount,Dr/Cr",
        "2026-02-05,Groceries,450.00,DR",
        "2026-02-06,Refund,50.00,CR",
      ].join("\n"),
    );
    const mapping = guessMapping(rows, "IN")!;
    expect(mapping.direction).toBe(3);
    expect(
      readStatement(rows, mapping, {
        accountId: "a",
        currency: "INR",
      }).rows.map((r) => r.amountMinor),
    ).toEqual([-45000, 5000]);
  });

  it("flips a card export where purchases are positive", () => {
    const rows = parseCsv(
      [
        "Date,Description,Amount",
        "2026-02-05,COFFEE,4.50",
        "2026-02-20,PAYMENT THANK YOU,-100.00",
      ].join("\n"),
    );
    const mapping = { ...guessMapping(rows, "CA")!, invertSign: true };
    expect(
      readStatement(rows, mapping, {
        accountId: "visa",
        currency: "CAD",
      }).rows.map((r) => r.amountMinor),
    ).toEqual([-450, 10000]);
  });
});

describe("reading a statement", () => {
  const rows = parseCsv(
    [
      "Date,Description,Amount",
      "2026-02-05,COFFEE,-4.50",
      "2026-02-05,COFFEE,-4.50",
      "not a date,X,1",
      "2026-02-06,ZERO,0",
      "2026-02-07,BAD AMOUNT,abc",
      "2026-02-08,,1.00",
      "2026-02-09,NETFLIX.COM,-16.99",
    ].join("\n"),
  );
  const mapping = guessMapping(rows, "CA")!;
  const rules: Rule[] = [
    rule({ pattern: "netflix", categoryId: "subs", payee: "Netflix" }),
  ];
  const result = readStatement(rows, mapping, {
    accountId: "chq",
    currency: "CAD",
    rules,
  });

  it("reports every unreadable row by line, and imports the rest", () => {
    expect(result.problems.map((p) => p.line)).toEqual([4, 5, 6, 7]);
    expect(result.rows).toHaveLength(3);
  });

  it("gives two identical rows different, stable hashes", () => {
    const [a, b] = result.rows;
    expect(a.importHash).not.toBe(b.importHash);
    const again = readStatement(rows, mapping, {
      accountId: "chq",
      currency: "CAD",
    });
    expect(again.rows.map((r) => r.importHash)).toEqual(
      result.rows.map((r) => r.importHash),
    );
  });

  it("recognises the overlap when a later export repeats a day", () => {
    const later = parseCsv(
      [
        "Date,Description,Amount",
        "2026-02-05,COFFEE,-4.50",
        "2026-02-10,NEW,-1.00",
      ].join("\n"),
    );
    const next = readStatement(later, guessMapping(later, "CA")!, {
      accountId: "chq",
      currency: "CAD",
    });
    expect(next.rows[0].importHash).toBe(result.rows[0].importHash);
  });

  it("applies rules to category and payee", () => {
    expect(result.rows[2]).toMatchObject({
      categoryId: "subs",
      payee: "Netflix",
      kind: "expense",
    });
  });

  it("hashes deterministically", () => {
    expect(stableHash("abc")).toBe(stableHash("abc"));
    expect(stableHash("abc")).not.toBe(stableHash("abd"));
    expect(stableHash("")).toMatch(/^[0-9a-f]{16}$/);
  });
});
