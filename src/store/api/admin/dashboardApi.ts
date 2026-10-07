import { format, subDays } from "date-fns";
import { supabase } from "@/supabase/client";
import type {
  Calendar,
  CalendarRow,
  DashboardData,
  EventException,
} from "@/types";
import { todaysEvents } from "@/features/dashboard/todays-events";
import { adminApi } from "./baseApi";
import { NO_DB_ERROR } from "./query-helpers";

export const dashboardApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardData: builder.query<DashboardData, void>({
      queryFn: async () => {
        if (!supabase) return { error: NO_DB_ERROR };

        const now = new Date();
        const todayISO = format(now, "yyyy-MM-dd");
        const sevenDaysAgoISO = format(subDays(now, 7), "yyyy-MM-dd");

        /*
          Only what the page shows.
        */
        const promises = [
          supabase
            .from("tasks")
            .select("*")
            .lt("due_date", todayISO)
            .neq("status", "done"),
          supabase
            .from("tasks")
            .select("*")
            .eq("due_date", todayISO)
            .order("created_at"),
          /*
            `money_day_flows` gives earned and spent per day from the ledger, for
            the last seven days, which is all the dashboard shows.

            It is the same function the calendar's `get_calendar_data` calls, so
            the two cannot disagree: $2,000 moved between two of your own
            accounts is neither earned nor spent in either place.
          */
          supabase.rpc("money_day_flows", {
            p_from: sevenDaysAgoISO,
            p_to: todayISO,
          }),
          // The workbench answers "what needs me now", so it needs the four
          // modules that can be *behind*: habits not yet done, events already
          // starting, messages nobody has read, and reviews coming due.
          supabase
            .from("habits")
            .select(`*, habit_logs(id, habit_id, completed_date, value, note)`)
            .is("archived_at", null),
          // Through the calendar's own pipeline, so repeating events,
          // moved or cancelled occurrences and hidden calendars come out
          // exactly as the calendar shows them.
          (async () => {
            const [rowsRes, exceptionsRes, calendarsRes] = await Promise.all([
              supabase.rpc("get_calendar_data", {
                start_date_param: todayISO,
                end_date_param: todayISO,
              }),
              supabase.from("event_exceptions").select("*"),
              supabase.from("calendars").select("id, is_visible"),
            ]);
            const failed =
              rowsRes.error ?? exceptionsRes.error ?? calendarsRes.error;
            if (failed) return { data: [], error: failed };
            return {
              data: todaysEvents({
                rows: (rowsRes.data ?? []) as CalendarRow[],
                exceptions: (exceptionsRes.data ?? []) as EventException[],
                calendars: (calendarsRes.data ?? []) as Pick<
                  Calendar,
                  "id" | "is_visible"
                >[],
                // Local midnights, as real instants: a bare date string would be
                // read in UTC and put "today" at the wrong hours.
                dayStart: new Date(
                  now.getFullYear(),
                  now.getMonth(),
                  now.getDate(),
                ),
                dayEnd: new Date(
                  now.getFullYear(),
                  now.getMonth(),
                  now.getDate() + 1,
                ),
              }),
            };
          })(),
          supabase
            .from("contact_submissions")
            .select("id", { count: "exact", head: true })
            .eq("is_read", false)
            .eq("is_archived", false),
          supabase
            .from("learning_topics")
            .select("id", { count: "exact", head: true })
            // `due_date` NULL means never reviewed — new, not overdue — so the
            // filter is on a date that has arrived, not on the absence of one.
            .lte("due_date", todayISO)
            .is("archived_at", null),
          // Work sessions logged since local midnight. `start_time`
          // is written when the session is logged, i.e. when it ended.
          supabase
            .from("focus_logs")
            .select("duration_minutes")
            .eq("mode", "work")
            .gte(
              "start_time",
              new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
              ).toISOString(),
            ),
        ];

        const results = await Promise.all(promises);
        const errors = results.map((r) => r.error).filter(Boolean);

        /*
          Degrade, do not blank. A dashboard showing most of its parts is
          useful; one that goes empty because a single count failed is not.
          Only a total failure is reported as an error, because
          that means the connection or the session is gone, and pretending
          otherwise would show an empty page as though the day were clear.
        */
        if (errors.length === results.length) return { error: errors[0] };

        const [
          { data: overdueTasksData },
          { data: tasksDueTodayData },
          { data: dayMoneyData },
          { data: habitsData },
          { data: todaysEventsData },
          { count: unreadMessages },
          { count: reviewsDue },
          { data: focusData },
        ] = results as {
          data: unknown;
          count?: number | null;
          error?: unknown;
        }[];

        /**
         * One row per day that had any money on it, already summed and already
         * in the base currency — the RPC leaves out transfers between your own
         * accounts, pending rows, and anything with no exchange rate for its
         * date.
         *
         * `earned` and `spent` arrive as NUMERIC, which PostgREST renders as a
         * string to preserve precision, so both are coerced here rather than at
         * each use.
         */
        type DayMoney = {
          day: string;
          earned: number | string;
          spent: number | string;
        };

        const dayMoney = ((dayMoneyData ?? []) as DayMoney[]).map((row) => ({
          day: row.day,
          earned: Number(row.earned) || 0,
          spent: Number(row.spent) || 0,
        }));

        const dailyEarnings = dayMoney.map((row) => ({
          day: row.day,
          total: row.earned,
        }));
        const dailyExpenses = dayMoney.map((row) => ({
          day: row.day,
          total: row.spent,
        }));

        const data: DashboardData = {
          overdueTasks:
            (overdueTasksData as DashboardData["overdueTasks"]) || [],
          tasksDueToday:
            (tasksDueTodayData as DashboardData["tasksDueToday"]) || [],
          dailyExpenses,
          dailyEarnings,
          habits: (habitsData as DashboardData["habits"]) || [],
          todaysEvents:
            (todaysEventsData as DashboardData["todaysEvents"]) || [],
          // `head: true` returns a count and no rows, so these cost nothing to
          // ask for beyond the round trip.
          unreadMessages: unreadMessages ?? 0,
          reviewsDue: reviewsDue ?? 0,
          focusMinutesToday: (
            (focusData as { duration_minutes: number }[] | null) ?? []
          ).reduce((sum, row) => sum + (row.duration_minutes ?? 0), 0),
        };

        return { data };
      },
      // Everything the dashboard shows. Task and event changes invalidate
      // "Calendar", habit logs "Dashboard", messages "Inbox"; without these the
      // dashboard kept a stale copy for up to a minute.
      providesTags: [
        "Dashboard",
        "AdminPosts",
        "Notes",
        "Tasks",
        "Calendar",
        "Habits",
        "Inbox",
        "MoneyLedger",
        "Learning",
        "PortfolioContent",
      ],
    }),
  }),
});

export const { useGetDashboardDataQuery } = dashboardApi;
