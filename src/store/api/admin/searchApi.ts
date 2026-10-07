import { supabase } from "@/supabase/client";
import { adminApi } from "./baseApi";
import { NO_DB_ERROR } from "./query-helpers";

export type SearchKind = "note" | "task" | "post" | "message";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  /** Where it opens: the module with the item in its URL. */
  href: string;
}

const PER_KIND = 5;

/** `%term%` for ILIKE, with the term's own wildcards taken literally. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** A value inside a PostgREST `or=(...)` list: quoted, so commas and parentheses are data. */
function orValue(value: string): string {
  return `"${value.replace(/["\\]/g, (c) => `\\${c}`)}"`;
}

/**
 * Titles across notes, tasks, posts and messages, for the command palette
 *. It could find module names only.
 *
 * Titles, not bodies: ILIKE on a title is cheap on tables this size, and a
 * match the palette cannot show the reason for is a confusing result.
 */
export const searchApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    searchWorkspace: builder.query<SearchHit[], string>({
      queryFn: async (term) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const pattern = likePattern(term.trim());
        const [notes, tasks, posts, messages] = await Promise.all([
          supabase
            .from("notes")
            .select("id, title")
            .ilike("title", pattern)
            .is("archived_at", null)
            .order("updated_at", { ascending: false })
            .limit(PER_KIND),
          supabase
            .from("tasks")
            .select("id, title")
            .ilike("title", pattern)
            .order("updated_at", { ascending: false })
            .limit(PER_KIND),
          supabase
            .from("blog_posts")
            .select("id, title")
            .ilike("title", pattern)
            .order("updated_at", { ascending: false })
            .limit(PER_KIND),
          supabase
            .from("contact_submissions")
            .select("id, name, subject")
            .or(
              `subject.ilike.${orValue(pattern)},name.ilike.${orValue(pattern)}`,
            )
            .eq("is_archived", false)
            .order("created_at", { ascending: false })
            .limit(PER_KIND),
        ]);
        const failed =
          notes.error ?? tasks.error ?? posts.error ?? messages.error;
        if (failed) return { error: failed };

        const hits: SearchHit[] = [
          ...(notes.data ?? []).map((n) => ({
            kind: "note" as const,
            id: n.id,
            title: n.title || "Untitled note",
            href: `/admin/notes/?note=${n.id}`,
          })),
          ...(tasks.data ?? []).map((t) => ({
            kind: "task" as const,
            id: t.id,
            title: t.title,
            href: `/admin/tasks/?task=${t.id}`,
          })),
          ...(posts.data ?? []).map((p) => ({
            kind: "post" as const,
            id: p.id,
            title: p.title || "Untitled post",
            href: `/admin/blog/?post=${p.id}`,
          })),
          ...(messages.data ?? []).map((m) => ({
            kind: "message" as const,
            id: m.id,
            title: m.subject ? `${m.subject} — ${m.name}` : m.name,
            href: `/admin/inbox/?message=${m.id}`,
          })),
        ];
        return { data: hits };
      },
      keepUnusedDataFor: 30,
    }),
  }),
});

export const { useSearchWorkspaceQuery } = searchApi;
