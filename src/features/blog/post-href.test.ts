import { describe, expect, it } from "vitest";
import { postHref } from "./post-href";

describe("postHref", () => {
  it("links built posts to their prerendered page", () => {
    expect(postHref("hello-world", ["hello-world"])).toBe("/blog/hello-world/");
  });

  it("sends posts newer than the build to the client-rendered fallback", () => {
    expect(postHref("brand-new", ["hello-world"])).toBe(
      "/blog/view/?slug=brand-new",
    );
    expect(postHref("brand-new")).toBe("/blog/view/?slug=brand-new");
  });

  it("encodes slugs so they cannot break out of the path or query", () => {
    expect(postHref("a b/../c", ["a b/../c"])).toBe("/blog/a%20b%2F..%2Fc/");
    expect(postHref("x&y=1")).toBe("/blog/view/?slug=x%26y%3D1");
  });
});
