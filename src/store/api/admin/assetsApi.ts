import { supabase } from "@/supabase/client";
import type { StorageAsset } from "@/types";
import { BUCKET_NAME } from "@/lib/constants";
import { adminApi } from "./baseApi";
import {
  NO_DB_ERROR,
  getAllQueryFn,
  insertQueryFn,
  updateQueryFn,
} from "./query-helpers";

const assetsApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    getAssets: builder.query<StorageAsset[], void>({
      queryFn: getAllQueryFn<StorageAsset>("storage_assets", [
        { column: "created_at", ascending: false },
      ]),
      providesTags: ["Assets"],
    }),
    addAsset: builder.mutation<StorageAsset, Partial<StorageAsset>>({
      queryFn: insertQueryFn<StorageAsset>("storage_assets"),
      invalidatesTags: ["Assets"],
    }),
    updateAsset: builder.mutation<StorageAsset, Partial<StorageAsset>>({
      queryFn: updateQueryFn<StorageAsset>("storage_assets"),
      invalidatesTags: ["Assets"],
    }),
    deleteAsset: builder.mutation<{ id: string }, StorageAsset>({
      queryFn: async (asset) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { error: storageError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([asset.file_path]);
        if (storageError) {
          return {
            error: {
              message: `Storage deletion failed: ${storageError.message}`,
            },
          };
        }

        const { error: dbError } = await supabase
          .from("storage_assets")
          .delete()
          .eq("id", asset.id);
        if (dbError) return { error: dbError };
        return { data: { id: asset.id } };
      },
      invalidatesTags: ["Assets"],
    }),
    moveAsset: builder.mutation<
      null,
      { assetId: string; oldPath: string; newPath: string }
    >({
      queryFn: async ({ assetId, oldPath, newPath }) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { error: storageError } = await supabase.storage
          .from(BUCKET_NAME)
          .move(oldPath, newPath);

        if (storageError) return { error: storageError };

        const { error: dbError } = await supabase
          .from("storage_assets")
          .update({ file_path: newPath })
          .eq("id", assetId);

        if (dbError) return { error: dbError };

        return { data: null };
      },
      invalidatesTags: ["Assets"],
    }),
    rescanAssetUsage: builder.mutation<null, void>({
      queryFn: async () => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { error } = await supabase.rpc("update_asset_usage");
        if (error) return { error };
        return { data: null };
      },
      invalidatesTags: ["Assets"],
    }),
  }),
});

export const {
  useGetAssetsQuery,
  useAddAssetMutation,
  useUpdateAssetMutation,
  useDeleteAssetMutation,
  useMoveAssetMutation,
  useRescanAssetUsageMutation,
} = assetsApi;
