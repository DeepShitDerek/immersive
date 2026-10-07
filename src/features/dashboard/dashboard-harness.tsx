"use client";

import { format, subDays } from "date-fns";
import type { CalendarSettings, DashboardData, Habit, Task } from "@/types";
import { dashboardApi } from "@/store/api/admin/dashboardApi";
import { tasksApi } from "@/store/api/admin/tasksApi";
import { habitsApi } from "@/store/api/admin/habitsApi";
import { calendarSetupApi } from "@/store/api/admin/calendarSetupApi";
import { moneyApi } from "@/features/money/data/money-api";
import DashboardPage from "./dashboard-page";

/**
 * The real Dashboard in the workspace frame, its reads and the three writes
 * it makes (tick a task, add a task, log a habit) answered in memory, so the
 * Today list can be exercised in a browser. Placeholder content around now;
 * nothing persists past a reload. Injected when this module loads, which only
 * the harness route does. State is on window.__dashboard for probes.
 */
const now = new Date();
const today = format(now, "yyyy-MM-dd");
const at = (h: number, m = 0) => {
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const hour = now.getHours();

const tasks = new Map<string, Task>(
  (
    [
      {
        id: "o1",
        title: "Overdue sample task",
        status: "todo",
        due_date: format(subDays(now, 2), "yyyy-MM-dd"),
      },
      {
        id: "o2",
        title: "Another overdue task",
        status: "todo",
        due_date: format(subDays(now, 1), "yyyy-MM-dd"),
      },
      { id: "d1", title: "Due today, open", status: "todo", due_date: today },
      {
        id: "d2",
        title: "Due today, also open",
        status: "todo",
        due_date: today,
      },
      { id: "d3", title: "Due today, done", status: "done", due_date: today },
    ] as Task[]
  ).map((t) => [t.id, t]),
);
let nextId = 1;

const habits: Habit[] = [
  {
    id: "h1",
    title: "Sample daily habit",
    schedule: "daily",
    kind: "build",
    target_value: 1,
    habit_logs: [],
  },
  {
    id: "h2",
    title: "Sample counted habit",
    schedule: "daily",
    kind: "build",
    target_value: 8,
    step: 1,
    unit: "glasses",
    habit_logs: [{ id: "l1", habit_id: "h2", completed_date: today, value: 3 }],
  },
] as unknown as Habit[];

function data(): DashboardData {
  const list = [...tasks.values()];
  return {
    overdueTasks: list.filter(
      (t) => t.due_date! < today && t.status !== "done",
    ),
    tasksDueToday: list.filter((t) => t.due_date === today),
    focusMinutesToday: 0,
    dailyExpenses: Array.from({ length: 7 }, (_, i) => ({
      day: format(subDays(now, 6 - i), "yyyy-MM-dd"),
      total: 20 + i * 5,
    })),
    dailyEarnings: Array.from({ length: 7 }, (_, i) => ({
      day: format(subDays(now, 6 - i), "yyyy-MM-dd"),
      total: i === 3 ? 400 : 0,
    })),
    habits: structuredClone(habits),
    todaysEvents: [
      {
        id: "ev1",
        title: "Sample event now",
        start_time: at(hour, 0),
        end_time: at(hour + 1, 0),
        is_all_day: false,
      },
      {
        id: "ev2",
        title: "Sample later event",
        start_time: at(Math.min(hour + 2, 22), 0),
        end_time: at(Math.min(hour + 2, 22), 45),
        is_all_day: false,
      },
    ],
    unreadMessages: 2,
    reviewsDue: 4,
  };
}
(globalThis as unknown as { __dashboard: unknown }).__dashboard = {
  tasks,
  habits,
};

dashboardApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (b) => ({
    getDashboardData: b.query<DashboardData, void>({
      queryFn: async () => ({ data: data() }),
      providesTags: ["Dashboard", "Tasks", "Calendar", "Habits"],
    }),
  }),
});
tasksApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (b) => ({
    addTask: b.mutation<Task, Partial<Task>>({
      queryFn: async (input) => {
        const task = { ...input, id: `new-${nextId++}` } as Task;
        tasks.set(task.id, task);
        return { data: task };
      },
      invalidatesTags: ["Tasks", "Calendar"],
    }),
    updateTask: b.mutation<Task, Partial<Task>>({
      queryFn: async (input) => {
        const task = { ...tasks.get(input.id!)!, ...input } as Task;
        tasks.set(task.id, task);
        return { data: task };
      },
      invalidatesTags: ["Tasks", "Calendar"],
    }),
  }),
});
habitsApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (b) => ({
    setHabitLog: b.mutation<
      null,
      { habit_id: string; date: string; value: number }
    >({
      queryFn: async ({ habit_id, date, value }) => {
        const habit = habits.find((h) => h.id === habit_id)!;
        habit.habit_logs = (habit.habit_logs ?? []).filter(
          (l) => l.completed_date !== date,
        );
        if (value > 0)
          habit.habit_logs.push({
            id: `l-${nextId++}`,
            habit_id,
            completed_date: date,
            value,
          } as never);
        return { data: null };
      },
      invalidatesTags: ["Dashboard"],
    }),
  }),
});
calendarSetupApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (b) => ({
    getCalendarSettings: b.query<CalendarSettings, void>({
      queryFn: async () => ({
        data: {
          day_start_hour: 7,
          day_end_hour: 22,
          week_starts_on: 1,
          default_view: "week",
          show_tasks: true,
          show_habits: false,
          show_finance: false,
        },
      }),
    }),
  }),
});
moneyApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (b) => ({
    getMoneySettings: b.query<{ baseCurrency: string; saved: boolean }, void>({
      queryFn: async () => ({ data: { baseCurrency: "CAD", saved: true } }),
    }),
  }),
});

export function DashboardHarness() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-secondary/30">
      <header className="sticky top-0 z-chrome flex h-14 shrink-0 items-center border-b bg-card px-4 sm:px-6">
        Workspace
      </header>
      <main className="flex-1 px-4 pb-6 pt-6 sm:px-6">
        <div className="mx-auto w-full max-w-wide">
          <DashboardPage />
        </div>
      </main>
    </div>
  );
}
