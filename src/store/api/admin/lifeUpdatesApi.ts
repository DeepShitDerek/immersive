import type { LifeUpdate } from "@/types";
import { adminApi } from "./baseApi";
import {
  getAllQueryFn,
  insertQueryFn,
  updateQueryFn,
  deleteQueryFn,
} from "./query-helpers";

/** Admin CRUD for "life updates" (the `public_notes` table). */
const lifeUpdatesApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    getLifeUpdates: builder.query<LifeUpdate[], void>({
      queryFn: getAllQueryFn<LifeUpdate>("public_notes", [
        { column: "is_pinned", ascending: false },
        { column: "updated_at", ascending: false },
      ]),
      providesTags: ["LifeUpdates"],
    }),
    addLifeUpdate: builder.mutation<LifeUpdate, Partial<LifeUpdate>>({
      queryFn: insertQueryFn<LifeUpdate>("public_notes"),
      invalidatesTags: ["LifeUpdates"],
    }),
    updateLifeUpdate: builder.mutation<LifeUpdate, Partial<LifeUpdate>>({
      queryFn: updateQueryFn<LifeUpdate>("public_notes"),
      invalidatesTags: ["LifeUpdates"],
    }),
    deleteLifeUpdate: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("public_notes"),
      invalidatesTags: ["LifeUpdates"],
    }),
  }),
});

export const {
  useGetLifeUpdatesQuery,
  useAddLifeUpdateMutation,
  useUpdateLifeUpdateMutation,
  useDeleteLifeUpdateMutation,
} = lifeUpdatesApi;
