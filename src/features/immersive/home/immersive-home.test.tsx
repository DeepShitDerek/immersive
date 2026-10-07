import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { normalizeSiteContent } from "@/lib/site-identity";

const state = vi.hoisted(() => ({
  identity: undefined as unknown,
  sections: [] as unknown[],
  posts: [] as unknown[],
}));

vi.mock("@/store/api/publicApi", () => ({
  useGetSiteIdentityQuery: () => ({ data: state.identity }),
  useGetSectionsByPathQuery: () => ({ data: state.sections }),
  useGetPublishedBlogPostsQuery: () => ({ data: state.posts }),
  useGetNavLinksQuery: () => ({
    data: [{ label: "Work with me", href: "/contact" }],
  }),
}));
vi.mock("@/store/public-preload", () => ({ useBuiltCaseStudySlugs: () => [] }));
vi.mock("@/hooks/use-hydrated", () => ({ useDisplayTimeZone: () => "UTC" }));

import ImmersiveHome from "./immersive-home";

const beats = (container: HTMLElement) =>
  [...container.querySelectorAll("[data-beat]")].map((el) =>
    el.getAttribute("data-beat"),
  );

afterEach(() => {
  cleanup();
  state.sections = [];
  state.posts = [];
});

describe("ImmersiveHome", () => {
  it("renders only the opening and closing for a bare site", () => {
    const identity = normalizeSiteContent({});
    identity.social_links = [];
    Object.assign(identity.profile_data, {
      name: "Ada",
      title: "",
      headline: "",
      bio: [],
      proof: [],
      status_panel: { ...identity.profile_data.status_panel, show: false },
    });
    state.identity = identity;
    const { container } = render(<ImmersiveHome />);
    expect(beats(container)).toEqual(["opening", "closing"]);
    expect(screen.getByRole("heading", { level: 1 }).textContent?.trim()).toBe(
      "Ada",
    );
    expect(container.querySelectorAll("h2:empty")).toHaveLength(0);
  });

  it("puts the whole statement in the HTML, every word visible", () => {
    state.identity = normalizeSiteContent({
      profile_data: {
        name: "Ada",
        title: "Engineer",
        headline: "I build ledgers people trust.",
        bio: ["A paragraph."],
        proof: [{ value: "12", label: "Years" }],
        status_panel: { show: false },
      },
    } as never);
    const { container } = render(<ImmersiveHome />);
    expect(beats(container).slice(0, 3)).toEqual([
      "opening",
      "statement",
      "proof",
    ]);
    const statement = container.querySelector('[data-beat="statement"]')!;
    expect(statement.textContent).toContain("I build ledgers people trust.");
    expect(statement.querySelectorAll("[data-word]")).toHaveLength(5);
    for (const el of container.querySelectorAll<HTMLElement>("[data-beat] *")) {
      expect(el.style.opacity).toBe("");
      expect(el.style.visibility).toBe("");
      // Nor hidden by a class, waiting for a script to show it.
      if (!el.closest(".sr-only")) {
        expect(el.getAttribute("class") ?? "").not.toMatch(
          /(^|\s)(opacity-0|invisible|hidden)(\s|$)/,
        );
      }
    }
    expect(
      container.querySelector('[data-beat="proof"]')!.textContent,
    ).toContain("12");
  });

  it("renders nothing until the identity is there", () => {
    state.identity = undefined;
    const { container } = render(<ImmersiveHome />);
    expect(beats(container)).toEqual([]);
  });

  it("renders all seven beats, in order, for a full site", () => {
    state.identity = normalizeSiteContent({
      profile_data: {
        name: "Ada",
        title: "Engineer",
        headline: "I build ledgers.",
        bio: [],
        proof: [{ value: "12", label: "Years" }],
        status_panel: { show: true, title: "Now", availability: "Available" },
      },
      social_links: [
        {
          id: "email",
          label: "Email",
          url: "mailto:ada@example.com",
          is_visible: true,
        },
      ],
    } as never);
    state.sections = [
      {
        id: "s",
        portfolio_items: [
          {
            id: "a",
            title: "Ledger",
            tags: ["go"],
            slug: "ledger",
            has_case_study: true,
            display_order: 0,
          },
          { id: "b", title: "x".repeat(200), tags: [], display_order: 1 },
        ],
      },
    ];
    state.posts = [
      { slug: "p", title: "A post", published_at: "2025-01-15T00:00:00Z" },
    ];
    const { container } = render(<ImmersiveHome builtSlugs={["p"]} />);
    expect(beats(container)).toEqual([
      "opening",
      "statement",
      "proof",
      "work",
      "now",
      "writing",
      "closing",
    ]);

    const work = container.querySelector('[data-beat="work"]')!;
    expect(work.querySelectorAll("[data-panel]")).toHaveLength(2);
    expect(work.textContent).toContain("01 / 02");
    // No image on either: both get a pattern, and the long title is in the HTML whole.
    expect(work.querySelectorAll("svg[data-pattern]")).toHaveLength(2);
    expect(work.textContent).toContain("x".repeat(200));
    expect(
      screen
        .getByRole("link", { name: /Read case study.*Ledger/ })
        .getAttribute("href"),
    ).toMatch(/^\/work\/view\/?\?slug=ledger$/);

    expect(
      screen.getByRole("link", { name: "A post" }).getAttribute("href"),
    ).toMatch(/^\/blog\/p\/?$/);
    const closing = container.querySelector('[data-beat="closing"]')!;
    expect(
      closing.querySelector('a[href="mailto:ada@example.com"]'),
    ).not.toBeNull();
    expect(closing.textContent).toContain("Work with me");
  });

  it("has exactly one h1 and no heading level skipped, with every beat present", () => {
    state.identity = normalizeSiteContent({
      profile_data: {
        name: "Ada",
        title: "Engineer",
        headline: "I build ledgers.",
        proof: [{ value: "12", label: "Years" }],
        status_panel: {
          show: true,
          title: "Now",
          availability: "Available",
          currently_exploring: { title: "Exploring", items: ["Rust"] },
        },
      },
    } as never);
    state.sections = [
      {
        id: "s",
        portfolio_items: [{ id: "a", title: "Ledger", display_order: 0 }],
      },
    ];
    state.posts = [{ slug: "p", title: "A post" }];
    const { container } = render(<ImmersiveHome />);
    expect(beats(container)).toHaveLength(7);
    const levels = [...container.querySelectorAll("h1,h2,h3,h4")].map((h) =>
      Number(h.tagName[1]),
    );
    expect(levels).toContain(3);
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    levels.reduce((previous, level) => {
      expect(level - previous).toBeLessThanOrEqual(1);
      return level;
    }, 0);
  });

  it("leaves out Now for the default, empty status panel", () => {
    state.identity = normalizeSiteContent({
      profile_data: { name: "Ada" },
    } as never);
    const { container } = render(<ImmersiveHome />);
    expect(beats(container)).toEqual(["opening", "closing"]);
    expect(container.textContent).not.toContain("Status Panel");
  });
});
