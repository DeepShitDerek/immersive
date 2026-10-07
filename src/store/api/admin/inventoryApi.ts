import { supabase } from "@/supabase/client";
import type { InventoryItem } from "@/types";
import { adminApi } from "./baseApi";
import {
  NO_DB_ERROR,
  getAllQueryFn,
  insertQueryFn,
  updateQueryFn,
} from "./query-helpers";

const inventoryApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    getInventory: builder.query<InventoryItem[], void>({
      queryFn: getAllQueryFn<InventoryItem>("inventory_items", [
        { column: "purchase_date", ascending: false },
      ]),
      providesTags: ["Inventory"],
    }),
    addInventoryItem: builder.mutation<InventoryItem, Partial<InventoryItem>>({
      queryFn: insertQueryFn<InventoryItem>("inventory_items"),
      invalidatesTags: ["Inventory"],
    }),
    updateInventoryItem: builder.mutation<
      InventoryItem,
      Partial<InventoryItem>
    >({
      queryFn: updateQueryFn<InventoryItem>("inventory_items"),
      invalidatesTags: ["Inventory"],
    }),
    /**
     * Archiving, because deleting takes the purchase price with it — the one
     * number still worth having once the object is gone.
     */
    archiveInventoryItem: builder.mutation<
      InventoryItem,
      { id: string; archived: boolean; reason?: string | null }
    >({
      queryFn: async ({ id, archived, reason }) =>
        updateQueryFn<InventoryItem>("inventory_items")({
          id,
          archived_at: archived ? new Date().toISOString() : null,
          // The constraint forbids a reason without an archive date.
          archived_reason: archived ? (reason ?? null) : null,
        } as Partial<InventoryItem>),
      invalidatesTags: ["Inventory"],
    }),
    deleteInventoryItem: builder.mutation<null, string>({
      queryFn: async (id) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { error } = await supabase
          .from("inventory_items")
          .delete()
          .eq("id", id);
        if (error) return { error };
        return { data: null };
      },
      invalidatesTags: ["Inventory"],
    }),
  }),
});

export const {
  useGetInventoryQuery,
  useArchiveInventoryItemMutation,
  useAddInventoryItemMutation,
  useUpdateInventoryItemMutation,
  useDeleteInventoryItemMutation,
} = inventoryApi;
