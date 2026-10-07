import type { LibraryHighlight, LibrarySource } from "@/types";
import { adminApi } from "./baseApi";
import { deleteQueryFn, getAllQueryFn, saveQueryFn } from "./query-helpers";

/**
 * The Library: sources (the reading list) and highlights (the lines kept from
 * them). Standard CRUD over both tables, so it is built from the shared query
 * helpers rather than hand-written query functions.
 *
 * The one public read — a random public highlight — deliberately does not live
 * here. It is a visitor's query, so it goes through `publicApi`, and it reaches
 * a database function rather than either table.
 */
export const libraryApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    getLibrarySources: builder.query<LibrarySource[], void>({
      queryFn: getAllQueryFn<LibrarySource>("library_sources", [
        { column: "updated_at", ascending: false },
      ]),
      providesTags: ["Library"],
    }),

    saveLibrarySource: builder.mutation<
      LibrarySource,
      Partial<LibrarySource> & { id?: string }
    >({
      queryFn: saveQueryFn<LibrarySource>("library_sources"),
      invalidatesTags: ["Library"],
    }),

    deleteLibrarySource: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("library_sources"),
      invalidatesTags: ["Library"],
    }),

    getLibraryHighlights: builder.query<LibraryHighlight[], void>({
      queryFn: getAllQueryFn<LibraryHighlight>("library_highlights", [
        { column: "created_at", ascending: false },
      ]),
      providesTags: ["Library"],
    }),

    saveLibraryHighlight: builder.mutation<
      LibraryHighlight,
      Partial<LibraryHighlight> & { id?: string }
    >({
      queryFn: saveQueryFn<LibraryHighlight>("library_highlights"),
      invalidatesTags: ["Library"],
    }),

    deleteLibraryHighlight: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("library_highlights"),
      invalidatesTags: ["Library"],
    }),
  }),
});

export const {
  useGetLibrarySourcesQuery,
  useSaveLibrarySourceMutation,
  useDeleteLibrarySourceMutation,
  useGetLibraryHighlightsQuery,
  useSaveLibraryHighlightMutation,
  useDeleteLibraryHighlightMutation,
} = libraryApi;
