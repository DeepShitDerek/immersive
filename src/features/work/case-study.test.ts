import { describe, expect, it } from "vitest";
import { portfolioItemSchema } from "@/lib/schemas";
import { caseStudyHref } from "./case-study-href";

describe("caseStudyHref", () => {
  it("links built case studies to their prerendered page", () => {
    expect(caseStudyHref("rag-bot", ["rag-bot"])).toBe("/work/rag-bot/");
  });

  it("sends case studies newer than the build to /work/view", () => {
    expect(caseStudyHref("new-one", ["rag-bot"])).toBe(
      "/work/view/?slug=new-one",
    );
    expect(caseStudyHref("new-one", undefined)).toBe(
      "/work/view/?slug=new-one",
    );
  });

  it("encodes the slug", () => {
    expect(caseStudyHref("x&y=1", undefined)).toBe(
      "/work/view/?slug=x%26y%3D1",
    );
  });
});

describe("portfolioItemSchema case-study slug", () => {
  const base = { section_id: "s", title: "T", tags: [] };
  const slug = (value: string | null) =>
    portfolioItemSchema.safeParse({ ...base, slug: value }).success;

  it("accepts what the database accepts", () => {
    expect(slug("rag-bot-2024")).toBe(true);
    expect(slug(null)).toBe(true);
  });

  it("refuses what the database refuses", () => {
    expect(slug("Rag Bot")).toBe(false);
    expect(slug("rag--bot")).toBe(false);
    expect(slug("-rag")).toBe(false);
    expect(slug("rag_bot")).toBe(false);
    expect(slug("view")).toBe(false);
    expect(slug("a".repeat(81))).toBe(false);
  });
});
