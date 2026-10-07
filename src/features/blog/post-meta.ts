import { calculateReadTime, readTimeFromWordCount } from "@/lib/utils";
import type { BlogPost } from "@/types";

/*
  Small post helpers shared by the blog list, the post page and the home
  page's "Latest writing". Their own module so the home page doesn't pull in
  the whole blog list component to reach them.
*/

export function readTime(post: BlogPost): number {
  return typeof post.word_count === "number"
    ? readTimeFromWordCount(post.word_count)
    : calculateReadTime(post.content ?? "");
}

/** "Sep 15, 2026". Pass `timeZone` from useDisplayTimeZone on prerendered pages. */
export function formatPostDate(iso?: string | null, timeZone?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
}
