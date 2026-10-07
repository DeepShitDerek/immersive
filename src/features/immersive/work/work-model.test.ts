import { describe, expect, it } from "vitest";
import type { PortfolioItem, PortfolioSection } from "@/types";
import { allItems, allTags, filterByTag, resolveTag } from "./work-model";

const item = (id: string, tags?: string[], display_order = 0) =>
  ({ id, title: id, tags, display_order }) as PortfolioItem;
const items = [
  item("a", ["Go", "Postgres"]),
  item("b", ["go", " Rust "]),
  item("c"),
  item("d", [""]),
];

describe("allItems", () => {
  it("flattens sections in order, each sorted", () => {
    const sections = [
      { portfolio_items: [item("b", [], 2), item("a", [], 1)] },
      { portfolio_items: [item("c")] },
      { portfolio_items: undefined },
    ] as unknown as PortfolioSection[];
    expect(allItems(sections).map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(allItems(undefined)).toEqual([]);
  });
});

describe("allTags", () => {
  it("lists each tag once, trimmed, in first-seen order and spelling", () => {
    expect(allTags(items)).toEqual(["Go", "Postgres", "Rust"]);
  });
});

describe("resolveTag", () => {
  const tags = allTags(items);
  it("matches case-insensitively and returns the listed spelling", () => {
    expect(resolveTag("go", tags)).toBe("Go");
    expect(resolveTag(" RUST ", tags)).toBe("Rust");
  });
  it.each([null, "", "nope", "<script>"])("is null for %j", (tag) => {
    expect(resolveTag(tag, tags)).toBeNull();
  });
});

describe("filterByTag", () => {
  it("returns everything for no tag", () => {
    expect(filterByTag(items, null)).toHaveLength(4);
  });
  it("keeps items carrying the tag, whatever the case", () => {
    expect(filterByTag(items, "Go").map((i) => i.id)).toEqual(["a", "b"]);
    expect(filterByTag(items, "Rust").map((i) => i.id)).toEqual(["b"]);
  });
});
