import { supabase } from "@/supabase/client";
import type { Calendar, CalendarSettings, EventException } from "@/types";
import { adminApi } from "./baseApi";
import {
  NO_DB_ERROR,
  getAllQueryFn,
  saveQueryFn,
  deleteQueryFn,
} from "./query-helpers";

const DEFAULT_SETTINGS: CalendarSettings = {
  home_timezone: null,
  day_start_hour: 7,
  day_end_hour: 22,
  week_starts_on: 1,
  default_view: "week",
  show_tasks: true,
  show_habits: false,
  show_finance: false,
};

/**
 * Calendars, settings and the exceptions that let a series be edited.
 *
 * The range query itself stays in `calendarApi`; this owns the structural data
 * around it, which changes rarely and is read by every view.
 */
export const calendarSetupApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    getCalendars: builder.query<Calendar[], void>({
      queryFn: getAllQueryFn<Calendar>("calendars", [
        { column: "sort_order" },
        { column: "name" },
      ]),
      providesTags: ["CalendarSetup"],
    }),

    saveCalendar: builder.mutation<Calendar, Partial<Calendar>>({
      queryFn: saveQueryFn<Calendar>("calendars"),
      invalidatesTags: ["CalendarSetup", "Calendar"],
    }),

    deleteCalendar: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("calendars"),
      invalidatesTags: ["CalendarSetup", "Calendar"],
    }),

    getCalendarSettings: builder.query<CalendarSettings, void>({
      queryFn: async () => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { data, error } = await supabase
          .from("calendar_settings")
          .select("*")
          .maybeSingle();
        if (error) return { error };
        // Defaults rather than an error: a database that has run 010 but not
        // the seed still has no row, and the calendar should render.
        return { data: (data as CalendarSettings | null) ?? DEFAULT_SETTINGS };
      },
      providesTags: ["CalendarSetup"],
    }),

    saveCalendarSettings: builder.mutation<null, Partial<CalendarSettings>>({
      queryFn: async (changes) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return { error: { message: "Not signed in" } };
        const { error } = await supabase
          .from("calendar_settings")
          .upsert({ user_id: auth.user.id, ...changes });
        if (error) return { error };
        return { data: null };
      },
      invalidatesTags: ["CalendarSetup", "Calendar"],
    }),

    seedCalendarDefaults: builder.mutation<null, string | null>({
      queryFn: async (homeTimezone) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { error } = await supabase.rpc("seed_calendar_defaults", {
          home_tz: homeTimezone,
        });
        if (error) return { error };
        return { data: null };
      },
      invalidatesTags: ["CalendarSetup", "Calendar"],
    }),

    /**
     * Every exception, unfiltered by range.
     *
     * There are only ever a handful — one per occurrence somebody actually
     * moved or cancelled — and fetching them per window would mean refetching
     * on every navigation to answer a question the client can answer locally.
     */
    getEventExceptions: builder.query<EventException[], void>({
      queryFn: getAllQueryFn<EventException>("event_exceptions"),
      providesTags: ["Calendar"],
    }),

    saveEventException: builder.mutation<
      EventException,
      Partial<EventException>
    >({
      queryFn: async (exception) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return { error: { message: "Not signed in" } };

        // Upsert on the natural key: editing the same occurrence twice is a
        // correction, not a second exception, and the unique constraint would
        // otherwise surface as an opaque write failure.
        const { data, error } = await supabase
          .from("event_exceptions")
          .upsert(
            { user_id: auth.user.id, ...exception },
            { onConflict: "event_id,original_start" },
          )
          .select()
          .single();
        if (error) return { error };
        return { data: data as EventException };
      },
      invalidatesTags: ["Calendar"],
    }),

    deleteEventException: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("event_exceptions"),
      invalidatesTags: ["Calendar"],
    }),
  }),
});

export const {
  useGetCalendarsQuery,
  useSaveCalendarMutation,
  useDeleteCalendarMutation,
  useGetCalendarSettingsQuery,
  useSaveCalendarSettingsMutation,
  useSeedCalendarDefaultsMutation,
  useGetEventExceptionsQuery,
  useSaveEventExceptionMutation,
  useDeleteEventExceptionMutation,
} = calendarSetupApi;
