import { supabase } from "@/supabase/client";
import type { NavLink, SiteContent } from "@/types";
import { MOCK_SITE_IDENTITY } from "@/lib/fallback-data";
import { adminApi } from "./baseApi";
import { publicApi } from "../publicApi";
import {
  NO_DB_ERROR,
  getAllQueryFn,
  saveQueryFn,
  deleteQueryFn,
} from "./query-helpers";

/** Site identity/settings, navigation links, and the security lockdown level. */
export const siteApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    getSiteSettings: builder.query<SiteContent, void>({
      queryFn: async () => {
        if (!supabase) return { data: MOCK_SITE_IDENTITY };
        const { data, error } = await supabase
          .from("site_identity")
          .select("*")
          .single();
        if (error) return { error };
        return { data: data as SiteContent };
      },
      providesTags: ["SiteContent"],
    }),
    updateSiteSettings: builder.mutation<null, Partial<SiteContent>>({
      queryFn: async (updates) => {
        if (!supabase)
          return {
            error: {
              message:
                "Static mode: Supabase is not configured. Settings changes are preview-only and won't persist.",
            },
          };
        const { data, error } = await supabase
          .from("site_identity")
          .update(updates)
          .eq("id", 1)
          .select()
          .single();
        if (error) return { error };
        if (!data)
          return {
            error: {
              message:
                "No rows were updated. Check that the site_identity row exists and RLS policies allow writes.",
            },
          };
        return { data: null };
      },
      async onQueryStarted(updates, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          siteApi.util.updateQueryData(
            "getSiteSettings",
            undefined,
            (draft) => {
              Object.assign(draft, updates);
            },
          ),
        );
        dispatch(
          publicApi.util.updateQueryData(
            "getSiteIdentity",
            undefined,
            (draft) => {
              Object.assign(draft, updates);
            },
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
      invalidatesTags: ["SiteContent", "Navigation"],
    }),
    getNavLinksAdmin: builder.query<NavLink[], void>({
      queryFn: getAllQueryFn<NavLink>("navigation_links", [
        { column: "display_order" },
      ]),
      providesTags: ["Navigation"],
    }),
    saveNavLink: builder.mutation<NavLink, Partial<NavLink>>({
      queryFn: saveQueryFn<NavLink>("navigation_links"),
      invalidatesTags: ["Navigation"],
    }),
    deleteNavLink: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("navigation_links"),
      invalidatesTags: ["Navigation"],
    }),
    getSecuritySettings: builder.query<{ lockdown_level: number }, void>({
      queryFn: async () => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { data, error } = await supabase
          .from("security_settings")
          .select("lockdown_level")
          .single();
        if (error) return { error };
        return { data };
      },
      providesTags: ["SiteSettings"],
    }),
    updateLockdownLevel: builder.mutation<null, number>({
      queryFn: async (level) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { error } = await supabase
          .from("security_settings")
          .update({ lockdown_level: level })
          .eq("id", 1);
        if (error) return { error };
        return { data: null };
      },
      invalidatesTags: ["SiteSettings"],
    }),
  }),
});

export const {
  useGetSiteSettingsQuery,
  useUpdateSiteSettingsMutation,
  useGetNavLinksAdminQuery,
  useSaveNavLinkMutation,
  useDeleteNavLinkMutation,
  useGetSecuritySettingsQuery,
  useUpdateLockdownLevelMutation,
} = siteApi;
