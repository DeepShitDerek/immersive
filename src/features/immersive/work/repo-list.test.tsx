import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const list = vi.hoisted(() => ({
  value: {
    state: "ready" as string,
    repos: [] as unknown[],
    shown: 2,
    remaining: 0,
    more: vi.fn(),
    username: "ada lovelace",
    perPage: 2,
  },
}));
vi.mock("@/features/github/use-repo-list", () => ({
  useRepoList: () => list.value,
}));

import { RepoList } from "./repo-list";

const repo = (id: number, extra = {}) => ({
  id,
  name: `repo-${id}`,
  html_url: `https://github.com/ada/repo-${id}`,
  description: `About repo ${id}`,
  language: "Go",
  stargazers_count: 1200 + id,
  forks_count: 3,
  ...extra,
});

afterEach(() => {
  cleanup();
  list.value = { ...list.value, state: "ready", repos: [], remaining: 0 };
  list.value.more.mockClear();
});

describe("RepoList", () => {
  it("lists the shown repositories as rows that link to GitHub", () => {
    list.value = {
      ...list.value,
      repos: [repo(1), repo(2), repo(3)],
      remaining: 1,
    };
    const { container } = render(<RepoList />);
    expect(container.querySelectorAll("[data-row]")).toHaveLength(2);
    const link = screen.getByRole("link", { name: "repo-1" });
    expect(link.getAttribute("href")).toBe("https://github.com/ada/repo-1");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    const row = container.querySelector("[data-row]")!;
    expect(row.textContent).toContain("About repo 1");
    expect(row.textContent).toContain("Go");
    expect(row.textContent).toContain("1,201");
  });

  it("offers the rest, and the owner's profile", () => {
    list.value = {
      ...list.value,
      repos: [repo(1), repo(2), repo(3)],
      remaining: 1,
    };
    render(<RepoList />);
    fireEvent.click(screen.getByRole("button", { name: /Load more/ }));
    expect(list.value.more).toHaveBeenCalledTimes(1);
    expect(
      screen
        .getByRole("link", { name: /View all on GitHub/ })
        .getAttribute("href"),
    ).toBe("https://github.com/ada%20lovelace?tab=repositories");
  });

  it("has no Load more when everything is shown", () => {
    list.value = { ...list.value, repos: [repo(1)], remaining: 0 };
    render(<RepoList />);
    expect(screen.queryByRole("button", { name: /Load more/ })).toBeNull();
  });

  it("does not link a repository with an unsafe address, or invent a description", () => {
    list.value = {
      ...list.value,
      repos: [
        repo(1, {
          html_url: "javascript:alert(1)",
          description: null,
          language: null,
        }),
      ],
    };
    const { container } = render(<RepoList />);
    expect(screen.queryByRole("link", { name: "repo-1" })).toBeNull();
    expect(container.textContent).toContain("repo-1");
    expect(container.querySelectorAll("[data-row] p:empty")).toHaveLength(0);
  });

  it("says so when GitHub could not be reached", () => {
    list.value = { ...list.value, state: "error" };
    render(<RepoList />);
    expect(
      screen.getByText(
        "Repositories couldn't be loaded from GitHub right now.",
      ),
    ).toBeInTheDocument();
  });

  it("renders nothing when the list is switched off, and is busy while loading", () => {
    list.value = { ...list.value, state: "hidden" };
    const hidden = render(<RepoList />);
    expect(hidden.container.innerHTML).toBe("");
    hidden.unmount();
    list.value = { ...list.value, state: "loading" };
    const { container } = render(<RepoList />);
    expect(container.querySelector("[aria-busy]")).not.toBeNull();
  });
});
