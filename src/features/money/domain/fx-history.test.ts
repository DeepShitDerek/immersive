import { describe, expect, it } from "vitest";
import type { RateRow } from "./fx";
import {
  RATE_RANGES,
  rangeStart,
  rateHistory,
  rateSummary,
  rateSyncPlan,
} from "./fx-history";

const row = (asOf: string, rate: number, quote = "INR"): RateRow => ({
  base: "CAD",
  quote,
  asOf,
  rate,
});

describe("rate ranges", () => {
  it("offers one month, three months, six months and a year", () => {
    expect(RATE_RANGES.map((r) => r.label)).toEqual(["1M", "3M", "6M", "1Y"]);
  });

  it("starts the range that many months before today", () => {
    expect(rangeStart("1m", "2026-10-07")).toBe("2026-09-07");
    expect(rangeStart("3m", "2026-10-07")).toBe("2026-07-07");
    expect(rangeStart("6m", "2026-10-07")).toBe("2026-04-07");
    expect(rangeStart("1y", "2026-10-07")).toBe("2025-10-07");
  });
});

describe("rateHistory", () => {
  const rows = [
    row("2026-09-30", 61.2),
    row("2026-08-01", 60.1),
    row("2026-10-06", 61.9),
    row("2026-10-06", 0.73, "USD"),
  ];

  it("gives one currency's rates in date order, within the range", () => {
    expect(rateHistory(rows, "CAD", "INR", "2026-09-01", "2026-10-07")).toEqual(
      [
        { date: "2026-09-30", rate: 61.2 },
        { date: "2026-10-06", rate: 61.9 },
      ],
    );
  });

  it("reads a rate stored the other way round", () => {
    const inverse: RateRow[] = [
      { base: "INR", quote: "CAD", asOf: "2026-10-06", rate: 0.016 },
    ];
    const [point] = rateHistory(
      inverse,
      "CAD",
      "INR",
      "2026-10-01",
      "2026-10-07",
    );
    expect(point.date).toBe("2026-10-06");
    expect(point.rate).toBeCloseTo(62.5);
  });

  it("prefers the direct rate when a day has both", () => {
    const both: RateRow[] = [
      { base: "INR", quote: "CAD", asOf: "2026-10-06", rate: 0.016 },
      row("2026-10-06", 61.9),
    ];
    expect(rateHistory(both, "CAD", "INR", "2026-10-01", "2026-10-07")).toEqual(
      [{ date: "2026-10-06", rate: 61.9 }],
    );
  });

  it("leaves out rates that are not positive numbers", () => {
    const bad = [row("2026-10-05", 0), row("2026-10-06", Number.NaN)];
    expect(rateHistory(bad, "CAD", "INR", "2026-10-01", "2026-10-07")).toEqual(
      [],
    );
  });
});

describe("rateSummary", () => {
  it("says where the rate went over the range", () => {
    const summary = rateSummary([
      { date: "2026-09-07", rate: 60 },
      { date: "2026-09-20", rate: 59 },
      { date: "2026-10-06", rate: 63 },
    ]);
    expect(summary).toEqual({
      first: 60,
      last: 63,
      low: 59,
      high: 63,
      changePct: 5,
    });
  });

  it("has nothing to say about fewer than two rates", () => {
    expect(rateSummary([])).toBeNull();
    expect(rateSummary([{ date: "2026-10-06", rate: 63 }])).toBeNull();
  });
});

describe("rateSyncPlan", () => {
  const plan = (rows: RateRow[], quotes = ["INR"]) =>
    rateSyncPlan({ base: "CAD", quotes, rows, today: "2026-10-07" });

  it("fetches a year for a currency with no rates yet", () => {
    expect(plan([])).toEqual({ quotes: ["INR"], from: "2025-10-07" });
  });

  it("fetches only the days since the last stored rate", () => {
    const rows = [row("2025-10-01", 60), row("2026-10-02", 61)];
    expect(plan(rows)).toEqual({ quotes: ["INR"], from: "2026-10-03" });
  });

  it("fetches nothing when today's rate is stored", () => {
    const rows = [row("2025-10-01", 60), row("2026-10-07", 61)];
    expect(plan(rows)).toBeNull();
  });

  it("fills in the year behind when the stored history is shorter", () => {
    // The graph offers a year; a ledger started last month has less.
    const rows = [row("2026-09-01", 60), row("2026-10-07", 61)];
    expect(plan(rows)).toEqual({ quotes: ["INR"], from: "2025-10-07" });
  });

  it("asks for each currency that is behind, from the earliest date needed", () => {
    const rows = [
      row("2025-10-01", 60),
      row("2026-10-07", 61),
      row("2025-10-01", 0.72, "USD"),
      row("2026-10-01", 0.73, "USD"),
    ];
    expect(plan(rows, ["INR", "USD", "EUR"])).toEqual({
      quotes: ["USD", "EUR"],
      from: "2025-10-07",
    });
  });

  it("has nothing to fetch with no other currency in use", () => {
    expect(plan([], [])).toBeNull();
  });
});
