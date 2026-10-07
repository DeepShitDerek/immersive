import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/store/api/publicApi", () => ({
  useGetSectionsByPathQuery: () => ({
    data: [
      {
        id: "s",
        portfolio_items: [
          {
            id: "a",
            title: "Ledger",
            tags: ["Go"],
            slug: "ledger",
            has_case_study: true,
            display_order: 0,
          },
          {
            id: "b",
            title: "Atlas",
            tags: ["Rust"],
            link_url: "https://example.com/",
            display_order: 1,
          },
          { id: "c", title: "Plain", tags: [], display_order: 2 },
        ],
      },
    ],
  }),
  useGetSiteIdentityQuery: () => ({ data: undefined }),
}));
vi.mock("@/store/public-preload", () => ({
  useBuiltCaseStudySlugs: () => ["ledger"],
}));
const repoState = vi.hoisted(() => ({ value: "ready" }));
vi.mock("@/features/github/use-repo-list", () => ({
  useRepoList: () => ({ state: repoState.value }),
}));
vi.mock("./repo-list", () => ({ RepoList: () => <p>the repo list</p> }));

import ImmersiveWork from "./immersive-work";

const titles = () =>
  screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/work/");
});

describe("ImmersiveWork", () => {
  it("shows the open-source section only when there is a repository list", () => {
    const shown = render(<ImmersiveWork />);
    expect(screen.getByText("the repo list")).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: "Open source & experiments" }),
    ).not.toBeNull();
    shown.unmount();

    repoState.value = "hidden";
    render(<ImmersiveWork />);
    expect(screen.queryByText("the repo list")).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Open source & experiments" }),
    ).toBeNull();
    repoState.value = "ready";
  });

  it("lists every project, numbered, with the right link for each", () => {
    render(<ImmersiveWork />);
    expect(titles().slice(0, 3)).toEqual(["Ledger", "Atlas", "Plain"]);
    expect(
      screen.getByRole("link", { name: "Ledger" }).getAttribute("href"),
    ).toMatch(/^\/work\/ledger\/?$/);
    expect(
      screen.getByRole("link", { name: "Atlas" }).getAttribute("href"),
    ).toBe("https://example.com/");
    expect(screen.queryByRole("link", { name: "Plain" })).toBeNull();
    expect(screen.getByText("01")).not.toBeNull();
    expect(screen.getByText("03")).not.toBeNull();
  });

  it("filters by tag and writes it to the URL", () => {
    render(<ImmersiveWork />);
    fireEvent.click(screen.getByRole("button", { name: "Rust" }));
    expect(titles()).toContain("Atlas");
    expect(titles()).not.toContain("Ledger");
    expect(window.location.search).toBe("?tag=Rust");
    expect(
      screen.getByRole("button", { name: "Rust" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(titles()).toContain("Ledger");
    expect(window.location.search).toBe("");
  });

  it("reads the tag from the URL", () => {
    window.history.replaceState(null, "", "/work/?tag=go");
    render(<ImmersiveWork />);
    expect(titles()).toContain("Ledger");
    expect(titles()).not.toContain("Atlas");
  });

  it("shows everything for a tag no project has", () => {
    window.history.replaceState(null, "", "/work/?tag=nope");
    render(<ImmersiveWork />);
    expect(titles().slice(0, 3)).toEqual(["Ledger", "Atlas", "Plain"]);
    expect(
      screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });
});
