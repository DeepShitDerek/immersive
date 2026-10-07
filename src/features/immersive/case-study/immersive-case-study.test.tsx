import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const state = vi.hoisted(() => ({
  study: undefined as unknown,
  isError: false,
  items: [] as unknown[],
}));

vi.mock("@/store/api/publicApi", () => ({
  useGetSiteIdentityQuery: () => ({ data: undefined }),
  useGetCaseStudyBySlugQuery: () => ({
    data: state.study,
    isError: state.isError,
  }),
  useGetSectionsByPathQuery: () => ({
    data: [{ id: "s", portfolio_items: state.items }],
  }),
}));
vi.mock("@/store/public-preload", () => ({
  useBuiltCaseStudySlugs: () => ["ledger", "atlas"],
}));
vi.mock("@/features/work/case-study-page", () => ({
  CaseStudyPage: ({ slug }: { slug: string }) => (
    <p>classic states for {slug || "nothing"}</p>
  ),
}));
vi.mock("@/features/blog/post-content-loader", () => ({
  loadPostContent: () =>
    Promise.resolve({
      PostContent: ({ content }: { content: string }) => <div>{content}</div>,
    }),
}));

import ImmersiveCaseStudy from "./immersive-case-study";

const study = (slug: string, title: string) => ({
  id: slug,
  slug,
  title,
  tags: ["Go"],
  has_case_study: true,
  case_study: `Body of ${title}`,
  display_order: slug === "ledger" ? 0 : 1,
});

afterEach(() => {
  cleanup();
  state.study = undefined;
  state.isError = false;
  state.items = [];
});

describe("ImmersiveCaseStudy", () => {
  it("hands loading and not-found to the Classic page", () => {
    render(<ImmersiveCaseStudy slug="ledger" />);
    expect(screen.getByText("classic states for ledger")).toBeInTheDocument();

    cleanup();
    state.isError = true;
    render(<ImmersiveCaseStudy slug="nope" />);
    expect(screen.getByText("classic states for nope")).toBeInTheDocument();

    cleanup();
    render(<ImmersiveCaseStudy slug="" />);
    expect(screen.getByText("classic states for nothing")).toBeInTheDocument();
  });

  it("shows the title, the write-up and the hand-off to the next project", async () => {
    state.study = study("ledger", "Ledger");
    state.items = [study("ledger", "Ledger"), study("atlas", "Atlas")];
    const { container } = render(<ImmersiveCaseStudy slug="ledger" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Ledger",
    );
    expect(await screen.findByText("Body of Ledger")).toBeInTheDocument();
    const handoff = container.querySelector('[data-part="handoff"]')!;
    expect(handoff).not.toBeNull();
    const link = screen.getByRole("link", { name: "Atlas" });
    expect(handoff.contains(link)).toBe(true);
    expect(link.getAttribute("href")).toMatch(/^\/work\/atlas\/?$/);
  });

  it("has no hand-off when this is the only case study", () => {
    state.study = study("ledger", "Ledger");
    state.items = [study("ledger", "Ledger"), { id: "x", title: "Plain" }];
    const { container } = render(<ImmersiveCaseStudy slug="ledger" />);
    expect(container.querySelector('[data-part="handoff"]')).toBeNull();
    expect(screen.queryByText("Next project")).toBeNull();
  });

  it("has no hand-off when the case study is not among the work sections", () => {
    state.study = study("ledger", "Ledger");
    state.items = [study("atlas", "Atlas")];
    const { container } = render(<ImmersiveCaseStudy slug="ledger" />);
    expect(container.querySelector('[data-part="handoff"]')).toBeNull();
    expect(screen.queryByRole("link", { name: "Ledger" })).toBeNull();
  });
});
