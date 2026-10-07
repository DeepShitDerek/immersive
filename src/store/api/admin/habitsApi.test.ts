import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it, vi } from "vitest";

/**
 * Habits load their whole log history, a page at a time, so
 * streaks, "best", the delete warning and the year heatmap see all of it.
 */

const HABITS = [
  {
    id: "h1",
    title: "Read",
    created_at: "2020-01-01T00:00:00Z",
    display_order: 0,
  },
  {
    id: "h2",
    title: "Run",
    created_at: "2020-01-01T00:00:00Z",
    display_order: 1,
  },
];
// 2,500 logs over the two habits: three pages at PostgREST's 1,000-row cap.
const LOGS = Array.from({ length: 2500 }, (_, i) => ({
  id: `l${String(i).padStart(5, "0")}`,
  habit_id: i % 5 === 0 ? "h2" : "h1",
  completed_date: new Date(Date.UTC(2020, 0, 1) + i * 86_400_000)
    .toISOString()
    .slice(0, 10),
  value: 1,
  note: null,
}));
const ranges: [number, number][] = [];

function query(table: string) {
  const state = { from: 0, to: Infinity };
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  Object.assign(builder, {
    select: chain,
    order: chain,
    is: chain,
    in: chain,
    range: (from: number, to: number) => {
      state.from = from;
      state.to = to;
      ranges.push([from, to]);
      return builder;
    },
    then: (resolve: (v: unknown) => void) =>
      resolve({
        data:
          table === "habits" ? HABITS : LOGS.slice(state.from, state.to + 1),
        error: null,
      }),
  });
  return builder;
}

vi.mock("@/supabase/client", () => ({
  supabase: {
    from: (table: string) => query(table),
    rpc: async () => ({ data: null, error: null }),
  },
}));

describe("getHabits", () => {
  it("loads every log, across pages, onto its habit", async () => {
    const { adminApi } = await import("./baseApi");
    const { habitsApi } = await import("./habitsApi");
    const store = configureStore({
      reducer: { [adminApi.reducerPath]: adminApi.reducer },
      middleware: (m) => m().concat(adminApi.middleware),
    });
    const result = await store.dispatch(
      habitsApi.endpoints.getHabits.initiate(),
    );
    expect(result.error).toBeUndefined();
    const habits = result.data!;
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
    expect(habits.map((h) => h.habit_logs!.length)).toEqual([2000, 500]);
    expect(habits[0].habit_logs!.every((log) => log.habit_id === "h1")).toBe(
      true,
    );
    // The oldest log, years back, is there — no 30-day window.
    expect(habits[0].habit_logs![0].completed_date).toBe("2020-01-02");
  });
});

describe("setHabitLog", () => {
  it("succeeds without an error, and updates both lists the page can show", async () => {
    const { adminApi } = await import("./baseApi");
    const { habitsApi } = await import("./habitsApi");
    const store = configureStore({
      reducer: { [adminApi.reducerPath]: adminApi.reducer },
      middleware: (m) => m().concat(adminApi.middleware),
    });
    await store.dispatch(habitsApi.endpoints.getHabits.initiate());
    await store.dispatch(
      habitsApi.endpoints.getHabits.initiate({ includeArchived: true }),
    );

    // It returned { data: undefined }. RTK Query checks the shape only in
    // development, where it logged "returned an object containing neither a
    // valid error and result" on every tick (the dev overlay showed it).
    vi.stubEnv("NODE_ENV", "development");
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await store.dispatch(
        habitsApi.endpoints.setHabitLog.initiate({
          habit_id: "h2",
          date: "2030-01-01",
          value: 1,
        }),
      );
      expect("error" in result && result.error).toBeFalsy();
      expect(logged).not.toHaveBeenCalled();
    } finally {
      logged.mockRestore();
      vi.unstubAllEnvs();
    }

    for (const args of [undefined, { includeArchived: true }] as const) {
      const habits = habitsApi.endpoints.getHabits.select(args)(
        store.getState(),
      ).data!;
      expect(
        habits
          .find((h) => h.id === "h2")!
          .habit_logs!.some((l) => l.completed_date === "2030-01-01"),
      ).toBe(true);
    }
  });
});
