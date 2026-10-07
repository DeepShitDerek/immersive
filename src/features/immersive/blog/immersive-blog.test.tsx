import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const state = vi.hoisted(() => ({
  posts: [] as unknown[],
  isError: false,
  refetch: vi.fn(),
  search: "",
}));

vi.mock("@/store/api/publicApi", () => ({
  useGetPublishedBlogPostsQuery: () => ({
    data: state.posts,
    isLoading: false,
    isError: state.isError,
    refetch: state.refetch,
  }),
  useGetSiteIdentityQuery: () => ({ data: undefined }),
}));
vi.mock("@/hooks/use-hydrated", () => ({ useDisplayTimeZone: () => "UTC" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(state.search),
}));

import ImmersiveBlog from "./immersive-blog";

const full = [
  {
    id: "1",
    slug: "alpha",
    title: "Alpha ledger",
    excerpt: "About Postgres",
    tags: ["go", "db"],
    published_at: "2025-03-15T00:00:00Z",
    content: "word ".repeat(450),
  },
  {
    id: "2",
    slug: "beta",
    title: "Beta",
    excerpt: "Second",
    tags: ["rust"],
    published_at: "2025-02-15T00:00:00Z",
    content: "x",
  },
  { id: "3", slug: "gamma", title: "Gamma", tags: null, content: "x" },
];

const rows = () =>
  screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

afterEach(() => {
  cleanup();
  state.posts = [];
  state.isError = false;
  state.search = "";
  state.refetch.mockClear();
});

describe("ImmersiveBlog", () => {
  it("lists every post as a row with its link, date and reading time", () => {
    state.posts = full;
    const { container } = render(<ImmersiveBlog builtSlugs={["alpha"]} />);
    expect(rows()).toEqual(["Alpha ledger", "Beta", "Gamma"]);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "Alpha ledger" }).getAttribute("href"),
    ).toMatch(/^\/blog\/alpha\/?$/);
    expect(
      screen.getByRole("link", { name: "Beta" }).getAttribute("href"),
    ).toMatch(/^\/blog\/view\/?\?slug=beta$/);
    const first = container.querySelector("[data-row]")!;
    expect(first.querySelector("time")!.getAttribute("datetime")).toBe(
      "2025-03-15T00:00:00Z",
    );
    expect(first.textContent).toMatch(/\d+ min read/);
    expect(first.textContent).toContain("About Postgres");
  });

  it("renders a post with no excerpt, tags or date without empty leftovers", () => {
    state.posts = [full[2]];
    const { container } = render(<ImmersiveBlog />);
    const row = container.querySelector("[data-row]")!;
    expect(row.querySelector("time")).toBeNull();
    expect(row.querySelectorAll("p:empty")).toHaveLength(0);
    expect(row.textContent).not.toMatch(/·\s*\d+ min read/);
    expect(row.textContent).toMatch(/\d+ min read/);
  });

  it("narrows the list as you search, and restores it", () => {
    state.posts = full;
    render(<ImmersiveBlog />);
    const box = screen.getByRole("searchbox", { name: "Search posts" });
    fireEvent.change(box, { target: { value: "postgres" } });
    expect(rows()).toEqual(["Alpha ledger"]);
    fireEvent.change(box, { target: { value: "" } });
    expect(rows()).toHaveLength(3);
  });

  it("filters by a topic chip and clears it on a second press", () => {
    state.posts = full;
    render(<ImmersiveBlog />);
    const chip = screen.getByRole("button", { name: /^rust/ });
    fireEvent.click(chip);
    expect(rows()).toEqual(["Beta"]);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(chip);
    expect(rows()).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("arrives filtered from a ?tag= link", () => {
    state.posts = full;
    state.search = "tag=rust";
    render(<ImmersiveBlog />);
    expect(rows()).toEqual(["Beta"]);
    expect(
      screen
        .getByRole("button", { name: /^rust/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("says so when nothing matches, and offers a way back", () => {
    state.posts = full;
    render(<ImmersiveBlog />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("No posts match")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Clear filters/ }));
    expect(rows()).toHaveLength(3);
  });

  it("says so when nothing is published", () => {
    render(<ImmersiveBlog />);
    expect(screen.getByText("Nothing published yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Clear filters/ })).toBeNull();
  });

  it("offers a retry when the posts did not load", () => {
    state.isError = true;
    render(<ImmersiveBlog />);
    expect(screen.getByRole("alert").textContent).toContain(
      "The posts didn't load",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(state.refetch).toHaveBeenCalledTimes(1);
  });
});
