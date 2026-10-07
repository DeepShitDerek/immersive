import { supabase } from "@/supabase/client";
import type { VisitorAnalytics } from "@/types";
import { adminApi } from "./baseApi";
import { NO_DB_ERROR } from "./query-helpers";

/**
 * Visitor analytics.
 *
 * Both endpoints are RPCs rather than table reads. `get_visitor_analytics`
 * aggregates in Postgres because the alternative is shipping every row of a
 * year's traffic to the browser to count it, and both functions re-check
 * `is_admin()` server-side — `SECURITY DEFINER` bypasses RLS, so the guard has
 * to live inside the function rather than relying on the policy it stepped
 * over.
 */
export const analyticsApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    getVisitorAnalytics: builder.query<
      VisitorAnalytics,
      { days: number; withBots: boolean }
    >({
      queryFn: async ({ days, withBots }) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { data, error } = await supabase.rpc("get_visitor_analytics", {
          days,
          with_bots: withBots,
        });
        if (error) return { error };
        return { data: data as VisitorAnalytics };
      },
      providesTags: ["Visitors"],
    }),

    pruneSiteVisits: builder.mutation<number, number>({
      queryFn: async (keepDays) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { data, error } = await supabase.rpc("prune_site_visits", {
          keep_days: keepDays,
        });
        if (error) return { error };
        return { data: (data as number) ?? 0 };
      },
      invalidatesTags: ["Visitors"],
    }),
  }),
});

export const { useGetVisitorAnalyticsQuery, usePruneSiteVisitsMutation } =
  analyticsApi;
