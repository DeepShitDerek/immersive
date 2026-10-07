import { describe, expect, it } from "vitest";
import type { BlogPost } from "@/types";
import { nextPost } from "./blog-model";

const post = (slug: string) => ({ id: slug, slug, title: slug }) as BlogPost;
const posts = [post("newest"), post("middle"), post("oldest")];

describe("nextPost", () => {
  it("is the next older post", () => {
    expect(nextPost(posts, "newest")?.slug).toBe("middle");
    expect(nextPost(posts, "middle")?.slug).toBe("oldest");
  });

  it("wraps from the oldest to the newest", () => {
    expect(nextPost(posts, "oldest")?.slug).toBe("newest");
  });

  it("is null for the only post, an unknown slug, or no posts", () => {
    expect(nextPost([post("only")], "only")).toBeNull();
    expect(nextPost(posts, "missing")).toBeNull();
    expect(nextPost([], "newest")).toBeNull();
  });

  it("never returns the same post", () => {
    for (const { slug } of posts) {
      expect(nextPost(posts, slug)?.slug).not.toBe(slug);
    }
  });
});
