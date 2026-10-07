import { supabase } from "@/supabase/client";
import type { CalendarRow, Event } from "@/types";
import { adminApi } from "./baseApi";
import {
  NO_DB_ERROR,
  insertQueryFn,
  updateQueryFn,
  deleteQueryFn,
} from "./query-helpers";

export const calendarApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Everything in a date range, as rows.
     *
     * Recurring series come back unexpanded with their rule attached — the
     * client expands them, because a weekly 09:00 standup is 09:00 *local* on
     * both sides of a clock change, which only the browser knows.
     */
    getCalendarData: builder.query<
      CalendarRow[],
      { start: string; end: string }
    >({
      queryFn: async ({ start, end }) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { data, error } = await supabase.rpc("get_calendar_data", {
          start_date_param: start,
          end_date_param: end,
        });
        if (error) return { error };
        return { data: (data ?? []) as CalendarRow[] };
      },
      providesTags: ["Calendar", "Tasks", "MoneyLedger", "MoneyPlan"],
    }),
    addEvent: builder.mutation<Event, Partial<Event>>({
      queryFn: insertQueryFn<Event>("events"),
      invalidatesTags: ["Calendar"],
    }),
    updateEvent: builder.mutation<Event, Partial<Event>>({
      queryFn: updateQueryFn<Event>("events"),
      invalidatesTags: ["Calendar"],
    }),
    deleteEvent: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("events"),
      invalidatesTags: ["Calendar"],
    }),
  }),
});

export const {
  useGetCalendarDataQuery,
  useAddEventMutation,
  useUpdateEventMutation,
  useDeleteEventMutation,
} = calendarApi;
