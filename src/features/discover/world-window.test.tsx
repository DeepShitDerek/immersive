import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetched: string[] = [];
const { search } = vi.hoisted(() => ({ search: "?lane=world" }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/discover/",
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
const { empty, mutation } = vi.hoisted(() => ({
  empty: () => ({ data: [], error: undefined, refetch: () => {} }),
  mutation: () => [() => {}, { isLoading: false }],
}));
vi.mock("@/store/api/adminApi", () => ({
  useGetDiscoverPlacesQuery: empty,
  useGetDiscoverTopicsQuery: empty,
  useGetIntegrationSettingsQuery: () => ({ data: undefined }),
  useDeleteDiscoverPlaceMutation: mutation,
  useDeleteDiscoverTopicMutation: mutation,
  useSaveDiscoverPlaceMutation: mutation,
  useSaveDiscoverTopicMutation: mutation,
}));
vi.mock("@/features/money/data/money-api", () => ({
  useGetMoneySettingsQuery: () => ({ data: undefined }),
}));
vi.mock("@/components/providers/confirm-dialog-provider", () => ({
  useConfirm: () => vi.fn(),
}));

import DiscoverPage from "./discover-page";

describe("What happened: the time window", () => {
  beforeEach(() => {
    // jsdom has no layout; the tabs scroll the current one into view.
    Element.prototype.scrollIntoView = () => {};
    fetched.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        fetched.push(String(url));
        return { ok: true, json: async () => ({ hits: [], items: [] }) };
      }),
    );
  });

  it("refetches the windowed panels when another window is chosen", async () => {
    render(<DiscoverPage />);
    await waitFor(() =>
      expect(
        fetched.some((u) =>
          u.includes("hn.algolia.com/api/v1/search?tags=story"),
        ),
      ).toBe(true),
    );
    const before = fetched.filter((u) =>
      u.includes("tags=story&numericFilters"),
    ).length;

    fireEvent.click(screen.getByRole("radio", { name: "This week" }));

    await waitFor(() =>
      expect(
        fetched.filter((u) => u.includes("tags=story&numericFilters")).length,
      ).toBeGreaterThan(before),
    );
    expect(
      screen
        .getByRole("radio", { name: "This week" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    // Most read follows it too: the seven daily top lists.
    await waitFor(() =>
      expect(
        fetched.filter((u) => u.includes("pageviews/top/en.wikipedia")).length,
      ).toBe(7),
    );
  });
});
