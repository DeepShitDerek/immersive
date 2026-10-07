import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const state = vi.hoisted(() => ({
  post: undefined as unknown,
  isLoading: false,
  isError: false,
  posts: [] as unknown[],
}));
const loadPostContent = vi.hoisted(() => vi.fn(() => new Promise(() => {})));
const increment = vi.hoisted(() => vi.fn());

vi.mock("@/store/api/publicApi", () => ({
  useGetBlogPostBySlugQuery: () => ({
    data: state.post,
    isLoading: state.isLoading,
    isError: state.isError,
  }),
  useGetPublishedBlogPostsQuery: () => ({ data: state.posts }),
  useGetSiteIdentityQuery: () => ({
    data: { profile_data: { name: "Ada Lovelace", site_style: "classic" } },
  }),
  useIncrementPostViewMutation: () => [increment],
}));
vi.mock("@/features/blog/post-content-loader", () => ({ loadPostContent }));
vi.mock("@/features/blog/post-page", () => ({
  PostPage: ({ slug }: { slug: string }) => (
    <p>classic states for {slug || "nothing"}</p>
  ),
}));
vi.mock("@/hooks/use-hydrated", () => ({ useDisplayTimeZone: () => "UTC" }));
vi.mock("next/dynamic", () => ({
  default: () => () => <div>client-rendered body</div>,
}));

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

const { default: ImmersivePost } = await import("./immersive-post");
const { contentHash } = await import("@/features/blog/content-hash");

const full = {
  id: "p1",
  slug: "hello",
  title: "Hello world",
  excerpt: "What this post is about.",
  tags: ["go", "db"],
  published_at: "2025-03-15T00:00:00Z",
  content: "Built body",
  show_toc: true,
};
const bare = { id: "p2", slug: "bare", title: "Bare", content: "x" };
const built = {
  contentHash: contentHash("Built body"),
  body: <p>build-time body</p>,
};

afterEach(() => {
  cleanup();
  state.post = undefined;
  state.isLoading = false;
  state.isError = false;
  state.posts = [];
  loadPostContent.mockClear();
});

describe("ImmersivePost", () => {
  it("hands loading, not-found and a missing slug to the Classic page", () => {
    state.isLoading = true;
    render(<ImmersivePost slug="hello" />);
    expect(screen.getByText("classic states for hello")).toBeInTheDocument();

    cleanup();
    state.isLoading = false;
    state.isError = true;
    render(<ImmersivePost slug="nope" />);
    expect(screen.getByText("classic states for nope")).toBeInTheDocument();

    cleanup();
    render(<ImmersivePost slug="" />);
    expect(screen.getByText("classic states for nothing")).toBeInTheDocument();
  });

  it("opens on a title card and carries the article, tags and sharing", () => {
    state.post = full;
    const { container } = render(<ImmersivePost slug="hello" />);
    const card = container.querySelector('[data-part="title"]')!;
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(card.contains(h1[0])).toBe(true);
    expect(h1[0].textContent).toBe("Hello world");
    expect(card.textContent).toContain("What this post is about.");
    expect(card.textContent).toContain("Ada Lovelace");
    expect(card.textContent).toContain("March 15, 2025");
    expect(card.textContent).toMatch(/\d+ min read/);

    expect(container.querySelector("#post-article")!.textContent).toContain(
      "client-rendered body",
    );
    expect(
      screen.getByRole("link", { name: "db" }).getAttribute("href"),
    ).toMatch(/^\/blog\/?\?tag=db$/);
    for (const name of ["Share on X", "Share on LinkedIn", "Copy link"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("makes a card from a title alone", () => {
    state.post = bare;
    const { container } = render(<ImmersivePost slug="bare" />);
    const card = container.querySelector('[data-part="title"]')!;
    expect(card.textContent).toContain("Bare");
    expect(card.textContent).toMatch(/\d+ min read/);
    // No date: one separator, between the author and the reading time.
    expect(card.lastElementChild!.textContent).toMatch(
      /^Ada Lovelace · \d+ min read$/,
    );
    expect(card.querySelector("time")).toBeNull();
    expect(container.querySelectorAll("p:empty")).toHaveLength(0);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("list", { name: "Topics" })).toBeNull();
  });

  it("shows the build's body while it is current, without the markdown pipeline", () => {
    state.post = full;
    render(<ImmersivePost slug="hello" prerendered={built} />);
    expect(screen.getByText("build-time body")).toBeInTheDocument();
    expect(screen.queryByText("client-rendered body")).toBeNull();
    expect(loadPostContent).not.toHaveBeenCalled();
  });

  it("renders in the browser when the post changed since the build", () => {
    state.post = { ...full, content: "Edited body" };
    render(<ImmersivePost slug="hello" prerendered={built} />);
    expect(screen.getByText("client-rendered body")).toBeInTheDocument();
    expect(loadPostContent).toHaveBeenCalled();
  });

  it("hands off to the next post, when there is one", () => {
    state.post = full;
    state.posts = [full, bare];
    const { container } = render(
      <ImmersivePost slug="hello" builtSlugs={["bare"]} />,
    );
    const handoff = container.querySelector('[data-part="handoff"]')!;
    const link = handoff.querySelector("a")!;
    expect(link.textContent).toBe("Bare");
    expect(link.getAttribute("href")).toMatch(/^\/blog\/bare\/?$/);
  });

  it("has no hand-off for the only post, or a post not in the list", () => {
    state.post = full;
    state.posts = [full];
    const one = render(<ImmersivePost slug="hello" />);
    expect(one.container.querySelector('[data-part="handoff"]')).toBeNull();
    one.unmount();
    state.posts = [bare];
    const { container } = render(<ImmersivePost slug="hello" />);
    expect(container.querySelector('[data-part="handoff"]')).toBeNull();
  });

  it("counts a view once, not once per component that reads the post", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.useFakeTimers();
    increment.mockClear();
    state.post = full;
    render(<ImmersivePost slug="hello" />);
    await vi.advanceTimersByTimeAsync(6000);
    vi.useRealTimers();
    vi.unstubAllEnvs();
    expect(increment.mock.calls.length).toBeLessThanOrEqual(1);
    expect(increment.mock.calls.every(([id]) => id === "p1")).toBe(true);
  });

  it("does not render an unsafe cover image", () => {
    state.post = { ...full, cover_image_url: "javascript:alert(1)" };
    const { container } = render(<ImmersivePost slug="hello" />);
    expect(container.querySelector("img")).toBeNull();
  });
});
