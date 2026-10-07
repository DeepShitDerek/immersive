"use client";

import { useMemo, useState } from "react";
import { useGetPublishedBlogPostsQuery } from "@/store/api/publicApi";
import type { BlogPost } from "@/types";

/** The tags worth offering as filters, with how many posts carry each: most used first, at most `limit`. */
function topTags(
  posts: BlogPost[],
  limit = 8,
): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    const unique = Array.from(
      new Set((post.tags ?? []).map((t) => t.trim()).filter(Boolean)),
    );
    for (const tag of unique) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

/** The posts that carry `tag` (when one is set) and mention `term` in their title, excerpt or tags. */
export function filterPosts(
  posts: readonly BlogPost[],
  searchTerm: string,
  tag: string | null,
): BlogPost[] {
  const term = searchTerm.trim().toLowerCase();
  return posts.filter((post) => {
    if (tag && !(post.tags ?? []).includes(tag)) return false;
    if (!term) return true;
    return [post.title, post.excerpt, ...(post.tags ?? [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(term);
  });
}

const NO_POSTS: BlogPost[] = [];

/**
 * What the writing index does, apart from how it looks: the posts, the search
 * box, the topic filter. The Classic page and the immersive one both call
 * this, so a change to how filtering works lands in both.
 */
export function usePostList() {
  const {
    data: posts = NO_POSTS,
    isLoading,
    isError,
    refetch,
  } = useGetPublishedBlogPostsQuery();
  const [searchTerm, setSearchTerm] = useState("");
  // A post's tag links land on the index as ?tag=, so the chip arrives
  // pressed: the page sets it once it has hydrated.
  const [tag, setTag] = useState<string | null>(null);

  const tags = useMemo(() => topTags(posts), [posts]);
  const filtered = useMemo(
    () => filterPosts(posts, searchTerm, tag),
    [posts, searchTerm, tag],
  );
  const filtering = Boolean(searchTerm.trim() || tag);

  const clear = () => {
    setSearchTerm("");
    setTag(null);
  };

  return {
    posts,
    isLoading,
    isError,
    refetch,
    searchTerm,
    setSearchTerm,
    tag,
    setTag,
    tags,
    filtered,
    filtering,
    clear,
  };
}
