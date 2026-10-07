import { supabase } from "@/supabase/client";
import type { PortfolioItem, PortfolioSection } from "@/types";
import { adminApi } from "./baseApi";
import { NO_DB_ERROR, saveQueryFn, deleteQueryFn } from "./query-helpers";

const portfolioApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    getPortfolioContent: builder.query<PortfolioSection[], void>({
      queryFn: async () => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { data, error } = await supabase
          .from("portfolio_sections")
          .select(`*, portfolio_items (*)`)
          .order("page_path")
          .order("display_order", { ascending: true })
          .order("display_order", {
            foreignTable: "portfolio_items",
            ascending: true,
          });
        if (error) return { error };
        return { data };
      },
      providesTags: ["PortfolioContent"],
    }),
    saveSection: builder.mutation<PortfolioSection, Partial<PortfolioSection>>({
      queryFn: saveQueryFn<PortfolioSection>("portfolio_sections"),
      invalidatesTags: ["PortfolioContent"],
    }),
    deleteSection: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("portfolio_sections"),
      invalidatesTags: ["PortfolioContent"],
    }),
    savePortfolioItem: builder.mutation<PortfolioItem, Partial<PortfolioItem>>({
      queryFn: saveQueryFn<PortfolioItem>("portfolio_items"),
      invalidatesTags: ["PortfolioContent", "Assets"],
    }),
    deletePortfolioItem: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("portfolio_items"),
      invalidatesTags: ["PortfolioContent", "Assets"],
    }),
    updateSectionOrder: builder.mutation<null, string[]>({
      queryFn: async (sectionIds) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { error } = await supabase.rpc("update_section_order", {
          section_ids: sectionIds,
        });
        if (error) return { error };
        return { data: null };
      },
      invalidatesTags: ["PortfolioContent"],
    }),
    /** A section's items, in the order given. Migration 024. */
    updateItemOrder: builder.mutation<
      null,
      { sectionId: string; itemIds: string[] }
    >({
      queryFn: async ({ sectionId, itemIds }) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { error } = await supabase.rpc("update_item_order", {
          section_uuid: sectionId,
          item_ids: itemIds,
        });
        if (error) return { error };
        return { data: null };
      },
      invalidatesTags: ["PortfolioContent"],
    }),
  }),
});

export const {
  useGetPortfolioContentQuery,
  useSaveSectionMutation,
  useDeleteSectionMutation,
  useSavePortfolioItemMutation,
  useDeletePortfolioItemMutation,
  useUpdateSectionOrderMutation,
  useUpdateItemOrderMutation,
} = portfolioApi;
