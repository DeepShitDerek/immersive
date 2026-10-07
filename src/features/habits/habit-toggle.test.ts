import { describe, expect, it } from "vitest";
import type { Habit } from "@/types";
import { indexLogs, toggledValue } from "./habit-progress";

const habit = (h: Partial<Habit>): Habit =>
  ({
    id: "h",
    title: "h",
    created_at: "2026-01-01T00:00:00Z",
    habit_logs: [],
    ...h,
  }) as Habit;
const log = (completed_date: string, value: number) => ({
  id: completed_date,
  habit_id: "h",
  completed_date,
  value,
});

describe("tapping a day in the history grid", () => {
  it("completes a partial day of a quantified habit instead of deleting it", () => {
    const water = habit({
      target_value: 8,
      habit_logs: [log("2026-09-20", 3)],
    });
    expect(toggledValue(water, indexLogs(water), "2026-09-20")).toBe(8);
  });

  it("clears a done day, and completes an empty one", () => {
    const water = habit({
      target_value: 8,
      habit_logs: [log("2026-09-20", 8)],
    });
    expect(toggledValue(water, indexLogs(water), "2026-09-20")).toBe(0);
    expect(toggledValue(water, indexLogs(water), "2026-09-21")).toBe(8);
  });

  it("treats a plain check-in as a target of one", () => {
    const read = habit({ habit_logs: [log("2026-09-20", 1)] });
    expect(toggledValue(read, indexLogs(read), "2026-09-20")).toBe(0);
    expect(toggledValue(read, indexLogs(read), "2026-09-21")).toBe(1);
  });

  it("records or clears a slip on a quit habit", () => {
    const smoking = habit({ kind: "quit", habit_logs: [log("2026-09-20", 1)] });
    expect(toggledValue(smoking, indexLogs(smoking), "2026-09-20")).toBe(0);
    expect(toggledValue(smoking, indexLogs(smoking), "2026-09-21")).toBe(1);
  });
});
