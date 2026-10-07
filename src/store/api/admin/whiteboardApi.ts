import { supabase } from "@/supabase/client";
import type { Whiteboard } from "@/types";
import { adminApi } from "./baseApi";
import { NO_DB_ERROR, deleteQueryFn, saveQueryFn } from "./query-helpers";

/**
 * Whiteboard endpoints. The list deliberately projects away `elements`,
 * `app_state`, and `files` — a scene with pasted images runs to megabytes, and
 * the gallery only needs the SVG `preview`. The full record is fetched per
 * board when one is opened, which is why these two are hand-written rather
 * than built from `getAllQueryFn`.
 */
const LIST_COLUMNS = "id,title,preview,tags,is_pinned,created_at,updated_at";

export const whiteboardApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    getWhiteboards: builder.query<Whiteboard[], void>({
      queryFn: async () => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { data, error } = await supabase
          .from("whiteboards")
          .select(LIST_COLUMNS)
          .order("is_pinned", { ascending: false })
          .order("updated_at", { ascending: false });
        if (error) return { error };
        return { data: data as unknown as Whiteboard[] };
      },
      providesTags: ["Whiteboards"],
    }),
    getWhiteboard: builder.query<Whiteboard, string>({
      queryFn: async (id) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { data, error } = await supabase
          .from("whiteboards")
          .select("*")
          .eq("id", id)
          .single();
        if (error) return { error };
        return { data: data as Whiteboard };
      },
      providesTags: ["Whiteboards"],
    }),
    saveWhiteboard: builder.mutation<Whiteboard, Partial<Whiteboard>>({
      queryFn: saveQueryFn<Whiteboard>("whiteboards"),
      invalidatesTags: ["Whiteboards"],
    }),
    deleteWhiteboard: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("whiteboards"),
      invalidatesTags: ["Whiteboards"],
    }),
  }),
});

export const {
  useGetWhiteboardsQuery,
  useGetWhiteboardQuery,
  useSaveWhiteboardMutation,
  useDeleteWhiteboardMutation,
} = whiteboardApi;
