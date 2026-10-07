"use client";

import { Suspense, useEffect, useState } from "react";
import type {
  BlogPost,
  CaseStudy,
  GitHubRepo,
  LifeUpdate,
  PortfolioSection,
  SiteContent,
} from "@/types";
import type { NavLink } from "@/lib/public-data";
import { publicApi } from "@/store/api/publicApi";
import { useAppStore } from "@/store/hooks";
import { normalizeSiteContent } from "@/lib/site-identity";
import { resolveSiteStyle, isImmersive } from "@/lib/site-style";
import { ImmersiveShell } from "./shell/immersive-shell";
import ImmersiveHome from "./home/immersive-home";
import ImmersiveWork from "./work/immersive-work";
import ImmersiveCaseStudy from "./case-study/immersive-case-study";
import ImmersiveAbout from "./about/immersive-about";
import ImmersiveBlog from "./blog/immersive-blog";
import ImmersivePost from "./blog/immersive-post";
import ImmersiveUpdates from "./updates/immersive-updates";
import ImmersiveContact from "./contact/immersive-contact";
import { ProductPage } from "@/features/product/product-page";
import { CmsPage } from "@/features/sections/cms-page";
import { DashboardHarness } from "@/features/dashboard/dashboard-harness";
import { SettingsHarness } from "@/features/settings/settings-harness";

/**
 * The immersive layouts with placeholder content and no database, for the
 * browser checks. `?style=` picks the style, `?page=` the layout or one of the
 * restyled pages (about, blog, post, updates, contact, kit, cms), or the
 * workspace under the style (admin-dashboard, admin-settings), and
 * `?content=bare` the least a site can have. Placeholder data lives only
 * here, and this module is loaded only by the harness route.
 */
const params =
  typeof window === "undefined"
    ? new URLSearchParams()
    : new URLSearchParams(window.location.search);
const style = resolveSiteStyle(params.get("style") ?? "noir");
const page = params.get("page") ?? "home";
const bare = params.get("content") === "bare";
/** Content at the long end of what an owner writes: titles, bio. */
const long = params.get("content") === "long";
const LONG_TITLE = Array.from({ length: 17 }, () => "Placeholder").join(" ");
const LONG_PARAGRAPH = Array.from(
  { length: 30 },
  () => "A long placeholder sentence for the bio.",
).join(" ");

const POST_BODY = [
  "## A placeholder heading",
  "Placeholder paragraph one of the post, long enough to wrap across a few lines at the reading measure so the column can be judged.",
  "> A placeholder quotation.",
  "### A placeholder subheading",
  "- A list item\n- Another list item",
  '```ts\nconst placeholder: string = "a line of code long enough to need sideways scrolling in a narrow column, on a phone at least";\n```',
  "| Column | Value |\n|---|---|\n| One | 1 |\n| Two | 2 |",
  ...Array.from(
    { length: 8 },
    (_, i) => `Placeholder paragraph ${i + 2} of the post.`,
  ),
].join("\n\n");

const CASE_BODY = [
  "## The problem",
  "Placeholder paragraph one for the harness. It is long enough to wrap over several lines at a reading measure.",
  "## What changed",
  "Placeholder paragraph two.",
  "```ts\nconst answer = 42;\n```",
  ...Array.from(
    { length: 12 },
    (_, i) =>
      `Placeholder paragraph ${i + 3} so the page is long enough to scroll.`,
  ),
].join("\n\n");

const projects = [
  {
    title: "Placeholder Ledger",
    tags: ["Go", "Postgres"],
    slug: "placeholder-ledger",
  },
  {
    title: "Placeholder Atlas",
    tags: ["TypeScript", "Maps"],
    slug: "placeholder-atlas",
  },
  {
    title:
      "A placeholder project with a deliberately long title to test wrapping",
    tags: ["Rust"],
    slug: "placeholder-long",
  },
  { title: "Placeholder Without Case Study", tags: [], slug: undefined },
].map((p, index) => ({
  id: `00000000-0000-4000-8000-00000000000${index}`,
  section_id: "00000000-0000-4000-8000-0000000000aa",
  title: long && index === 0 ? LONG_TITLE : p.title,
  subtitle: "Placeholder subtitle",
  description: "A one-line placeholder summary of the project.",
  date_from: "2024-01",
  date_to: "2025-03",
  tags: p.tags,
  display_order: index,
  slug: p.slug,
  has_case_study: Boolean(p.slug),
  link_url: index === 3 ? "https://example.com/" : undefined,
}));

const sections = (bare
  ? []
  : [
      {
        id: "00000000-0000-4000-8000-0000000000aa",
        title: "Projects",
        page_path: "/work",
        portfolio_items: projects,
      },
    ]) as unknown as PortfolioSection[];

const posts = (bare
  ? []
  : ["First", "Second", "Third"].map((name, index) => ({
      id: `00000000-0000-4000-8000-0000000001${index}0`,
      slug: `placeholder-${name.toLowerCase()}`,
      title:
        long && index === 0 ? LONG_TITLE : `${name} placeholder post title`,
      excerpt: "Placeholder excerpt.",
      published_at: `2025-0${3 - index}-15T00:00:00Z`,
      content: POST_BODY,
      tags: ["placeholder", index === 0 ? "first" : "other"],
      show_toc: true,
    }))) as unknown as BlogPost[];

const updates = (bare
  ? []
  : (["thought", "milestone", "watching", "activity", "photo"] as const).map(
      (category, index) => ({
        id: `00000000-0000-4000-8000-0000000002${index}0`,
        // Long: one very long entry, one with no title, one with no date.
        title:
          long && index === 1
            ? LONG_TITLE
            : long && index === 2
              ? null
              : `Placeholder ${category} update`,
        content:
          long && index === 1
            ? LONG_PARAGRAPH
            : "A placeholder update, a sentence or two long, as they are.",
        category,
        tags: ["placeholder"],
        is_pinned: index === 0,
        is_published: true,
        created_at:
          // Newest first, as the site's own query returns them.
          long && index === 3 ? undefined : `2025-0${5 - index}-10T09:00:00Z`,
      }),
    )) as unknown as LifeUpdate[];

const repos = (bare
  ? []
  : ["placeholder-one", "placeholder-two", "placeholder-three"].map(
      (name, index) => ({
        id: index + 1,
        name,
        full_name: `placeholder/${name}`,
        html_url: "https://example.com/repo",
        description: "A placeholder repository description.",
        fork: false,
        private: false,
        archived: false,
        stargazers_count: 12 * (index + 1),
        watchers_count: 3,
        forks_count: index,
        open_issues_count: 0,
        language: ["TypeScript", "Go", "Rust"][index],
        topics: ["placeholder"],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        pushed_at: "2025-01-01T00:00:00Z",
        owner: {
          login: "placeholder",
          avatar_url: "",
          html_url: "https://example.com/",
        },
      }),
    )) as unknown as GitHubRepo[];

/** The sections a CMS-driven page shows: prose, a list, and a second prose. */
const pageSections = (path: string) =>
  [
    {
      id: "00000000-0000-4000-8000-0000000003a0",
      title: "Placeholder prose section",
      type: "markdown",
      content:
        "A placeholder paragraph with a [link](https://example.com/), **bold** text and `inline code`.\n\n- A list item\n- Another list item",
      display_order: 0,
      is_visible: true,
      page_path: path,
      layout_style: "default",
    },
    {
      id: "00000000-0000-4000-8000-0000000003b0",
      title: "Placeholder list section",
      type: "list_items",
      display_order: 1,
      is_visible: true,
      page_path: path,
      layout_style: "default",
      portfolio_items: projects.slice(0, 3),
    },
  ] as unknown as PortfolioSection[];

const identity: SiteContent = (() => {
  const base = normalizeSiteContent({
    profile_data: {
      name: "Placeholder Name",
      title: bare ? "" : "Placeholder Role",
      logo: { main: "Place", highlight: "holder" },
      site_style: style,
      description: "A placeholder description of the person, one sentence.",
      github_projects_config: { username: "placeholder", show: true },
    },
    social_links: bare
      ? []
      : [
          {
            id: "email",
            label: "Email",
            url: "mailto:placeholder@example.com",
            is_visible: true,
          },
          {
            id: "github",
            label: "GitHub",
            url: "https://example.com/gh",
            is_visible: true,
          },
        ],
    footer_data: { copyright_text: "Placeholder footer" },
  } as never);
  // Written after normalising, so "bare" is truly empty whatever the defaults.
  Object.assign(base.profile_data, {
    headline: bare
      ? ""
      : "A placeholder headline that is long enough to light up word by word.",
    bio: bare
      ? []
      : long
        ? [LONG_PARAGRAPH, LONG_PARAGRAPH]
        : ["Placeholder bio paragraph one.", "Placeholder bio paragraph two."],
    proof: bare
      ? []
      : [
          { value: "00", label: "Placeholder" },
          { value: "000", label: "Placeholder" },
          { value: "0", label: "Placeholder" },
        ],
    status_panel: {
      ...base.profile_data.status_panel,
      show: !bare,
      title: "Placeholder status",
      availability: "Placeholder availability",
      currently_exploring: {
        title: "Placeholder exploring",
        items: ["One", "Two"],
      },
    },
  });
  return base;
})();

const nav: NavLink[] = [
  { label: "Work", href: "/work" },
  { label: "About", href: "/about" },
  { label: "Placeholder CTA", href: "/contact" },
];

publicApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (b) => ({
    getSiteIdentity: b.query<SiteContent, void>({
      queryFn: () => ({ data: identity }),
    }),
    getNavLinks: b.query<NavLink[], void>({ queryFn: () => ({ data: nav }) }),
    getPublishedBlogPosts: b.query<BlogPost[], void>({
      queryFn: () => ({ data: posts }),
    }),
    getSectionsByPath: b.query<PortfolioSection[], string>({
      queryFn: (path) => ({
        data: path === "/work" || bare ? sections : pageSections(path),
      }),
    }),
    getBlogPostBySlug: b.query<BlogPost, string>({
      queryFn: (slug) => {
        const found = posts.find((post) => post.slug === slug);
        return found
          ? { data: found }
          : { error: { status: 404, data: "not found" } as never };
      },
    }),
    incrementPostView: b.mutation<null, string>({
      queryFn: () => ({ data: null }),
    }),
    getPublishedLifeUpdates: b.query<LifeUpdate[], void>({
      queryFn: () => ({ data: updates }),
    }),
    getGitHubRepos: b.query<GitHubRepo[], unknown>({
      queryFn: () => ({ data: repos }),
    }),
    getRandomHighlight: b.query<null, void>({
      queryFn: () => ({ data: null }),
    }),
    submitContactForm: b.mutation<null, unknown>({
      queryFn: () => ({ data: null }),
    }),
    getCaseStudyBySlug: b.query<CaseStudy, string>({
      queryFn: (slug) => {
        const found = projects.find((p) => p.slug === slug);
        return found
          ? {
              data: { ...found, case_study: CASE_BODY } as unknown as CaseStudy,
            }
          : { error: { status: 404, data: "not found" } as never };
      },
    }),
    getLockdownStatus: b.query<number, void>({ queryFn: () => ({ data: 0 }) }),
  }),
});

export function ImmersiveHarness() {
  const store = useAppStore();
  const [ready, setReady] = useState(false);

  // The root layout seeds the real site identity and navigation, and may have
  // refetched them before this module replaced the endpoints. Writing the
  // placeholders into the cache supersedes both the seed and any request
  // still in flight. It also keeps the first render off the server: the style
  // and page come from the URL, which the build does not have.
  useEffect(() => {
    void Promise.all([
      store.dispatch(
        publicApi.util.upsertQueryData("getSiteIdentity", undefined, identity),
      ),
      store.dispatch(
        publicApi.util.upsertQueryData("getNavLinks", undefined, nav),
      ),
    ]).then(() => setReady(true));
  }, [store]);

  if (!ready) return null;
  if (!isImmersive(style)) return <p>Pass ?style=noir, paper or dusk.</p>;

  // The workspace under the style. No shell: the workspace has its own
  // frame, and takes the style from the document (DocumentStyle, rendered by
  // the providers because the identity above says so).
  if (page === "admin-dashboard") return <DashboardHarness />;
  if (page === "admin-settings") return <SettingsHarness />;

  return (
    <ImmersiveShell style={style} identity={identity}>
      {page === "home" && <ImmersiveHome />}
      {page === "work" && <ImmersiveWork />}
      {/* The pages that keep their own components and only take the style. */}
      {page === "about" && <ImmersiveAbout />}
      {page === "blog" && (
        <Suspense>
          <ImmersiveBlog builtSlugs={posts.map((post) => post.slug)} />
        </Suspense>
      )}
      {page === "post" && (
        <ImmersivePost
          slug={params.get("slug") ?? "placeholder-first"}
          builtSlugs={posts.map((post) => post.slug)}
        />
      )}
      {page === "updates" && <ImmersiveUpdates />}
      {page === "contact" && <ImmersiveContact />}
      {page === "kit" && <ProductPage />}
      {page === "cms" && (
        <CmsPage pagePath="/placeholder" title="Placeholder page" />
      )}
      {page === "case" && (
        <ImmersiveCaseStudy slug={params.get("slug") ?? "placeholder-ledger"} />
      )}
    </ImmersiveShell>
  );
}
