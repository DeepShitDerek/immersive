import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({
  updates: [
    {
      id: "u1",
      title: "Started a new job",
      content: "",
      category: "milestone",
      is_published: true,
      is_pinned: false,
      tags: [],
      created_at: "2026-09-30T10:00:00Z",
    },
    {
      id: "u2",
      title: "Draft thought",
      content: "",
      category: "thought",
      is_published: false,
      is_pinned: false,
      tags: [],
      created_at: "2026-09-29T10:00:00Z",
    },
  ],
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));
vi.mock("@/hooks/use-unsaved-guard", () => ({ useUnsavedGuard: () => {} }));
vi.mock("@/store/api/adminApi", () => {
  const mutation = () => [
    () => ({ unwrap: async () => ({}) }),
    { isLoading: false },
  ];
  return {
    useGetLifeUpdatesQuery: () => ({
      data: data.updates,
      isLoading: false,
      error: undefined,
      refetch: () => {},
    }),
    useAddLifeUpdateMutation: mutation,
    useUpdateLifeUpdateMutation: mutation,
    useDeleteLifeUpdateMutation: mutation,
  };
});

import LifeUpdatesPage from "./life-updates-page";

describe("Updates", () => {
  it("keeps the composer closed until asked, without losing what was typed", () => {
    Element.prototype.scrollIntoView = () => {};
    const { container } = render(<LifeUpdatesPage />);
    const opener = screen.getByRole("button", { name: "What's new?" });
    // The composer is mounted but hidden, so a draft survives closing it.
    expect(
      container.querySelector("[hidden] textarea, [hidden] input"),
    ).toBeTruthy();
    fireEvent.click(opener);
    expect(screen.queryByRole("button", { name: "What's new?" })).toBeNull();
    expect(
      container.querySelector("[hidden] textarea, [hidden] input"),
    ).toBeNull();
    // Focus lands in the composer, not on the page.
    expect(["INPUT", "TEXTAREA"]).toContain(document.activeElement?.tagName);
  });

  it("filters by status from tabs that carry their counts", () => {
    Element.prototype.scrollIntoView = () => {};
    render(<LifeUpdatesPage />);
    const nav = screen.getByRole("navigation", { name: "Update status" });
    fireEvent.click(screen.getByRole("button", { name: "Drafts 1" }));
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe(
      "Drafts 1",
    );
    expect(screen.getByText("Draft thought")).toBeTruthy();
    expect(screen.queryByText("Started a new job")).toBeNull();
  });
});
