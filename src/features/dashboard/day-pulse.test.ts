import { describe, expect, it } from "vitest";
import type { DashboardData, Task } from "@/types";
import { dayPulse } from "./day-plan";

const task = (id: string, status: string) =>
  ({ id, title: id, status }) as Task;

describe("the day's pulse counts finished tasks", () => {
  it("moves as today's tasks are ticked off, with overdue still owed", () => {
    const data = {
      habits: [],
      tasksDueToday: [task("a", "done"), task("b", "todo")],
      overdueTasks: [task("c", "todo")],
    } as unknown as DashboardData;
    const pulse = dayPulse(data, new Date(2026, 8, 25, 12));
    expect(pulse.segments).toEqual([{ label: "Tasks", done: 1, total: 3 }]);
    expect(Math.round(pulse.percent)).toBe(33);
  });
});
