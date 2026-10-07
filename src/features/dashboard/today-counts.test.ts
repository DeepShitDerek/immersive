import { describe, expect, it } from "vitest";
import type { DashboardData, Habit, Task } from "@/types";
import { todayCounts } from "./dashboard-page";

const today = "2026-10-05";
const base = {
  overdueTasks: [],
  tasksDueToday: [],
  focusMinutesToday: 0,
  dailyExpenses: [],
  dailyEarnings: [],
  habits: [],
  todaysEvents: [],
  unreadMessages: 0,
  reviewsDue: 0,
} as DashboardData;

describe("todayCounts", () => {
  it("counts tasks due today, overdue tasks and today's habits", () => {
    const counts = todayCounts(
      {
        ...base,
        overdueTasks: [{ id: "o", title: "o", status: "todo" } as Task],
        tasksDueToday: [
          { id: "a", title: "a", status: "done" } as Task,
          { id: "b", title: "b", status: "todo" } as Task,
        ],
        habits: [
          {
            id: "h",
            title: "h",
            schedule: "daily",
            target_value: 1,
            habit_logs: [
              { id: "l", habit_id: "h", completed_date: today, value: 1 },
            ],
          },
          {
            id: "g",
            title: "g",
            schedule: "daily",
            target_value: 8,
            habit_logs: [
              { id: "m", habit_id: "g", completed_date: today, value: 3 },
            ],
          },
        ] as unknown as Habit[],
      },
      today,
    );
    // Done: one task and the satisfied habit; 3 of 8 glasses is not done yet.
    expect(counts).toEqual({ total: 5, done: 2 });
  });

  it("is zero of zero on an empty day", () => {
    expect(todayCounts(base, today)).toEqual({ total: 0, done: 0 });
  });
});
