import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PUBLIC_BLOG_LIST_SELECT,
  PUBLIC_BLOG_POST_SELECT,
  PUBLIC_CASE_STUDY_SELECT,
  PUBLIC_SECTION_WITH_ITEMS_SELECT,
  embeddedItemColumns,
  selectedColumns,
} from "./public-columns";

const sql = readFileSync(
  path.resolve(__dirname, "../../../db/schema.sql"),
  "utf8",
);

/** The column list in `GRANT SELECT (…) ON public.<table> TO anon`. */
function anonGrant(table: string): string[] {
  const match = new RegExp(
    `GRANT SELECT \\(([^)]*)\\)\\s+ON public\\.${table} TO anon`,
    "i",
  ).exec(sql);
  if (!match) throw new Error(`No anon column grant for ${table}`);
  return selectedColumns(match[1]);
}

describe.each([
  ["blog_posts", selectedColumns(PUBLIC_BLOG_POST_SELECT)],
  ["blog_posts", selectedColumns(PUBLIC_BLOG_LIST_SELECT)],
  ["portfolio_items", embeddedItemColumns(PUBLIC_SECTION_WITH_ITEMS_SELECT)],
  ["portfolio_items", selectedColumns(PUBLIC_CASE_STUDY_SELECT)],
])("%s", (table, requested) => {
  const granted = anonGrant(table);

  it("replaces anon's table-wide SELECT with a column grant", () => {
    expect(sql).toMatch(
      new RegExp(`REVOKE SELECT ON public\\.${table} FROM anon`, "i"),
    );
  });

  it("never exposes internal_notes", () => {
    expect(granted).not.toContain("internal_notes");
    expect(requested).not.toContain("internal_notes");
  });

  it("public queries only ask for granted columns", () => {
    // A column outside the grant makes the whole public query fail.
    expect(requested.length).toBeGreaterThan(5);
    for (const column of requested) expect(granted).toContain(column);
  });
});

it("the blog list omits post bodies but keeps the word count", () => {
  const list = selectedColumns(PUBLIC_BLOG_LIST_SELECT);
  expect(list).not.toContain("content");
  expect(list).toContain("word_count");
});
