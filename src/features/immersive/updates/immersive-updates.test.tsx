import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

const state = vi.hoisted(() => ({ updates: [] as unknown[] }));

vi.mock("@/store/api/publicApi", () => ({
  useGetPublishedLifeUpdatesQuery: () => ({
    data: state.updates,
    isLoading: false,
  }),
  useGetSiteIdentityQuery: () => ({ data: undefined }),
}));
vi.mock("@/hooks/use-hydrated", () => ({
  useDisplayTimeZone: () => "UTC",
  useHydrated: () => false,
}));
vi.mock("@/features/sections/dynamic-page-content", () => ({
  DynamicPageContent: ({ pagePath }: { pagePath: string }) => (
    <p>cms sections for {pagePath}</p>
  ),
}));

import ImmersiveUpdates from "./immersive-updates";

const u = (id: string, created_at: string | undefined, extra = {}) => ({
  id,
  category: "thought",
  title: `Title ${id}`,
  content: `Text ${id}`,
  created_at,
  ...extra,
});

const five = [
  u("may", "2025-05-10T09:00:00Z", { category: "photo", tags: ["trip"] }),
  u("apr2", "2025-04-20T09:00:00Z", { category: "activity" }),
  u("apr1", "2025-04-02T09:00:00Z", { tags: ["trip"] }),
  u("mar", "2025-03-10T09:00:00Z", { category: "watching" }),
  u("pin", "2025-01-10T09:00:00Z", {
    is_pinned: true,
    category: "milestone",
    tags: ["trip"],
  }),
];

// Month headings only: the pinned update above them is an h2 as well.
const months = () =>
  [...document.querySelectorAll("section[data-month] h2")].map(
    (h) => h.textContent,
  );
const entries = (container: HTMLElement) =>
  [...container.querySelectorAll("[data-row] h3")].map((h) => h.textContent);

afterEach(() => {
  cleanup();
  state.updates = [];
});

describe("ImmersiveUpdates", () => {
  it("opens on the pinned update and groups the rest under month headings", () => {
    state.updates = five;
    const { container } = render(<ImmersiveUpdates />);
    const pinned = container.querySelector('[data-part="pinned"]')!;
    expect(pinned.textContent).toContain("Title pin");
    expect(months()).toEqual(["May 2025", "April 2025", "March 2025"]);
    expect(entries(container)).toEqual([
      "Title may",
      "Title apr2",
      "Title apr1",
      "Title mar",
    ]);
    const april = screen.getByRole("region", { name: "April 2025" });
    expect(within(april).getAllByRole("article")).toHaveLength(2);
    const first = container.querySelector("[data-row]")!;
    expect(first.querySelector("time")!.getAttribute("datetime")).toBe(
      "2025-05-10T09:00:00Z",
    );
    expect(first.textContent).toContain("Photo");
    expect(first.textContent).toContain("Text may");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("cms sections for /updates")).toBeInTheDocument();
  });

  it("shows an untitled update by its text, with no empty heading", () => {
    state.updates = [
      u("x", "2025-05-10T09:00:00Z", { title: null }),
      u("img", "2025-05-09T09:00:00Z", {
        title: "",
        content: "",
        image_url: "https://example.com/p.png",
      }),
    ];
    const { container } = render(<ImmersiveUpdates />);
    expect(container.querySelectorAll("h3")).toHaveLength(0);
    expect(container.textContent).toContain("Text x");
    expect(container.querySelector("img")!.getAttribute("src")).toBe(
      "https://example.com/p.png",
    );
    expect(container.querySelectorAll("[data-row] p:empty")).toHaveLength(0);
  });

  it("never prints an invalid date", () => {
    state.updates = [
      u("bad", "not-a-date"),
      u("none", undefined),
      u("ok", "2025-05-10T09:00:00Z"),
    ];
    const { container } = render(<ImmersiveUpdates />);
    expect(container.textContent).not.toContain("Invalid Date");
    expect(months()).toContain("Undated");
    expect(entries(container)).toHaveLength(3);
  });

  it("filters by category and then includes a pinned match", () => {
    state.updates = five;
    const { container } = render(<ImmersiveUpdates />);
    fireEvent.click(screen.getByRole("button", { name: /Milestone/ }));
    expect(entries(container)).toEqual(["Title pin"]);
    expect(
      screen
        .getByRole("button", { name: /Milestone/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByText("That's every match")).toBeInTheDocument();
    expect(screen.getByText("1 of 5 updates")).toBeInTheDocument();
  });

  it("hides the category filter when there is only one category", () => {
    state.updates = [u("a", "2025-05-10T09:00:00Z")];
    render(<ImmersiveUpdates />);
    expect(screen.queryByRole("button", { name: /^All/ })).toBeNull();
  });

  it("filters by a tag pressed on an entry, and clears it", () => {
    state.updates = five;
    const { container } = render(<ImmersiveUpdates />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Show updates tagged trip" })[0],
    );
    expect(entries(container)).toEqual([
      "Title may",
      "Title apr1",
      "Title pin",
    ]);
    fireEvent.click(
      screen.getByRole("button", { name: "Stop filtering by trip" }),
    );
    expect(entries(container)).toHaveLength(4);
  });

  it("says so when a search matches nothing, and offers a way back", () => {
    state.updates = five;
    const { container } = render(<ImmersiveUpdates />);
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search updates" }),
      { target: { value: "zzz" } },
    );
    expect(screen.getByText("No updates match.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Clear filters/ }));
    expect(entries(container)).toHaveLength(4);
    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
    expect(
      screen.getByText("5 updates since January 2025"),
    ).toBeInTheDocument();
  });

  it("says so when nothing is posted", () => {
    render(<ImmersiveUpdates />);
    expect(screen.getByText("Nothing posted yet.")).toBeInTheDocument();
  });

  it("does not render an unsafe image", () => {
    state.updates = [
      u("x", "2025-05-10T09:00:00Z", { image_url: "javascript:alert(1)" }),
    ];
    const { container } = render(<ImmersiveUpdates />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("keeps one heading per month when a filter brings a pinned update into the stream", () => {
    // The site's query returns pinned updates first. Filtered, they join the
    // stream, and grouping consecutive runs would then show their month twice.
    state.updates = [
      u("pin", "2025-03-05T09:00:00Z", { is_pinned: true, tags: ["trip"] }),
      u("may", "2025-05-10T09:00:00Z", { tags: ["trip"] }),
      u("mar", "2025-03-20T09:00:00Z", { tags: ["trip"] }),
    ];
    const { container } = render(<ImmersiveUpdates />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Show updates tagged trip" })[0],
    );
    const stream = [
      ...container.querySelectorAll("section[data-month] h2"),
    ].map((h) => h.textContent);
    expect(stream).toEqual(["May 2025", "March 2025"]);
    expect(entries(container)).toEqual(["Title may", "Title mar", "Title pin"]);
  });

  it("skips no heading level, with or without a pinned update", () => {
    for (const updates of [five, five.slice(0, 4)]) {
      state.updates = updates;
      const { container, unmount } = render(<ImmersiveUpdates />);
      const levels = [...container.querySelectorAll("h1,h2,h3,h4")].map((h) =>
        Number(h.tagName[1]),
      );
      expect(levels.filter((level) => level === 1)).toHaveLength(1);
      levels.reduce((previous, level) => {
        expect(level - previous).toBeLessThanOrEqual(1);
        return level;
      }, 0);
      unmount();
    }
  });
});
