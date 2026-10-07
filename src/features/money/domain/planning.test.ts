import { describe, expect, it } from "vitest";
import {
  type Budget,
  bucketSplit,
  budgetInForce,
  monthBudget,
  spendingByRoot,
} from "./budget";
import { buildRateTable } from "./fx";
import { type Goal, goalProgress } from "./goals";
import type { Transaction } from "./ledger";
import {
  draftFromOccurrence,
  dueQueue,
  monthlyEquivalent,
  nextOccurrence,
  occurrences,
  type Schedule,
  skipKey,
} from "./schedule";

const schedule = (overrides: Partial<Schedule>): Schedule => ({
  id: "s",
  name: "Rent",
  kind: "expense",
  accountId: "chq",
  toAccountId: null,
  categoryId: "rent",
  amountMinor: 140000,
  toAmountMinor: null,
  isEstimate: false,
  frequency: "monthly",
  startDate: "2026-01-31",
  endDate: null,
  dayOne: null,
  dayTwo: null,
  payee: null,
  notes: null,
  archivedAt: null,
  ...overrides,
});

describe("occurrences", () => {
  it("anchors month-ends instead of drifting", () => {
    expect(occurrences(schedule({}), "2026-01-01", "2026-05-31")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
    ]);
  });

  it("finds a monthly occurrence years in without drifting or skipping", () => {
    expect(
      occurrences(
        schedule({ startDate: "2020-01-31" }),
        "2028-02-01",
        "2028-03-31",
      ),
    ).toEqual(["2028-02-29", "2028-03-31"]);
  });

  it("does weekly and bi-weekly from the start date", () => {
    const pay = schedule({ frequency: "biweekly", startDate: "2026-01-02" });
    expect(occurrences(pay, "2026-01-01", "2026-02-28")).toEqual([
      "2026-01-02",
      "2026-01-16",
      "2026-01-30",
      "2026-02-13",
      "2026-02-27",
    ]);
    expect(occurrences(pay, "2026-02-14", "2026-02-27")).toEqual([
      "2026-02-27",
    ]);
    expect(
      occurrences(
        schedule({ frequency: "weekly", startDate: "2026-03-02" }),
        "2026-03-01",
        "2026-03-20",
      ),
    ).toEqual(["2026-03-02", "2026-03-09", "2026-03-16"]);
  });

  it("does semi-monthly pay on the 15th and the last day", () => {
    const pay = schedule({
      frequency: "semimonthly",
      startDate: "2026-01-15",
      dayOne: 31,
      dayTwo: 15,
    });
    expect(occurrences(pay, "2026-01-01", "2026-03-31")).toEqual([
      "2026-01-15",
      "2026-01-31",
      "2026-02-15",
      "2026-02-28",
      "2026-03-15",
      "2026-03-31",
    ]);
  });

  it("does quarterly, yearly on Feb 29, and once", () => {
    expect(
      occurrences(
        schedule({ frequency: "quarterly", startDate: "2026-01-15" }),
        "2026-01-01",
        "2026-12-31",
      ),
    ).toEqual(["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"]);
    expect(
      occurrences(
        schedule({ frequency: "yearly", startDate: "2024-02-29" }),
        "2024-01-01",
        "2028-12-31",
      ),
    ).toEqual([
      "2024-02-29",
      "2025-02-28",
      "2026-02-28",
      "2027-02-28",
      "2028-02-29",
    ]);
    expect(
      occurrences(
        schedule({ frequency: "once", startDate: "2026-06-01" }),
        "2026-01-01",
        "2026-12-31",
      ),
    ).toEqual(["2026-06-01"]);
    expect(
      occurrences(
        schedule({ frequency: "once", startDate: "2026-06-01" }),
        "2026-07-01",
        "2026-12-31",
      ),
    ).toEqual([]);
  });

  it("stops at the end date and never before the start", () => {
    const s = schedule({ startDate: "2026-01-10", endDate: "2026-03-10" });
    expect(occurrences(s, "2025-01-01", "2027-01-01")).toEqual([
      "2026-01-10",
      "2026-02-10",
      "2026-03-10",
    ]);
    expect(nextOccurrence(s, "2026-03-10")).toBeNull();
    expect(nextOccurrence(s, "2026-01-10")).toBe("2026-02-10");
  });

  it("stays bounded on a pathological range", () => {
    expect(
      occurrences(
        schedule({ frequency: "weekly", startDate: "1900-01-01" }),
        "1900-01-01",
        "2200-01-01",
      ).length,
    ).toBe(5000);
  });

  it("converts to a monthly figure", () => {
    expect(
      monthlyEquivalent({ frequency: "biweekly", amountMinor: 200000 }),
    ).toBe(433333);
    expect(
      monthlyEquivalent({ frequency: "semimonthly", amountMinor: 200000 }),
    ).toBe(400000);
    expect(
      monthlyEquivalent({ frequency: "yearly", amountMinor: 120000 }),
    ).toBe(10000);
  });
});

describe("due queue", () => {
  const rent = schedule({ id: "rent", startDate: "2024-01-01" });
  const phone = schedule({
    id: "phone",
    name: "Phone",
    startDate: "2026-01-20",
    amountMinor: 5500,
  });

  it("lists what is overdue, due today and coming, without recorded or skipped ones", () => {
    const recorded = [{ scheduleId: "rent", occurrenceDate: "2026-02-01" }];
    const skips = new Set([skipKey("phone", "2026-02-20")]);
    const queue = dueQueue([rent, phone], recorded, skips, "2026-03-01");
    // Feb rent is recorded, Feb phone skipped, Mar 20 phone is past the 14-day window.
    expect(queue.map((q) => [q.schedule.id, q.dueDate, q.status])).toEqual([
      ["phone", "2026-01-20", "overdue"],
      ["rent", "2026-03-01", "today"],
    ]);
    // From Mar 10 the 45-day window starts Jan 24: Jan 20 is out, Feb 20 overdue, Mar 20 upcoming.
    expect(
      dueQueue([phone], [], new Set(), "2026-03-10").map((q) => [
        q.dueDate,
        q.status,
      ]),
    ).toEqual([
      ["2026-02-20", "overdue"],
      ["2026-03-20", "upcoming"],
    ]);
  });

  it("does not bury a new user in two years of overdue rent", () => {
    const queue = dueQueue([rent], [], new Set(), "2026-03-10");
    expect(queue.map((q) => q.dueDate)).toEqual(["2026-02-01", "2026-03-01"]);
  });

  it("ignores occurrences before the account opened, and archived schedules", () => {
    expect(
      dueQueue([rent], [], new Set(), "2026-03-10", {
        openingDate: () => "2026-02-15",
      }).map((q) => q.dueDate),
    ).toEqual(["2026-03-01"]);
    expect(
      dueQueue(
        [{ ...rent, archivedAt: "2026-01-01" }],
        [],
        new Set(),
        "2026-03-10",
      ),
    ).toEqual([]);
  });
});

describe("recording an occurrence", () => {
  const accounts = new Map([
    ["chq", { currency: "CAD" }],
    ["nro", { currency: "INR" }],
  ]);
  const rates = buildRateTable([
    { base: "CAD", quote: "INR", asOf: "2026-01-01", rate: 61 },
  ]);

  it("makes an expense negative, linked to its due date", () => {
    const draft = draftFromOccurrence(
      schedule({}),
      "2026-02-28",
      accounts,
      "CAD",
      rates,
      "2026-03-02",
    )!;
    expect(draft).toMatchObject({
      date: "2026-03-02",
      occurrenceDate: "2026-02-28",
      scheduleId: "s",
      kind: "expense",
    });
    expect(draft.postings).toEqual([
      {
        accountId: "chq",
        categoryId: "rent",
        amountMinor: -140000,
        fxRate: 1,
        baseAmountMinor: -140000,
      },
    ]);
  });

  it("makes a monthly transfer home with both amounts", () => {
    const home = schedule({
      kind: "transfer",
      toAccountId: "nro",
      categoryId: null,
      amountMinor: 50000,
      toAmountMinor: 3000000,
    });
    expect(
      draftFromOccurrence(
        home,
        "2026-02-01",
        accounts,
        "CAD",
        rates,
      )!.postings.map((p) => [p.accountId, p.amountMinor]),
    ).toEqual([
      ["chq", -50000],
      ["nro", 3000000],
    ]);
    expect(
      draftFromOccurrence(
        { ...home, toAmountMinor: null },
        "2026-02-01",
        accounts,
        "CAD",
        rates,
      ),
    ).toBeNull();
  });
});

const tx = (
  date: string,
  amountMinor: number,
  categoryId: string | null,
  kind: Transaction["kind"] = "expense",
) => ({
  date,
  kind,
  status: "cleared" as const,
  postings: [
    {
      accountId: "chq",
      categoryId,
      amountMinor,
      fxRate: 1,
      baseAmountMinor: amountMinor,
    },
  ],
});

describe("budgets", () => {
  const categories = [
    { id: "food", parentId: null, bucket: "want" as const },
    { id: "groceries", parentId: "food", bucket: "want" as const },
    { id: "rent", parentId: null, bucket: "need" as const },
    { id: "savings", parentId: null, bucket: "save" as const },
    { id: "salary", parentId: null, bucket: "income" as const },
  ];
  const history = [
    tx("2026-01-05", -20000, "groceries"),
    tx("2026-01-20", -10000, "food"),
    tx("2026-02-05", -45000, "groceries"),
    tx("2026-02-06", 5000, "groceries", "refund"),
    tx("2026-03-03", -10000, "groceries"),
    tx("2026-03-01", -140000, "rent"),
    tx("2026-03-15", 400000, "salary", "income"),
    tx("2026-03-20", -50000, "savings"),
    tx("2026-03-21", -3000, null),
  ];
  const spending = (month: string) =>
    spendingByRoot(history, categories, month);

  it("rolls subcategories up into their parent's budget, refunds netted", () => {
    expect(spending("2026-01").get("food")).toBe(30000);
    expect(spending("2026-02").get("food")).toBe(40000);
  });

  it("uses the row in force, and a zero row stops budgeting", () => {
    const rows: Budget[] = [
      {
        id: "1",
        categoryId: "food",
        fromMonth: "2026-01-01",
        amountMinor: 40000,
        rollover: false,
      },
      {
        id: "2",
        categoryId: "food",
        fromMonth: "2026-03-01",
        amountMinor: 50000,
        rollover: false,
      },
      {
        id: "3",
        categoryId: "food",
        fromMonth: "2026-05-01",
        amountMinor: 0,
        rollover: false,
      },
    ];
    expect(budgetInForce(rows, "food", "2025-12")).toBeNull();
    expect(budgetInForce(rows, "food", "2026-02")?.amountMinor).toBe(40000);
    expect(budgetInForce(rows, "food", "2026-04")?.amountMinor).toBe(50000);
    expect(budgetInForce(rows, "food", "2026-06")).toBeNull();
  });

  it("reports spent and left, over budget as a ratio above 1", () => {
    const rows: Budget[] = [
      {
        id: "1",
        categoryId: "food",
        fromMonth: "2026-01-01",
        amountMinor: 35000,
        rollover: false,
      },
    ];
    const [line] = monthBudget(rows, "2026-02", spending);
    expect(line).toMatchObject({
      budgetMinor: 35000,
      carriedMinor: 0,
      spentMinor: 40000,
      leftMinor: -5000,
    });
    expect(line.ratio).toBeCloseTo(40000 / 35000);
  });

  it("carries what was left forward with rollover", () => {
    const rows: Budget[] = [
      {
        id: "1",
        categoryId: "food",
        fromMonth: "2026-01-01",
        amountMinor: 40000,
        rollover: true,
      },
    ];
    // Jan: 40000 − 30000 = +10000; Feb: 40000 − 40000 = 0 → March starts with +10000.
    const [march] = monthBudget(rows, "2026-03", spending);
    expect(march).toMatchObject({
      carriedMinor: 10000,
      spentMinor: 10000,
      leftMinor: 40000,
    });
  });

  it("restarts the carry when a row without rollover comes into force", () => {
    const rows: Budget[] = [
      {
        id: "1",
        categoryId: "food",
        fromMonth: "2026-01-01",
        amountMinor: 40000,
        rollover: true,
      },
      {
        id: "2",
        categoryId: "food",
        fromMonth: "2026-02-01",
        amountMinor: 40000,
        rollover: false,
      },
      {
        id: "3",
        categoryId: "food",
        fromMonth: "2026-03-01",
        amountMinor: 40000,
        rollover: true,
      },
    ];
    expect(monthBudget(rows, "2026-03", spending)[0].carriedMinor).toBe(0);
  });

  it("splits a month into needs, wants and saved as shares of income", () => {
    const split = bucketSplit(history, categories, "2026-03");
    expect(split.incomeMinor).toBe(400000);
    expect(split.needMinor).toBe(140000);
    expect(split.wantMinor).toBe(10000 + 3000);
    expect(split.uncategorisedMinor).toBe(3000);
    expect(split.savedMinor).toBe(400000 - 140000 - 13000);
    expect(split.shares?.need).toBeCloseTo(0.35);
    expect(bucketSplit(history, categories, "2026-01").shares).toBeNull();
  });
});

describe("goals", () => {
  const rates = buildRateTable([
    { base: "CAD", quote: "INR", asOf: "2026-01-01", rate: 60 },
  ]);
  const accounts = [
    { id: "tfsa", currency: "CAD", openingBalanceMinor: 200000 },
    { id: "fd", currency: "INR", openingBalanceMinor: 6000000 },
  ];
  const deposits = [
    {
      date: "2026-07-01",
      status: "cleared" as const,
      postings: [
        {
          accountId: "tfsa",
          categoryId: null,
          amountMinor: 100000,
          fxRate: 1,
          baseAmountMinor: 100000,
        },
      ],
    },
    {
      date: "2026-08-01",
      status: "cleared" as const,
      postings: [
        {
          accountId: "tfsa",
          categoryId: null,
          amountMinor: 100000,
          fxRate: 1,
          baseAmountMinor: 100000,
        },
      ],
    },
  ];
  const goal: Goal = {
    id: "g",
    name: "Emergency",
    targetMinor: 1000000,
    currency: "CAD",
    targetDate: "2027-09-01",
    accountIds: ["tfsa", "fd"],
    notes: null,
    achievedAt: null,
    archivedAt: null,
  };

  it("measures progress from the linked accounts, converted", () => {
    const p = goalProgress(goal, accounts, deposits, "2026-09-01", rates);
    // 200000 + 200000 CAD + ₹60,000 = $1,000 → 500000
    expect(p.savedMinor).toBe(500000);
    expect(p.remainingMinor).toBe(500000);
    expect(p.ratio).toBe(0.5);
  });

  it("says what monthly saving reaches the date, and when the current pace gets there", () => {
    const p = goalProgress(goal, accounts, deposits, "2026-09-01", rates);
    expect(p.monthsLeft).toBe(12);
    expect(p.requiredPerMonthMinor).toBe(Math.ceil(500000 / 12));
    expect(p.pacePerMonthMinor).toBeGreaterThan(0);
    expect(p.projectedDate! > "2026-09-01").toBe(true);
  });

  it("is done when the balance reaches the target, and has no projection when not growing", () => {
    expect(
      goalProgress(
        { ...goal, targetMinor: 400000 },
        accounts,
        deposits,
        "2026-09-01",
        rates,
      ),
    ).toMatchObject({
      ratio: 1,
      remainingMinor: 0,
      projectedDate: "2026-09-01",
    });
    expect(
      goalProgress(goal, accounts, [], "2026-09-01", rates).projectedDate,
    ).toBeNull();
  });
});
