import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { normalizeSiteContent } from "@/lib/site-identity";

/*
  A scene only runs when its `useScene` call sits below the scroll provider.
  A layout that calls the hook and then renders the provider as its own child
  compiles, passes every content test, downloads the motion libraries, and
  never moves. These tests render each layout under a real provider with a
  stub animation library and assert that a scene was actually built.
*/

const lib = vi.hoisted(() => ({ tweens: [] as string[] }));
const tween = (kind: string) => () => {
  lib.tweens.push(kind);
  return {};
};
vi.mock("gsap", () => ({
  gsap: {
    registerPlugin: () => {},
    ticker: { add: () => {}, remove: () => {}, lagSmoothing: () => {} },
    from: tween("from"),
    to: tween("to"),
    fromTo: tween("fromTo"),
    context: (run: () => void) => {
      run();
      return { revert: () => {} };
    },
  },
}));
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: { update: () => {} } }));
vi.mock("lenis", () => ({
  default: class {
    on() {}
    raf() {}
    destroy() {}
  },
}));

const identity = (() => {
  const base = normalizeSiteContent({
    profile_data: {
      name: "Ada",
      title: "Engineer",
      bio: ["A lead paragraph to light up.", "A second paragraph."],
      site_style: "noir",
      github_projects_config: { username: "ada", show: true },
    },
    social_links: [
      {
        id: "github",
        label: "GitHub",
        url: "https://github.com/ada",
        is_visible: true,
      },
    ],
  } as never);
  return base;
})();

vi.mock("@/store/api/publicApi", () => ({
  useGetSiteIdentityQuery: () => ({ data: identity, isLoading: false }),
  useGetPublishedBlogPostsQuery: () => ({
    data: [{ id: "1", slug: "a", title: "A post", content: "x" }],
    isLoading: false,
    isError: false,
  }),
  useGetPublishedLifeUpdatesQuery: () => ({
    data: [
      {
        id: "u",
        category: "thought",
        title: "An update",
        created_at: "2025-05-10T09:00:00Z",
      },
    ],
    isLoading: false,
  }),
  useGetSectionsByPathQuery: () => ({
    data: [
      { id: "s", portfolio_items: [{ id: "p", title: "Ledger", tags: [] }] },
    ],
  }),
  useGetGitHubReposQuery: () => ({
    data: [
      {
        id: 1,
        name: "repo",
        html_url: "https://github.com/ada/repo",
        stargazers_count: 1,
      },
    ],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/hooks/use-hydrated", () => ({
  useDisplayTimeZone: () => "UTC",
  useHydrated: () => false,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/store/public-preload", () => ({ useBuiltCaseStudySlugs: () => [] }));
vi.mock("@/features/sections/dynamic-page-content", () => ({
  DynamicPageContent: () => null,
}));
vi.mock("@/features/contact/contact-form", () => ({
  ContactForm: () => null,
}));

import ImmersiveBlog from "./blog/immersive-blog";
import ImmersiveUpdates from "./updates/immersive-updates";
import ImmersiveAbout from "./about/immersive-about";
import ImmersiveContact from "./contact/immersive-contact";
import ImmersiveWork from "./work/immersive-work";

beforeEach(() => {
  lib.tweens.length = 0;
  // A desktop with a mouse and no reduced-motion preference.
  window.matchMedia = ((query: string) => ({
    matches: query.includes("min-width"),
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as never;
});
afterEach(cleanup);

describe("each layout's scroll scenes are wired to the provider", () => {
  it.each([
    ["the blog list", <ImmersiveBlog key="b" />, "from"],
    ["updates", <ImmersiveUpdates key="u" />, "from"],
    ["about", <ImmersiveAbout key="a" />, "fromTo"],
    ["contact", <ImmersiveContact key="c" />, "from"],
    ["work, for its repository list", <ImmersiveWork key="w" />, "from"],
  ])("%s builds a scene", async (_name, page, kind) => {
    render(page);
    await waitFor(() => expect(lib.tweens).toContain(kind));
  });
});
