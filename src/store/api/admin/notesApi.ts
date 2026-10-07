import type { Note } from "@/types";
import { adminApi } from "./baseApi";
import {
  getAllQueryFn,
  insertQueryFn,
  updateQueryFn,
  deleteQueryFn,
} from "./query-helpers";

const notesApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    getNotes: builder.query<Note[], void>({
      queryFn: getAllQueryFn<Note>("notes", [
        { column: "is_pinned", ascending: false },
        { column: "updated_at", ascending: false },
      ]),
      providesTags: ["Notes"],
    }),
    addNote: builder.mutation<Note, Partial<Note>>({
      queryFn: insertQueryFn<Note>("notes"),
      invalidatesTags: ["Notes"],
    }),
    updateNote: builder.mutation<Note, Partial<Note>>({
      queryFn: updateQueryFn<Note>("notes"),
      invalidatesTags: ["Notes"],
    }),
    deleteNote: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("notes"),
      invalidatesTags: ["Notes"],
    }),
    /**
     * Archiving, because deleting was the only way to clear a note out of the
     * way — and a note is the one thing in here you cannot reconstruct.
     */
    archiveNote: builder.mutation<Note, { id: string; archived: boolean }>({
      queryFn: async ({ id, archived }) =>
        updateQueryFn<Note>("notes")({
          id,
          archived_at: archived ? new Date().toISOString() : null,
        } as Partial<Note>),
      invalidatesTags: ["Notes"],
    }),
  }),
});

export const {
  useGetNotesQuery,
  useArchiveNoteMutation,
  useAddNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
} = notesApi;
