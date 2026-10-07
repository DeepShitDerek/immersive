import { describe, expect, it } from "vitest";
import type { CalendarRow, EventException } from "@/types";
import { buildEntries, filterEntries, resolveStart } from "./build-entries";
import {
  describeRRule,
  expandOccurrences,
  formatRRule,
  parseRRule,
} from "./recurrence";
import { parseQuickAdd } from "./quick-add";

/*
  The calendar's own logic, kept through the rebuild of everything around it.
  It had no tests; these pin what it does so the new grid can rely on it.
*/

const row = (over: Partial<CalendarRow>): CalendarRow => ({
  item_id: "r1",
  title: "Standup",
  start_time: new Date(2026, 9, 5, 9, 0).toISOString(),
  end_time: new Date(2026, 9, 5, 9, 30).toISOString(),
  item_type: "event",
  is_all_day: false,
  data: {},
  ...over,
});
const windowOf = (from: Date, days: number) => ({
  windowStart: from,
  windowEnd: new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate() + days,
  ),
});

describe("recurrence", () => {
  it("round-trips a rule", () => {
    const rule = parseRRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH")!;
    expect(rule.freq).toBe("WEEKLY");
    expect(rule.interval).toBe(2);
    expect(parseRRule(formatRRule(rule))).toEqual(rule);
  });

  it("describes a rule in words", () => {
    expect(describeRRule("FREQ=WEEKLY;BYDAY=MO,WE")).toMatch(/^Weekly on Mon/);
    expect(describeRRule("FREQ=DAILY;COUNT=3")).toBe("Daily, 3 times");
    expect(describeRRule(null)).toBeNull();
  });

  it("expands a daily rule inside the window only", () => {
    const starts = expandOccurrences({
      start: new Date(2026, 9, 1, 9, 0),
      rrule: "FREQ=DAILY",
      ...windowOf(new Date(2026, 9, 5), 3),
    });
    expect(starts.map((s) => s.getDate())).toEqual([5, 6, 7]);
    expect(starts.every((s) => s.getHours() === 9)).toBe(true);
  });

  it("stops at COUNT", () => {
    const starts = expandOccurrences({
      start: new Date(2026, 9, 5, 9, 0),
      rrule: "FREQ=DAILY;COUNT=2",
      ...windowOf(new Date(2026, 9, 5), 7),
    });
    expect(starts).toHaveLength(2);
  });
});

describe("buildEntries", () => {
  it("expands a weekly series and applies a cancellation and a move", () => {
    const from = new Date(2026, 9, 5);
    const exceptions: EventException[] = [
      {
        id: "x1",
        event_id: "r1",
        original_start: new Date(2026, 9, 6, 9, 0).toISOString(),
        is_cancelled: true,
      },
      {
        id: "x2",
        event_id: "r1",
        original_start: new Date(2026, 9, 7, 9, 0).toISOString(),
        is_cancelled: false,
        new_start: new Date(2026, 9, 7, 11, 0).toISOString(),
        new_title: "Moved",
      },
    ];
    const entries = buildEntries({
      rows: [row({ data: { rrule: "FREQ=DAILY" } })],
      exceptions,
      ...windowOf(from, 3),
    });
    expect(
      entries.map((e) => [e.start.getDate(), e.start.getHours(), e.title]),
    ).toEqual([
      [5, 9, "Standup"],
      [7, 11, "Moved"],
    ]);
    // The moved occurrence keeps the series' 30 minutes, and can be reset.
    const moved = entries[1];
    expect(moved.end.getTime() - moved.start.getTime()).toBe(30 * 60_000);
    expect(moved.exceptionId).toBe("x2");
    expect(new Set(entries.map((e) => e.id)).size).toBe(2);
  });

  it("gives a timed row with no end an hour", () => {
    const [e] = buildEntries({
      rows: [row({ end_time: null })],
      exceptions: [],
      ...windowOf(new Date(2026, 9, 5), 1),
    });
    expect(e.end.getTime() - e.start.getTime()).toBe(60 * 60_000);
  });

  it("reads a task's date as the calendar date in any zone", () => {
    const start = resolveStart("2026-10-05T00:00:00+00:00", "task");
    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([
      2026, 9, 5,
    ]);
  });

  it("filters by overlay and hidden calendar, never hiding a calendar-less event", () => {
    const entries = buildEntries({
      rows: [
        row({ item_id: "a", data: { calendar_id: "hidden" } }),
        row({ item_id: "b", data: {} }),
        row({ item_id: "t", item_type: "task", is_all_day: true }),
        row({ item_id: "c", data: { status: "cancelled" } }),
      ],
      exceptions: [],
      ...windowOf(new Date(2026, 9, 5), 1),
    });
    const kept = filterEntries(entries, {
      hiddenCalendars: new Set(["hidden"]),
      showTasks: false,
      showHabits: false,
      showFinance: false,
    });
    expect(kept.map((e) => e.sourceId)).toEqual(["b"]);
  });
});

describe("quick add", () => {
  const monday = new Date(2026, 9, 5, 8, 0);

  it("reads a day and a time out of the text", () => {
    const parsed = parseQuickAdd("Dentist tomorrow 3pm", monday);
    expect(parsed.title).toBe("Dentist");
    expect(parsed.start?.getDate()).toBe(6);
    expect(parsed.start?.getHours()).toBe(15);
  });

  it("does not read a bare number as a time", () => {
    const parsed = parseQuickAdd("Sprint 3 review", monday);
    expect(parsed.title).toContain("Sprint 3");
    expect(parsed.start?.getHours() ?? 0).not.toBe(3);
  });
});

describe("moving a whole series from one occurrence", () => {
  it("shifts the series' first start, not to the occurrence's date", async () => {
    const { shiftSeries } = await import("./use-calendar-data");
    const seriesStart = new Date(2026, 0, 5, 9, 0); // a January Monday
    const occurrence = new Date(2026, 9, 5, 9, 0); // an October Monday
    const moved = shiftSeries(
      { start: occurrence, occurrenceStart: occurrence, seriesStart },
      new Date(2026, 9, 5, 10, 0),
      new Date(2026, 9, 5, 10, 30),
    );
    expect(moved.start).toEqual(new Date(2026, 0, 5, 10, 0));
    expect(moved.end.getTime() - moved.start.getTime()).toBe(30 * 60_000);
  });

  it("carries the series start on every occurrence", () => {
    const entries = buildEntries({
      rows: [row({ data: { rrule: "FREQ=DAILY" } })],
      exceptions: [],
      ...windowOf(new Date(2026, 9, 7), 1),
    });
    expect(entries[0].seriesStart).toEqual(new Date(2026, 9, 5, 9, 0));
  });
});
