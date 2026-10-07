import { supabase } from "@/supabase/client";
import type { BlogPost } from "@/types";
import { BUCKET_NAME } from "@/lib/constants";
import { adminApi } from "./baseApi";
import {
  NO_DB_ERROR,
  getAllQueryFn,
  insertQueryFn,
  updateQueryFn,
} from "./query-helpers";

const blogAdminApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminBlogPosts: builder.query<BlogPost[], void>({
      queryFn: getAllQueryFn<BlogPost>("blog_posts", [
        { column: "created_at", ascending: false },
      ]),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "AdminPosts" as const, id })),
              { type: "AdminPosts" as const, id: "LIST" },
            ]
          : [{ type: "AdminPosts" as const, id: "LIST" }],
    }),
    addBlogPost: builder.mutation<BlogPost, Partial<BlogPost>>({
      queryFn: insertQueryFn<BlogPost>("blog_posts"),
      invalidatesTags: [{ type: "AdminPosts", id: "LIST" }],
    }),
    updateBlogPost: builder.mutation<BlogPost, Partial<BlogPost>>({
      queryFn: updateQueryFn<BlogPost>("blog_posts"),
      invalidatesTags: (result, error, arg) => [
        { type: "AdminPosts", id: arg.id },
      ],
    }),
    deleteBlogPost: builder.mutation<{ post: BlogPost }, BlogPost>({
      queryFn: async (post) => {
        if (!supabase) return { error: NO_DB_ERROR };
        if (
          post.cover_image_url &&
          post.cover_image_url.includes(process.env.NEXT_PUBLIC_SUPABASE_URL!)
        ) {
          const pathSegments = post.cover_image_url.split("/");
          const bucketIndex = pathSegments.indexOf(BUCKET_NAME);
          if (bucketIndex !== -1) {
            const imagePath = pathSegments.slice(bucketIndex + 1).join("/");
            if (imagePath && imagePath.startsWith("blog_images/")) {
              await supabase.storage.from(BUCKET_NAME).remove([imagePath]);
            }
          }
        }
        const { error } = await supabase
          .from("blog_posts")
          .delete()
          .eq("id", post.id);
        if (error) return { error };
        return { data: { post } };
      },
      invalidatesTags: (result, error, arg) => [
        { type: "AdminPosts", id: "LIST" },
        { type: "AdminPosts", id: arg.id },
      ],
    }),
  }),
});

export const {
  useGetAdminBlogPostsQuery,
  useAddBlogPostMutation,
  useUpdateBlogPostMutation,
  useDeleteBlogPostMutation,
} = blogAdminApi;
