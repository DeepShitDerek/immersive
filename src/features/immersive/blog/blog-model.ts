import type { BlogPost } from "@/types";

/**
 * The post the end of an article hands off to: the next one in the list's own
 * order (newest first, so "next" is the next older), wrapping round. Null
 * when there is no other post, or this one is not in the list.
 */
export function nextPost(
  posts: readonly BlogPost[],
  slug: string,
): BlogPost | null {
  const index = posts.findIndex((post) => post.slug === slug);
  if (index === -1 || posts.length < 2) return null;
  return posts[(index + 1) % posts.length];
}
