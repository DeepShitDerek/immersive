import { describe, expect, it } from "vitest";
import type { BlogPost } from "@/types";
import { filterPosts } from "./use-post-list";

const post = (slug: string, extra: Partial<BlogPost> = {}) =>
  ({ id: slug, slug, title: slug, show_toc: true, ...extra }) as BlogPost;
const posts = [
  post("alpha", {
    title: "Alpha ledger",
    tags: ["go", "db"],
    excerpt: "About Postgres",
  }),
  post("beta", { title: "Beta", tags: ["rust"] }),
  post("gamma", { title: "Gamma", tags: null, excerpt: null }),
];

describe("filterPosts", () => {
  it("returns everything for no term and no tag", () => {
    expect(filterPosts(posts, "", null)).toHaveLength(3);
    expect(filterPosts(posts, "   ", null)).toHaveLength(3);
  });

  it("matches the title, the excerpt and tags, ignoring case", () => {
    expect(filterPosts(posts, "LEDGER", null).map((p) => p.slug)).toEqual([
      "alpha",
    ]);
    expect(filterPosts(posts, "postgres", null).map((p) => p.slug)).toEqual([
      "alpha",
    ]);
    expect(filterPosts(posts, "rust", null).map((p) => p.slug)).toEqual([
      "beta",
    ]);
  });

  it("filters by exact tag, and combines with the term", () => {
    expect(filterPosts(posts, "", "go").map((p) => p.slug)).toEqual(["alpha"]);
    expect(filterPosts(posts, "beta", "go")).toEqual([]);
  });

  it("copes with posts that have no tags or excerpt", () => {
    expect(filterPosts(posts, "gamma", null).map((p) => p.slug)).toEqual([
      "gamma",
    ]);
    expect(filterPosts(posts, "", "anything")).toEqual([]);
  });
});
