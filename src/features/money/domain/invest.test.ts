import { describe, expect, it } from "vitest";
import { buildRateTable } from "./fx";
import {
  accountFlows,
  allocation,
  buildPriceBook,
  cashEffect,
  ledgerEffect,
  marketValue,
  parsePrices,
  portfolio,
  replay,
  type Security,
  type Trade,
  TRADE_KINDS,
  validateTrade,
  xirr,
} from "./invest";

let seq = 0;
const trade = (t: Partial<Trade> & Pick<Trade, "kind" | "date">): Trade => ({
  id: `t${++seq}`,
  accountId: "a",
  securityId: t.kind === "interest" || t.kind === "fee" ? null : "x",
  quantity: null,
  amountMinor: 0,
  feeMinor: 0,
  transactionId: null,
  notes: null,
  createdAt: `2026-01-01T00:00:${String(seq).padStart(2, "0")}Z`,
  ...t,
});

const xeqt: Security = {
  id: "x",
  symbol: "XEQT",
  name: "Equity ETF",
  currency: "CAD",
  assetClass: "equity",
  region: "global",
  notes: null,
};
const zag: Security = {
  id: "z",
  symbol: "ZAG",
  name: "Bond ETF",
  currency: "CAD",
  assetClass: "fixed_income",
  region: "canada",
  notes: null,
};

describe("ACB (average cost, as the CRA counts it)", () => {
  it("adds the commission to the cost of a buy and takes it off the proceeds of a sell", () => {
    const book = replay(
      [
        trade({
          kind: "buy",
          date: "2026-01-05",
          quantity: 100,
          amountMinor: 300_000,
          feeMinor: 999,
        }),
        trade({
          kind: "buy",
          date: "2026-02-05",
          quantity: 50,
          amountMinor: 160_000,
          feeMinor: 999,
        }),
        trade({
          kind: "sell",
          date: "2026-03-05",
          quantity: 60,
          amountMinor: 210_000,
          feeMinor: 999,
        }),
      ],
      "2026-12-31",
    );
    const p = book.positions.get("x")!;
    // ACB before the sell: 300,999 + 160,999 = 461,998 for 150 units; 60 units carry 184,799.20 → 184,799.
    expect(book.dispositions[0]).toMatchObject({
      proceedsMinor: 209_001,
      acbMinor: 184_799,
      gainMinor: 24_202,
    });
    expect(p.units).toBe(90);
    expect(p.acbMinor).toBe(461_998 - 184_799);
    expect(book.commissionsMinor).toBe(2997);
  });

  it("clears the ACB exactly when the last unit is sold", () => {
    const book = replay(
      [
        trade({
          kind: "buy",
          date: "2026-01-05",
          quantity: 3,
          amountMinor: 10_000,
        }),
        trade({
          kind: "sell",
          date: "2026-01-06",
          quantity: 1,
          amountMinor: 4_000,
        }),
        trade({
          kind: "sell",
          date: "2026-01-07",
          quantity: 2,
          amountMinor: 8_000,
        }),
      ],
      "2026-12-31",
    );
    const p = book.positions.get("x")!;
    expect(p.units).toBe(0);
    expect(p.acbMinor).toBe(0);
    expect(book.dispositions.reduce((t, d) => t + d.acbMinor, 0)).toBe(10_000);
    expect(p.realisedMinor).toBe(2_000);
  });

  it("keeps fractional units exact enough", () => {
    const book = replay(
      [
        trade({
          kind: "buy",
          date: "2026-01-05",
          quantity: 0.1,
          amountMinor: 1_000,
        }),
        trade({
          kind: "buy",
          date: "2026-01-06",
          quantity: 0.2,
          amountMinor: 2_000,
        }),
        trade({
          kind: "sell",
          date: "2026-01-07",
          quantity: 0.3,
          amountMinor: 3_300,
        }),
      ],
      "2026-12-31",
    );
    expect(book.positions.get("x")!.units).toBe(0);
    expect(book.problems).toEqual([]);
    expect(book.dispositions[0].gainMinor).toBe(300);
  });

  it("adds a reinvested distribution to units, cost and income", () => {
    const book = replay(
      [
        trade({
          kind: "buy",
          date: "2026-01-05",
          quantity: 10,
          amountMinor: 10_000,
        }),
        trade({
          kind: "reinvest",
          date: "2026-03-31",
          quantity: 0.5,
          amountMinor: 500,
        }),
      ],
      "2026-12-31",
    );
    expect(book.positions.get("x")).toMatchObject({
      units: 10.5,
      acbMinor: 10_500,
      incomeMinor: 500,
    });
  });

  it("lowers the ACB on a return of capital, and counts any excess as a gain", () => {
    const book = replay(
      [
        trade({
          kind: "buy",
          date: "2026-01-05",
          quantity: 10,
          amountMinor: 1_000,
        }),
        trade({
          kind: "return_of_capital",
          date: "2026-02-01",
          amountMinor: 600,
        }),
        trade({
          kind: "return_of_capital",
          date: "2026-03-01",
          amountMinor: 600,
        }),
      ],
      "2026-12-31",
    );
    const p = book.positions.get("x")!;
    expect(p.acbMinor).toBe(0);
    expect(p.realisedMinor).toBe(200);
    expect(book.dispositions).toHaveLength(1);
    expect(book.dispositions[0]).toMatchObject({
      kind: "return_of_capital",
      gainMinor: 200,
    });
  });

  it("changes units but not cost on a split", () => {
    const book = replay(
      [
        trade({
          kind: "buy",
          date: "2026-01-05",
          quantity: 10,
          amountMinor: 1_000,
        }),
        trade({ kind: "split", date: "2026-02-01", quantity: 4 }),
      ],
      "2026-12-31",
    );
    expect(book.positions.get("x")).toMatchObject({
      units: 40,
      acbMinor: 1_000,
    });
  });

  it("reports selling more than is held, and sells what there is", () => {
    const book = replay(
      [
        trade({
          kind: "buy",
          date: "2026-01-05",
          quantity: 5,
          amountMinor: 500,
        }),
        trade({
          kind: "sell",
          date: "2026-01-06",
          quantity: 8,
          amountMinor: 900,
        }),
      ],
      "2026-12-31",
      () => "XEQT",
    );
    expect(book.problems[0]).toContain("sold 8 XEQT with only 5 held");
    expect(book.positions.get("x")!.units).toBe(0);
    expect(book.dispositions[0].gainMinor).toBe(400);
  });

  it("orders same-day trades by when they were entered, and ignores trades after the day asked about", () => {
    const sell = trade({
      kind: "sell",
      date: "2026-01-05",
      quantity: 1,
      amountMinor: 200,
      createdAt: "2026-01-05T10:00:00Z",
    });
    const buy = trade({
      kind: "buy",
      date: "2026-01-05",
      quantity: 1,
      amountMinor: 100,
      createdAt: "2026-01-05T09:00:00Z",
    });
    const later = trade({
      kind: "buy",
      date: "2026-06-01",
      quantity: 7,
      amountMinor: 700,
    });
    const book = replay([sell, later, buy], "2026-03-01");
    expect(book.problems).toEqual([]);
    expect(book.dispositions[0].gainMinor).toBe(100);
    expect(book.positions.get("x")!.units).toBe(0);
  });

  it("is independent of the order trades arrive in", () => {
    const trades = [
      trade({
        kind: "buy",
        date: "2026-01-05",
        quantity: 10,
        amountMinor: 1_000,
      }),
      trade({
        kind: "sell",
        date: "2026-02-05",
        quantity: 4,
        amountMinor: 600,
      }),
      trade({ kind: "buy", date: "2026-03-05", quantity: 2, amountMinor: 300 }),
    ];
    expect(replay([...trades].reverse(), "2026-12-31")).toEqual(
      replay(trades, "2026-12-31"),
    );
  });
});

describe("cash and the ledger", () => {
  it("moves cash for every kind, and the ledger only for income and fees", () => {
    const effects = Object.fromEntries(
      TRADE_KINDS.map((kind) => [
        kind,
        [
          cashEffect({
            kind,
            amountMinor: 100,
            feeMinor: kind === "buy" || kind === "sell" ? 5 : 0,
          }),
          ledgerEffect({ kind, amountMinor: 100 }),
        ],
      ]),
    );
    expect(effects).toEqual({
      buy: [-105, 0],
      sell: [95, 0],
      reinvest: [0, 100],
      dividend: [100, 100],
      interest: [100, 100],
      fee: [-100, -100],
      return_of_capital: [100, 0],
      split: [0, 0],
    });
  });

  it("values an account as its true cash plus its holdings", () => {
    // Deposited 10,000.00 (ledger); bought 100 × 30.00 + 9.99; a 12.34 dividend (ledger); reinvested 5.00 (ledger).
    const trades = [
      trade({
        kind: "buy",
        date: "2026-01-05",
        quantity: 100,
        amountMinor: 300_000,
        feeMinor: 999,
      }),
      trade({ kind: "dividend", date: "2026-03-31", amountMinor: 1_234 }),
      trade({
        kind: "reinvest",
        date: "2026-03-31",
        quantity: 0.15,
        amountMinor: 500,
      }),
    ];
    const ledger = 1_000_000 + 1_234 + 500;
    const pf = portfolio({
      accountId: "a",
      currency: "CAD",
      ledgerBalanceMinor: ledger,
      trades,
      securities: new Map([["x", xeqt]]),
      prices: buildPriceBook([
        { securityId: "x", date: "2026-03-01", price: 31 },
        { securityId: "x", date: "2026-04-01", price: 32.5 },
      ]),
      on: "2026-04-15",
    });
    expect(pf.cashMinor).toBe(1_000_000 - 300_999 + 1_234);
    const h = pf.holdings[0];
    expect(h.units).toBe(100.15);
    expect(h.price?.price).toBe(32.5);
    expect(h.marketValueMinor).toBe(325_488); // 100.15 × 32.50 = 3,254.875 → 3,254.88
    expect(h.unrealisedMinor).toBe(325_488 - 301_499);
    expect(h.priceAgeDays).toBe(14);
    expect(pf.valueMinor).toBe(pf.cashMinor + 325_488);
    expect(pf.adjustmentMinor).toBe(pf.valueMinor - ledger);
  });

  it("falls back to the ACB for a holding with no price, and names it", () => {
    const pf = portfolio({
      accountId: "a",
      currency: "CAD",
      ledgerBalanceMinor: 1_000,
      trades: [
        trade({
          kind: "buy",
          date: "2026-01-05",
          quantity: 1,
          amountMinor: 1_000,
        }),
      ],
      securities: new Map([["x", xeqt]]),
      prices: buildPriceBook([
        { securityId: "x", date: "2026-02-01", price: 12 },
      ]),
      on: "2026-01-20",
    });
    expect(pf.unpriced).toEqual(["XEQT"]);
    expect(pf.holdings[0]).toMatchObject({
      marketValueMinor: null,
      valueMinor: 1_000,
      unrealisedMinor: null,
    });
    expect(pf.valueMinor).toBe(1_000);
  });

  it("only counts the account's own trades", () => {
    const pf = portfolio({
      accountId: "b",
      currency: "CAD",
      ledgerBalanceMinor: 0,
      trades: [
        trade({
          kind: "buy",
          date: "2026-01-05",
          quantity: 1,
          amountMinor: 1_000,
        }),
      ],
      securities: new Map([["x", xeqt]]),
      prices: buildPriceBook([]),
      on: "2026-01-20",
    });
    expect(pf.holdings).toEqual([]);
    expect(pf.cashMinor).toBe(0);
  });
});

describe("validateTrade", () => {
  it("mirrors money_trade_shape", () => {
    expect(
      validateTrade({
        kind: "buy",
        securityId: "x",
        quantity: 1,
        amountMinor: 100,
        feeMinor: 0,
      }),
    ).toEqual([]);
    expect(
      validateTrade({
        kind: "buy",
        securityId: null,
        quantity: null,
        amountMinor: 100,
        feeMinor: 0,
      }),
    ).toHaveLength(2);
    expect(
      validateTrade({
        kind: "split",
        securityId: "x",
        quantity: 2,
        amountMinor: 5,
        feeMinor: 0,
      }),
    ).toContain("A split moves no money.");
    expect(
      validateTrade({
        kind: "dividend",
        securityId: "x",
        quantity: null,
        amountMinor: 0,
        feeMinor: 0,
      }),
    ).toContain("Enter the amount.");
    expect(
      validateTrade({
        kind: "interest",
        securityId: null,
        quantity: null,
        amountMinor: 10,
        feeMinor: 1,
      }),
    ).toContain("Only a buy or sell has a commission.");
    expect(
      validateTrade({
        kind: "fee",
        securityId: null,
        quantity: null,
        amountMinor: 10,
        feeMinor: 0,
      }),
    ).toEqual([]);
  });
});

describe("prices", () => {
  it("finds the latest price on or before a day", () => {
    const book = buildPriceBook([
      { securityId: "x", date: "2026-03-01", price: 3 },
      { securityId: "x", date: "2026-01-01", price: 1 },
      { securityId: "x", date: "2026-02-01", price: 2 },
    ]);
    expect(book.latest("x", "2025-12-31")).toBeNull();
    expect(book.latest("x", "2026-02-15")?.price).toBe(2);
    expect(book.latest("x", "2026-03-01")?.price).toBe(3);
    expect(book.latest("y", "2026-03-01")).toBeNull();
  });

  it("rounds market value in the currency's minor units", () => {
    expect(marketValue(3, 0.335, "CAD")).toBe(101);
    expect(marketValue(10, 1234.5, "JPY")).toBe(12_345);
  });

  it("reads pasted prices, with or without a symbol, and reports bad lines", () => {
    const { prices, errors } = parsePrices(
      'Symbol,Date,Close\nxeqt,2026-03-31,32.10\n\n2026-04-01\t"1,234.50"\nZAG;2026-02-30;10\nZAG,2026-04-01,-1',
    );
    expect(prices).toEqual([
      { line: 2, symbol: "XEQT", date: "2026-03-31", price: 32.1 },
      { line: 4, symbol: null, date: "2026-04-01", price: 1234.5 },
    ]);
    expect(errors).toEqual([
      "Line 5: the date has to look like 2026-03-31.",
      "Line 6: the price has to be a number above zero.",
    ]);
  });
});

describe("returns", () => {
  it("matches a known XIRR", () => {
    // 1,000 in; 1,100 out a year later → 10%.
    expect(
      xirr([
        { date: "2025-01-01", amountMinor: -100_000 },
        { date: "2026-01-01", amountMinor: 110_000 },
      ]),
    ).toBeCloseTo(0.1, 6);
    // Excel's documented example: ≈ 37.34%.
    const r = xirr([
      { date: "2008-01-01", amountMinor: -1_000_000 },
      { date: "2008-03-01", amountMinor: 275_000 },
      { date: "2008-10-30", amountMinor: 425_000 },
      { date: "2009-02-15", amountMinor: 325_000 },
      { date: "2009-04-01", amountMinor: 275_000 },
    ]);
    expect(r).toBeCloseTo(0.3734, 3);
  });

  it("handles losses and refuses flows with no answer", () => {
    expect(
      xirr([
        { date: "2025-01-01", amountMinor: -100_000 },
        { date: "2026-01-01", amountMinor: 50_000 },
      ]),
    ).toBeCloseTo(-0.5, 6);
    expect(xirr([{ date: "2025-01-01", amountMinor: -100_000 }])).toBeNull();
    expect(
      xirr([
        { date: "2025-01-01", amountMinor: 100 },
        { date: "2026-01-01", amountMinor: 100 },
      ]),
    ).toBeNull();
    expect(
      xirr([
        { date: "2025-01-01", amountMinor: -100 },
        { date: "2025-01-01", amountMinor: 110 },
      ]),
    ).toBeNull();
  });

  it("takes an account's outside flows from its opening balance and transfers", () => {
    const { flows, contributedMinor, withdrawnMinor } = accountFlows({
      accountId: "a",
      openingDate: "2026-01-01",
      openingBalanceMinor: 5_000,
      transactions: [
        {
          date: "2026-02-01",
          kind: "transfer",
          postings: [
            {
              accountId: "chq",
              categoryId: null,
              amountMinor: -10_000,
              fxRate: null,
              baseAmountMinor: null,
            },
            {
              accountId: "a",
              categoryId: null,
              amountMinor: 10_000,
              fxRate: null,
              baseAmountMinor: null,
            },
          ],
        },
        {
          date: "2026-03-01",
          kind: "income",
          postings: [
            {
              accountId: "a",
              categoryId: "div",
              amountMinor: 50,
              fxRate: null,
              baseAmountMinor: null,
            },
          ],
        },
        {
          date: "2026-04-01",
          kind: "transfer",
          postings: [
            {
              accountId: "a",
              categoryId: null,
              amountMinor: -2_000,
              fxRate: null,
              baseAmountMinor: null,
            },
            {
              accountId: "chq",
              categoryId: null,
              amountMinor: 2_000,
              fxRate: null,
              baseAmountMinor: null,
            },
          ],
        },
      ],
      valueMinor: 14_000,
      on: "2026-06-30",
    });
    expect(flows).toEqual([
      { date: "2026-01-01", amountMinor: -5_000 },
      { date: "2026-02-01", amountMinor: -10_000 },
      { date: "2026-04-01", amountMinor: 2_000 },
      { date: "2026-06-30", amountMinor: 14_000 },
    ]);
    expect(contributedMinor).toBe(15_000);
    expect(withdrawnMinor).toBe(2_000);
  });
});

describe("allocation", () => {
  it("splits holdings and cash by class, region and currency in the base currency", () => {
    const make = (
      currency: string,
      cash: number,
      holdings: [Security, number][],
    ) =>
      ({
        accountId: currency,
        currency,
        cashMinor: cash,
        valueMinor: 0,
        adjustmentMinor: 0,
        unpriced: [],
        book: replay([], "2026-01-01"),
        holdings: holdings.map(
          ([security, value]) => ({ security, valueMinor: value }) as never,
        ),
      }) as Parameters<typeof allocation>[0][number];
    const usd: Security = {
      ...xeqt,
      id: "v",
      symbol: "VOO",
      currency: "USD",
      region: "us",
    };
    const rates = buildRateTable([
      { base: "USD", quote: "CAD", asOf: "2026-01-01", rate: 1.4 },
    ]);
    const a = allocation(
      [
        make("CAD", 1_000, [
          [xeqt, 6_000],
          [zag, 2_000],
        ]),
        make("USD", 0, [[usd, 1_000]]),
        make("INR", 5, []),
      ],
      "CAD",
      "2026-01-02",
      rates,
    );
    expect(a.total).toBe(10_400);
    expect(a.byClass).toEqual([
      { key: "equity", valueMinor: 7_400, share: 7_400 / 10_400 },
      { key: "fixed_income", valueMinor: 2_000, share: 2_000 / 10_400 },
      { key: "cash", valueMinor: 1_000, share: 1_000 / 10_400 },
    ]);
    expect(a.byRegion.map((s) => s.key)).toEqual([
      "global",
      "canada",
      "us",
      "cash",
    ]);
    expect(a.byCurrency.map((s) => [s.key, s.valueMinor])).toEqual([
      ["CAD", 9_000],
      ["USD", 1_400],
    ]);
    expect(a.unconverted).toEqual(["INR"]);
  });
});
