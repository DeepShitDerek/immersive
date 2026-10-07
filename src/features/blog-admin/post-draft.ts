import type { BlogPost } from "@/types";
import { blogPostSchema } from "@/lib/schemas";

/**
 * A post as the editor holds it, and the rules for turning it into a row.
 *
 * Pure, so the rules that decide what reaches the database — and, above all,
 * what reaches the public site — are testable without rendering an editor.
 */

export interface PostDraft {
  title: string;
  slug: string;
  /** Shown under the title as the subtitle, and used as the summary. */
  excerpt: string;
  content: string;
  tags: string[];
  show_toc: boolean;
  cover_image_url: string;
  internal_notes: string;
}

export function draftFromPost(post: BlogPost | null): PostDraft {
  return {
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    excerpt: post?.excerpt ?? "",
    content: post?.content ?? "",
    tags: post?.tags ?? [],
    show_toc: post?.show_toc ?? true,
    cover_image_url: post?.cover_image_url ?? "",
    internal_notes: post?.internal_notes ?? "",
  };
}

export function sameDraft(a: PostDraft, b: PostDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** A title as an address: lowercase, accents dropped, words joined by single hyphens. */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Words as a reader counts them — markup and stray symbols are not words. */
export function countWords(markdown: string): number {
  return markdown
    .replace(/<[^>]*>/g, " ")
    .split(/\s+/)
    .filter((word) => /[A-Za-z0-9À-￿]/.test(word)).length;
}

/**
 * The row to write.
 *
 * `published_at` is the date readers see, so it is stamped when a post goes
 * live, kept for every later update, and cleared when it comes down. The
 * editor used to restamp it on every save of a published post, so fixing a
 * typo moved a year-old post to the top of the blog as if it were new.
 */
export function recordFromDraft(
  draft: PostDraft,
  publish: boolean,
  previous: BlogPost | null,
): Partial<BlogPost> {
  const keepDate = publish && !!previous?.published && !!previous.published_at;
  return {
    title: draft.title.trim(),
    slug: draft.slug.trim(),
    excerpt: draft.excerpt.trim() || null,
    content: draft.content,
    tags: draft.tags.length > 0 ? draft.tags : null,
    show_toc: draft.show_toc,
    cover_image_url: draft.cover_image_url.trim() || null,
    internal_notes: draft.internal_notes.trim() || null,
    published: publish,
    published_at: publish
      ? keepDate
        ? previous!.published_at
        : new Date().toISOString()
      : null,
  };
}

/**
 * What stops this record being written, by field. The shared schema decides
 * the shape; publishing additionally needs something to read — a draft with
 * an empty body is fine, a published one is not.
 */
export function postProblems(
  record: Partial<BlogPost>,
  forPublishing: boolean,
): Record<string, string> {
  const problems: Record<string, string> = {};
  const parsed = blogPostSchema.safeParse(record);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      problems[field] ??= issue.message;
    }
  }
  if (forPublishing && !(record.content ?? "").trim()) {
    problems.content ??= "Write something before publishing.";
  }
  return problems;
}

/**
 * What publishing does on a static site: the post is readable at
 * once, through the client-rendered /blog/view/ route, but its own prerendered
 * page and link-preview card only exist after the next deploy.
 */
export const PUBLISHED_UNTIL_DEPLOY =
  "Live now. Its own page and link preview arrive with the next deploy.";
