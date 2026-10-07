import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The post the browser's query returns: as built, or edited since.
let current = {
  id: "p1",
  slug: "hello",
  title: "Hello",
  content: "Built body",
  updated_at: "2026-09-25T10:00:00Z",
};
vi.mock("@/store/api/publicApi", () => ({
  useGetBlogPostBySlugQuery: () => ({
    data: current,
    isLoading: false,
    isError: false,
  }),
  useGetSiteIdentityQuery: () => ({ data: undefined }),
  useIncrementPostViewMutation: () => [vi.fn()],
}));
const loadPostContent = vi.fn(() => new Promise(() => {}));
vi.mock("./post-content-loader", () => ({ loadPostContent }));
vi.mock("next/navigation", () => ({ useSearchParams: () => null }));
vi.mock("next/dynamic", () => ({
  default: () => () => <div>client-rendered body</div>,
}));

// jsdom has neither; the page's reveal animation and reading progress use them.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
globalThis.IntersectionObserver ??=
  NoopObserver as unknown as typeof IntersectionObserver;
globalThis.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver;

const { PostPage } = await import("./post-page");
const { contentHash } = await import("./content-hash");

const built = {
  contentHash: contentHash("Built body"),
  body: <p>build-time body</p>,
};

beforeEach(() => {
  loadPostContent.mockClear();
});

describe("a prerendered post's body", () => {
  it("uses the HTML rendered at build, and never loads the markdown pipeline", () => {
    render(<PostPage slug="hello" prerendered={built} />);
    expect(screen.getByText("build-time body")).toBeTruthy();
    expect(screen.queryByText("client-rendered body")).toBeNull();
    expect(loadPostContent).not.toHaveBeenCalled();
  });

  it("keeps the built body when only other fields changed (updated_at, views)", () => {
    current = { ...current, updated_at: "2026-09-27T09:00:00+00:00" };
    render(<PostPage slug="hello" prerendered={built} />);
    expect(screen.getByText("build-time body")).toBeTruthy();
    expect(loadPostContent).not.toHaveBeenCalled();
  });

  it("renders in the browser when the post changed since the build", () => {
    current = { ...current, content: "Edited body" };
    render(<PostPage slug="hello" prerendered={built} />);
    expect(screen.getByText("client-rendered body")).toBeTruthy();
    expect(loadPostContent).toHaveBeenCalled();
  });

  it("renders in the browser for a post published since the build (/blog/view)", () => {
    render(<PostPage slug="hello" />);
    expect(screen.getByText("client-rendered body")).toBeTruthy();
    expect(loadPostContent).toHaveBeenCalled();
  });
});
