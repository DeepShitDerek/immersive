import { supabase } from "@/supabase/client";
import type { ThinkingMap, ThinkingMapSummary } from "@/types";
import { adminApi } from "./baseApi";
import { NO_DB_ERROR, deleteQueryFn } from "./query-helpers";

/**
 * Maps endpoints.
 *
 * The list projects away `doc` — a large map is hundreds of kilobytes and the
 * list only needs counts. A map's document is fetched when it is opened.
 *
 * Saves are revision-checked: `saveMapDoc` updates only the row still at the
 * revision the editor loaded, and reports `CONFLICT` when another tab or
 * device has saved since, instead of silently overwriting its work.
 */

const SUMMARY_COLUMNS =
  "id,name,node_count,edge_count,is_pinned,revision,created_at,updated_at";

export const MAP_CONFLICT = "CONFLICT";

interface SaveMapDocArgs {
  id: string;
  expectedRevision: number;
  name: string;
  doc: unknown;
  nodeCount: number;
  edgeCount: number;
}

const mapsApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    getMaps: builder.query<ThinkingMapSummary[], void>({
      queryFn: async () => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { data, error } = await supabase
          .from("thinking_maps")
          .select(SUMMARY_COLUMNS)
          .order("is_pinned", { ascending: false })
          .order("updated_at", { ascending: false });
        if (error) return { error };
        return { data: (data ?? []) as ThinkingMapSummary[] };
      },
      providesTags: ["ThinkingMaps"],
    }),

    getMap: builder.query<ThinkingMap, string>({
      queryFn: async (id) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { data, error } = await supabase
          .from("thinking_maps")
          .select("*")
          .eq("id", id)
          .single();
        if (error) return { error };
        return { data: data as ThinkingMap };
      },
      // Deliberately not tagged: the open editor owns the live graph, and a
      // refetch mid-edit would replace it with the last saved copy.
      keepUnusedDataFor: 0,
    }),

    createMap: builder.mutation<ThinkingMap, { name: string; doc: unknown }>({
      queryFn: async ({ name, doc }) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { data, error } = await supabase
          .from("thinking_maps")
          .insert({ name, doc })
          .select("*")
          .single();
        if (error) return { error };
        return { data: data as ThinkingMap };
      },
      invalidatesTags: ["ThinkingMaps"],
    }),

    saveMapDoc: builder.mutation<ThinkingMapSummary, SaveMapDocArgs>({
      queryFn: async ({
        id,
        expectedRevision,
        name,
        doc,
        nodeCount,
        edgeCount,
      }) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { data, error } = await supabase
          .from("thinking_maps")
          .update({
            name,
            doc,
            node_count: nodeCount,
            edge_count: edgeCount,
            revision: expectedRevision + 1,
          })
          .eq("id", id)
          .eq("revision", expectedRevision)
          .select(SUMMARY_COLUMNS);
        if (error) return { error };
        const row = (data ?? [])[0] as ThinkingMapSummary | undefined;
        if (!row) {
          return {
            error: {
              code: MAP_CONFLICT,
              message:
                "This map was changed somewhere else since you opened it.",
            },
          };
        }
        return { data: row };
      },
      // Patch the list in place instead of refetching it on every autosave.
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data: saved } = await queryFulfilled;
          dispatch(
            mapsApi.util.updateQueryData("getMaps", undefined, (list) => {
              const index = list.findIndex((map) => map.id === saved.id);
              if (index >= 0) list[index] = saved;
            }),
          );
        } catch {
          // The editor shows save errors; the list keeps its last state.
        }
      },
    }),

    updateMapMeta: builder.mutation<
      ThinkingMapSummary,
      { id: string; name?: string; is_pinned?: boolean }
    >({
      queryFn: async ({ id, ...changes }) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { data, error } = await supabase
          .from("thinking_maps")
          .update(changes)
          .eq("id", id)
          .select(SUMMARY_COLUMNS)
          .single();
        if (error) return { error };
        return { data: data as ThinkingMapSummary };
      },
      invalidatesTags: ["ThinkingMaps"],
    }),

    deleteMap: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("thinking_maps"),
      invalidatesTags: ["ThinkingMaps"],
    }),
  }),
});

export const {
  useGetMapsQuery,
  useGetMapQuery,
  useLazyGetMapQuery,
  useCreateMapMutation,
  useSaveMapDocMutation,
  useUpdateMapMetaMutation,
  useDeleteMapMutation,
} = mapsApi;
