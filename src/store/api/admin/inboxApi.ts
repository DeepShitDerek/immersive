import { supabase } from "@/supabase/client";
import type { ContactSubmission, IntegrationSettings } from "@/types";
import { adminApi } from "./baseApi";
import {
  NO_DB_ERROR,
  getAllQueryFn,
  updateQueryFn,
  deleteQueryFn,
} from "./query-helpers";

/**
 * Contact submissions, and the integration settings that notify you about them.
 *
 * `contact_submissions` has had admin SELECT and DELETE policies since the
 * schema was written and no interface at all, so messages accumulated where
 * nobody could read them. The UPDATE policy the marking actions need is in
 * `db/schema.sql`.
 *
 * `integration_settings` is a separate table from `site_identity` on purpose:
 * that one is `FOR SELECT USING (true)`, so a webhook URL stored there would
 * be world-readable, which is the exposure the migration exists to remove.
 */
export const inboxApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    getContactSubmissions: builder.query<ContactSubmission[], void>({
      queryFn: getAllQueryFn<ContactSubmission>("contact_submissions", [
        { column: "created_at", ascending: false },
      ]),
      providesTags: ["Inbox"],
    }),

    updateContactSubmission: builder.mutation<
      ContactSubmission,
      Partial<ContactSubmission> & { id: string }
    >({
      queryFn: updateQueryFn<ContactSubmission>("contact_submissions"),
      /**
       * Optimistic because every one of these is a one-click state flip on a
       * row already on screen — read, replied, archived. Waiting for a round
       * trip to redraw a checkbox reads as lag.
       */
      async onQueryStarted(patch, { dispatch, queryFulfilled }) {
        const undo = dispatch(
          inboxApi.util.updateQueryData(
            "getContactSubmissions",
            undefined,
            (draft) => {
              const row = draft.find((entry) => entry.id === patch.id);
              if (row) Object.assign(row, patch);
            },
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          undo.undo();
        }
      },
      invalidatesTags: ["Inbox"],
    }),

    /**
     * Mark several at once — "mark all read" on a filtered view.
     *
     * One statement rather than N mutations: the list is redrawn once, and a
     * partial failure cannot leave half the inbox marked.
     */
    updateContactSubmissions: builder.mutation<
      null,
      { ids: string[]; changes: Partial<ContactSubmission> }
    >({
      queryFn: async ({ ids, changes }) => {
        if (!supabase) return { error: NO_DB_ERROR };
        if (ids.length === 0) return { data: null };
        const { error } = await supabase
          .from("contact_submissions")
          .update(changes)
          .in("id", ids);
        if (error) return { error };
        return { data: null };
      },
      invalidatesTags: ["Inbox"],
    }),

    deleteContactSubmission: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("contact_submissions"),
      invalidatesTags: ["Inbox"],
    }),

    getIntegrationSettings: builder.query<IntegrationSettings, void>({
      queryFn: async () => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { data, error } = await supabase
          .from("integration_settings")
          .select("*")
          .eq("id", 1)
          .maybeSingle();
        if (error) return { error };
        // `maybeSingle` rather than `single`: the row is seeded by the schema,
        // but a database set up from an older schema has no table at all,
        // and an inbox that cannot show its notification settings should still
        // show the messages.
        return {
          data: (data as IntegrationSettings | null) ?? {
            id: 1,
            contact_webhook_url: null,
            notify_on_contact: true,
            visit_webhook_url: null,
            // Off, matching the column default: a ping per page view is noise.
            notify_on_visit: false,
          },
        };
      },
      providesTags: ["Integrations"],
    }),

    updateIntegrationSettings: builder.mutation<
      null,
      Partial<IntegrationSettings>
    >({
      queryFn: async (changes) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { error } = await supabase
          .from("integration_settings")
          .update(changes)
          .eq("id", 1);
        if (error) return { error };
        return { data: null };
      },
      invalidatesTags: ["Integrations"],
    }),
  }),
});

export const {
  useGetContactSubmissionsQuery,
  useUpdateContactSubmissionMutation,
  useUpdateContactSubmissionsMutation,
  useDeleteContactSubmissionMutation,
  useGetIntegrationSettingsQuery,
  useUpdateIntegrationSettingsMutation,
} = inboxApi;
