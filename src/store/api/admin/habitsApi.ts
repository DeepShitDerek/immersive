import { supabase } from "@/supabase/client";
import type { Habit, HabitLog } from "@/types";
import { adminApi } from "./baseApi";
import { dashboardApi } from "./dashboardApi";
import { NO_DB_ERROR, saveQueryFn } from "./query-helpers";

/** PostgREST's default row cap; a shorter page means the last one. */
const LOG_PAGE = 1000;

export const habitsApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    getHabits: builder.query<Habit[], { includeArchived?: boolean } | void>({
      queryFn: async (args) => {
        if (!supabase) return { error: NO_DB_ERROR };
        let query = supabase
          .from("habits")
          .select("*")
          .order("display_order", { ascending: true })
          .order("created_at", { ascending: true });

        // Archived habits keep their history and are simply out of the way.
        if (!args?.includeArchived) query = query.is("archived_at", null);

        const { data: habits, error } = await query;
        if (error) return { error };
        if (!habits?.length) return { data: [] };

        /*
          The whole history, not the last 30 days. Streaks walk back
          until a missed day, "best" is the longest run on record, the delete
          warning counts every recorded day and the heatmap spans the year: a
          30-day window capped all four without saying so. Fetched a page at a
          time, because PostgREST stops at 1,000 rows without an error.
        */
        const logs: HabitLog[] = [];
        const ids = habits.map((habit) => habit.id);
        for (let from = 0; ; from += LOG_PAGE) {
          const { data: page, error: logError } = await supabase
            .from("habit_logs")
            .select("id, habit_id, completed_date, value, note")
            .in("habit_id", ids)
            .order("completed_date", { ascending: true })
            .order("id", { ascending: true })
            .range(from, from + LOG_PAGE - 1);
          if (logError) return { error: logError };
          logs.push(...((page ?? []) as HabitLog[]));
          if (!page || page.length < LOG_PAGE) break;
        }
        const byHabit = new Map<string, HabitLog[]>();
        for (const log of logs) {
          const list = byHabit.get(log.habit_id) ?? [];
          list.push(log);
          byHabit.set(log.habit_id, list);
        }
        return {
          data: habits.map((habit) => ({
            ...habit,
            habit_logs: byHabit.get(habit.id) ?? [],
          })) as Habit[],
        };
      },
      providesTags: ["Habits"],
    }),
    archiveHabit: builder.mutation<null, { id: string; archived: boolean }>({
      queryFn: async ({ id, archived }) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { error } = await supabase
          .from("habits")
          .update({
            archived_at: archived ? new Date().toISOString() : null,
            is_active: !archived,
          })
          .eq("id", id);
        if (error) return { error };
        return { data: null };
      },
      invalidatesTags: ["Habits"],
    }),
    saveHabit: builder.mutation<Habit, Partial<Habit>>({
      queryFn: saveQueryFn<Habit>("habits"),
      invalidatesTags: ["Habits"],
    }),
    deleteHabit: builder.mutation<null, string>({
      queryFn: async (id) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { error } = await supabase.from("habits").delete().eq("id", id);
        if (error) return { error };
        return { data: null };
      },
      invalidatesTags: ["Habits"],
    }),
    /**
     * Record how much was done on a date. Zero removes the log, because "not
     * done" is the absence of a row rather than a row of nothing.
     *
     * One round trip through `set_habit_log`, which upserts. The previous
     * select-then-insert double-counted two taps that raced, which a quantified
     * habit makes easy to trigger.
     */
    setHabitLog: builder.mutation<
      null,
      { habit_id: string; date: string; value: number }
    >({
      queryFn: async ({ habit_id, date, value }) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { error } = await supabase.rpc("set_habit_log", {
          target_habit_id: habit_id,
          target_date: date,
          new_value: value,
        });
        if (error) return { error };
        return { data: null };
      },
      async onQueryStarted(
        { habit_id, date, value },
        { dispatch, queryFulfilled },
      ) {
        // Both lists the page can be showing: Today reads the active habits,
        // History also the archived ones (for "Show archived"). Patching only
        // the first left a tap in History unchanged until a reload.
        const patches = ([undefined, { includeArchived: true }] as const).map(
          (args) =>
            dispatch(
              habitsApi.util.updateQueryData("getHabits", args, (draft) => {
                const habit = draft.find((h) => h.id === habit_id);
                if (!habit) return;
                if (!habit.habit_logs) habit.habit_logs = [];
                const index = habit.habit_logs.findIndex(
                  (l) => l.completed_date === date,
                );
                if (value <= 0) {
                  if (index !== -1) habit.habit_logs.splice(index, 1);
                } else if (index !== -1) {
                  habit.habit_logs[index].value = value;
                } else {
                  habit.habit_logs.push({
                    id: `optimistic-${habit_id}-${date}`,
                    habit_id,
                    completed_date: date,
                    value,
                  });
                }
              }),
            ),
        );
        // The dashboard's Today list logs habits too: patch its copy the same
        // way, so a tap there lands at once rather than after the refetch.
        patches.push(
          dispatch(
            dashboardApi.util.updateQueryData(
              "getDashboardData",
              undefined,
              (draft) => {
                const habit = draft.habits.find((h) => h.id === habit_id);
                if (!habit) return;
                if (!habit.habit_logs) habit.habit_logs = [];
                const index = habit.habit_logs.findIndex(
                  (l) => l.completed_date === date,
                );
                if (value <= 0) {
                  if (index !== -1) habit.habit_logs.splice(index, 1);
                } else if (index !== -1) {
                  habit.habit_logs[index].value = value;
                } else {
                  habit.habit_logs.push({
                    id: `optimistic-${habit_id}-${date}`,
                    habit_id,
                    completed_date: date,
                    value,
                  });
                }
              },
            ),
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((patch) => patch.undo());
        }
      },
      // Both copies are patched above; the dashboard still refetches.
      invalidatesTags: ["Dashboard"],
    }),
    updateHabitOrder: builder.mutation<null, string[]>({
      queryFn: async (habitIds) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { error } = await supabase.rpc("update_habit_order", {
          habit_ids: habitIds,
        });
        if (error) return { error };
        return { data: null };
      },
      invalidatesTags: ["Habits"],
    }),
    logFocusSession: builder.mutation<
      null,
      { duration_minutes: number; task_id?: string | null; mode: string }
    >({
      queryFn: async (data) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { error } = await supabase.from("focus_logs").insert({
          duration_minutes: data.duration_minutes,
          task_id: data.task_id,
          mode: data.mode,
          start_time: new Date().toISOString(),
          completed: true,
        });
        if (error) return { error };
        return { data: null };
      },
      invalidatesTags: ["Dashboard"],
    }),
  }),
});

export const {
  useGetHabitsQuery,
  useSaveHabitMutation,
  useDeleteHabitMutation,
  useSetHabitLogMutation,
  useArchiveHabitMutation,
  useUpdateHabitOrderMutation,
  useLogFocusSessionMutation,
} = habitsApi;
