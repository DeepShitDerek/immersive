import { describe, expect, it } from "vitest";
import type { LifeUpdate } from "@/types";
import { selectFeed } from "./use-updates-feed";

const update = (id: string, extra: Partial<LifeUpdate> = {}) =>
  ({ id, category: "thought", title: id, ...extra }) as LifeUpdate;

const all = [
  update("pinned", { is_pinned: true, tags: ["go"], category: "milestone" }),
  update("a", { tags: ["go"], content: "About Postgres" }),
  update("b", { category: "photo" }),
];
const none = { category: "all" as const, tag: null, searchTerm: "" };

describe("selectFeed", () => {
  it("unfiltered, keeps pinned updates out of the feed and lists them apart", () => {
    const { pinned, feed, filtering } = selectFeed(all, none);
    expect(filtering).toBe(false);
    expect(pinned.map((u) => u.id)).toEqual(["pinned"]);
    expect(feed.map((u) => u.id)).toEqual(["a", "b"]);
  });

  it("does not count a blank search as filtering", () => {
    expect(selectFeed(all, { ...none, searchTerm: "   " }).filtering).toBe(
      false,
    );
  });

  it("filtered, is a result list that includes pinned matches", () => {
    const byCategory = selectFeed(all, { ...none, category: "milestone" });
    expect(byCategory.filtering).toBe(true);
    expect(byCategory.feed.map((u) => u.id)).toEqual(["pinned"]);

    expect(
      selectFeed(all, { ...none, tag: "go" }).feed.map((u) => u.id),
    ).toEqual(["pinned", "a"]);
    expect(
      selectFeed(all, { ...none, searchTerm: "postgres" }).feed.map(
        (u) => u.id,
      ),
    ).toEqual(["a"]);
  });

  it("combines category, tag and search", () => {
    expect(
      selectFeed(all, {
        category: "thought",
        tag: "go",
        searchTerm: "a",
      }).feed.map((u) => u.id),
    ).toEqual(["a"]);
    expect(
      selectFeed(all, { category: "photo", tag: "go", searchTerm: "" }).feed,
    ).toEqual([]);
  });

  it("copes with no updates", () => {
    expect(selectFeed([], none)).toEqual({
      pinned: [],
      feed: [],
      filtering: false,
    });
  });
});
