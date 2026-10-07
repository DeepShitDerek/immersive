/**
 * What a signed-out visitor may read, per table.
 *
 * Mirrors the `GRANT SELECT (…) … TO anon` lists in db/schema.sql. A public
 * query that asks for a column outside the grant fails outright, so public
 * reads name their columns instead of using `*` — and `internal_notes` is
 * absent on purpose. `public-columns.test.ts` checks these against the SQL.
 *
 * Kept as string literals, not joined arrays: supabase-js parses the select
 * string's *type*, and a string built at runtime loses the row shape.
 */

export const PUBLIC_BLOG_POST_SELECT =
  "id, user_id, title, slug, excerpt, content, cover_image_url, published, published_at, show_toc, tags, views, word_count, created_at, updated_at";

/** List views: everything but the body; read time comes from `word_count`. */
export const PUBLIC_BLOG_LIST_SELECT =
  "id, user_id, title, slug, excerpt, cover_image_url, published, published_at, show_toc, tags, views, word_count, created_at, updated_at";

/** Items carry `has_case_study`, never the case-study body itself. */
export const PUBLIC_SECTION_WITH_ITEMS_SELECT =
  "*, portfolio_items(id, section_id, user_id, title, subtitle, date_from, date_to, description, image_url, link_url, tags, display_order, merged_into_id, slug, has_case_study, created_at, updated_at)";

/** One case-study page. */
export const PUBLIC_CASE_STUDY_SELECT =
  "id, section_id, title, subtitle, date_from, date_to, description, image_url, link_url, tags, slug, case_study, has_case_study, created_at, updated_at";

/** The column names in a select string, for comparison with the SQL grant. */
export function selectedColumns(select: string): string[] {
  return select
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);
}

/** The columns requested from the embedded `portfolio_items(...)`. */
export function embeddedItemColumns(select: string): string[] {
  const inner = /portfolio_items\(([^)]*)\)/.exec(select)?.[1] ?? "";
  return selectedColumns(inner);
}
