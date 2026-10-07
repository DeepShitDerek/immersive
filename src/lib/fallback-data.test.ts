import { describe, expect, it } from "vitest";
import { isPublicConfigPost, MOCK_BLOG_POSTS } from "./fallback-data";

describe("static-mode blog posts", () => {
  it("keeps drafts off the site", () => {
    expect(isPublicConfigPost({ slug: "a" })).toBe(true);
    expect(isPublicConfigPost({ slug: "a", draft: false })).toBe(true);
    expect(isPublicConfigPost({ slug: "a", draft: true })).toBe(false);
    // Only a literal true hides a post; a typo'd value does not silently unpublish it.
    expect(isPublicConfigPost({ slug: "a", draft: "yes" })).toBe(true);
  });

  it("marks every post it does publish as published", () => {
    expect(MOCK_BLOG_POSTS.every((p) => p.published)).toBe(true);
  });
});
