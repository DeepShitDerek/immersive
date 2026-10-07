import { describe, expect, it } from "vitest";
import type { PortfolioItem } from "@/types";
import { nextCaseStudy } from "./case-study-model";

const study = (slug: string) =>
  ({ id: slug, title: slug, slug, has_case_study: true }) as PortfolioItem;
const plain = (id: string) => ({ id, title: id }) as PortfolioItem;

describe("nextCaseStudy", () => {
  const items = [study("a"), plain("x"), study("b"), study("c")];

  it("is the next project that has a case study", () => {
    expect(nextCaseStudy(items, "a")?.slug).toBe("b");
    expect(nextCaseStudy(items, "b")?.slug).toBe("c");
  });

  it("wraps from the last to the first", () => {
    expect(nextCaseStudy(items, "c")?.slug).toBe("a");
  });

  it("is null when this is the only case study", () => {
    expect(nextCaseStudy([study("a"), plain("x")], "a")).toBeNull();
  });

  it("is null when the slug is not in the list, or the list is empty", () => {
    expect(nextCaseStudy(items, "zzz")).toBeNull();
    expect(nextCaseStudy([], "a")).toBeNull();
  });

  it("never returns the same project", () => {
    for (const slug of ["a", "b", "c"]) {
      expect(nextCaseStudy(items, slug)?.slug).not.toBe(slug);
    }
  });

  it("ignores an item with a slug but no case study", () => {
    const mixed = [
      study("a"),
      { ...study("draft"), has_case_study: false },
      study("b"),
    ];
    expect(nextCaseStudy(mixed, "a")?.slug).toBe("b");
  });
});
