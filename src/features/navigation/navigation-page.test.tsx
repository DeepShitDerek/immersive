import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  links: [
    {
      id: "1",
      label: "Work",
      href: "/work",
      is_visible: true,
      display_order: 0,
    },
    {
      id: "2",
      label: "Talks",
      href: "/talks",
      is_visible: false,
      display_order: 1,
    },
  ] as unknown[] | undefined,
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));
vi.mock("@/components/providers/confirm-dialog-provider", () => ({
  useConfirm: () => vi.fn(),
}));
vi.mock("@/store/api/adminApi", () => ({
  // Like RTK Query: the same data object between renders, or undefined while
  // there is none yet.
  useGetNavLinksAdminQuery: () => ({
    data: state.links,
    isLoading: false,
    error: undefined,
    refetch: () => {},
  }),
  useGetPortfolioContentQuery: () => ({ data: undefined }),
  useSaveNavLinkMutation: () => [() => ({ unwrap: async () => ({}) })],
  useDeleteNavLinkMutation: () => [() => ({ unwrap: async () => ({}) })],
}));

import NavigationPage from "./navigation-page";

describe("Navigation", () => {
  it("renders with no data yet, without an update loop", () => {
    // A `= []` default made a new array every render, and the effect that
    // copies the links into state set it every render: \"Maximum update depth
    // exceeded\" (reported by the owner).
    const saved = state.links;
    state.links = undefined;
    try {
      expect(() => render(<NavigationPage />)).not.toThrow();
    } finally {
      state.links = saved;
    }
  });

  it("says Hidden in words, and keeps edit and delete under one menu", () => {
    render(<NavigationPage />);
    const talks = screen.getByText("Talks").closest("li")!;
    expect(within(talks).getByText("Hidden")).toBeTruthy();
    expect(
      within(talks).getByRole("button", { name: "Actions: Talks" }),
    ).toBeTruthy();
    expect(
      within(talks).queryByRole("button", { name: /^Edit|^Delete/ }),
    ).toBeNull();
  });
});
