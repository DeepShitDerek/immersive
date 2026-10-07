import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";

const state = vi.hoisted(() => ({
  post: undefined as unknown,
  increment: vi.fn(),
}));

vi.mock("@/store/api/publicApi", () => ({
  useGetBlogPostBySlugQuery: () => ({
    data: state.post,
    isLoading: false,
    isError: false,
  }),
  useGetSiteIdentityQuery: () => ({ data: undefined }),
  useIncrementPostViewMutation: () => [state.increment],
}));
// The count only happens against a real database, in production.
vi.mock("@/lib/config", () => ({ isSupabaseConfigured: true }));
vi.mock("@/hooks/use-hydrated", () => ({ useDisplayTimeZone: () => "UTC" }));
vi.mock("./post-content-loader", () => ({
  loadPostContent: () => new Promise(() => {}),
}));
vi.mock("./table-of-contents", () => ({
  useHeadings: () => ({ headings: [], activeId: null }),
}));

import { usePostPage } from "./use-post-page";

const post = (extra = {}) => ({
  id: "p1",
  slug: "hello",
  title: "Hello",
  content: "Body",
  views: 10,
  ...extra,
});

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.useFakeTimers();
  state.increment.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  state.post = undefined;
});

describe("usePostPage view counting", () => {
  it("does not count a visit shorter than five seconds", () => {
    state.post = post();
    const { unmount } = renderHook(() => usePostPage("hello"));
    vi.advanceTimersByTime(4000);
    unmount();
    vi.advanceTimersByTime(4000);
    expect(state.increment).not.toHaveBeenCalled();
  });

  it("counts one view once the reader has stayed", () => {
    state.post = post();
    renderHook(() => usePostPage("hello"));
    vi.advanceTimersByTime(6000);
    expect(state.increment).toHaveBeenCalledTimes(1);
    expect(state.increment).toHaveBeenCalledWith("p1");
  });

  it("still counts one view when the post is refetched with the new count", () => {
    // Counting a view invalidates the post, which comes back as a new object
    // with views + 1. That must not start another five-second timer: a reader
    // who stays a minute is one view, not twelve.
    state.post = post();
    const { rerender } = renderHook(() => usePostPage("hello"));
    vi.advanceTimersByTime(6000);
    for (let n = 11; n < 16; n += 1) {
      state.post = post({ views: n });
      rerender();
      vi.advanceTimersByTime(6000);
    }
    expect(state.increment).toHaveBeenCalledTimes(1);
  });

  it("counts again for a different post", () => {
    state.post = post();
    const { rerender } = renderHook(() => usePostPage("hello"));
    vi.advanceTimersByTime(6000);
    state.post = post({ id: "p2", slug: "other" });
    rerender();
    vi.advanceTimersByTime(6000);
    expect(state.increment.mock.calls.map(([id]) => id)).toEqual(["p1", "p2"]);
  });

  it("does not count an automated browser", () => {
    Object.defineProperty(navigator, "webdriver", {
      value: true,
      configurable: true,
    });
    state.post = post();
    renderHook(() => usePostPage("hello"));
    vi.advanceTimersByTime(6000);
    Object.defineProperty(navigator, "webdriver", {
      value: false,
      configurable: true,
    });
    expect(state.increment).not.toHaveBeenCalled();
  });
});
