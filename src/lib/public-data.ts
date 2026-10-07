import { rest } from "@/lib/rest";
import {
  MOCK_BLOG_POSTS,
  MOCK_LIFE_UPDATES,
  MOCK_NAV_LINKS,
  MOCK_SECTIONS,
  MOCK_SITE_IDENTITY,
} from "@/lib/fallback-data";
import { normalizeSiteContent } from "@/lib/site-identity";
import {
  PUBLIC_BLOG_LIST_SELECT,
  PUBLIC_BLOG_POST_SELECT,
  PUBLIC_CASE_STUDY_SELECT,
  PUBLIC_SECTION_WITH_ITEMS_SELECT,
} from "@/store/api/public-columns";
import type {
  BlogPost,
  CaseStudy,
  LifeUpdate,
  PortfolioSection,
  SiteContent,
} from "@/types";

/**
 * What a signed-out visitor sees, fetched one way for everyone.
 *
 * Two callers: `publicApi` in the browser, and the public pages' server
 * components during `next build`, which render the same data into the static
 * HTML. Keeping one copy is the point — if the build and the browser
 * read different columns or filters, the first paint and the live page
 * disagree and React warns about a hydration mismatch.
 *
 * Results use RTK Query's `{ data } | { error }` shape so `publicApi` can
 * return them unchanged. Static mode (no Supabase) reads portfolio.config.ts.
 */

export type NavLink = { label: string; href: string };

type PublicError = {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
};
export type PublicResult<T> =
  | { data: T; error?: undefined }
  | { error: PublicError | unknown; data?: undefined };

const notFound = (details = ""): { error: PublicError } => ({
  error: { message: "Not Found", details, hint: "", code: "404" },
});

export async function fetchSiteIdentity(): Promise<PublicResult<SiteContent>> {
  if (!rest) return { data: normalizeSiteContent(MOCK_SITE_IDENTITY) };

  const { data, error } = await rest.from("site_identity").select("*").single();
  if (error) return { error };
  // profile_data is unconstrained JSONB; normalising here means the
  // public renderers can rely on the shape SiteContent promises.
  return { data: normalizeSiteContent(data as Partial<SiteContent>) };
}

export async function fetchNavLinks(): Promise<PublicResult<NavLink[]>> {
  if (!rest) return { data: MOCK_NAV_LINKS };

  const [identityRes, linksRes] = await Promise.all([
    rest.from("site_identity").select("portfolio_mode").single(),
    rest
      .from("navigation_links")
      .select("label, href")
      .eq("is_visible", true)
      .order("display_order"),
  ]);

  if (linksRes.error) return { error: linksRes.error };

  const portfolioMode = identityRes.data?.portfolio_mode || "multi-page";
  let links = linksRes.data || [];

  if (portfolioMode === "single-page") {
    links = links.filter(
      (link) =>
        link.href === "/" || link.href === "/contact" || link.href === "/blog",
    );
  }
  return { data: links };
}

export async function fetchPublishedPosts(): Promise<PublicResult<BlogPost[]>> {
  if (!rest) return { data: MOCK_BLOG_POSTS };

  // List view: everything except `content` — read time comes from the
  // word_count generated column, so full post bodies stay out of the list.
  const { data, error } = await rest
    .from("blog_posts")
    .select(PUBLIC_BLOG_LIST_SELECT)
    .eq("published", true)
    .order("published_at", { ascending: false });
  if (error) return { error };
  return { data: data as BlogPost[] };
}

export async function fetchPostBySlug(
  slug: string,
): Promise<PublicResult<BlogPost>> {
  if (!rest) {
    const post = MOCK_BLOG_POSTS.find((p) => p.slug === slug);
    return post ? { data: post } : notFound("Mock");
  }

  const { data, error } = await rest
    .from("blog_posts")
    .select(PUBLIC_BLOG_POST_SELECT)
    .eq("slug", slug)
    .eq("published", true)
    .single();
  if (error && error.code !== "PGRST116") return { error };
  if (!data) return notFound();
  return { data: data as BlogPost };
}

export async function fetchPublishedLifeUpdates(): Promise<
  PublicResult<LifeUpdate[]>
> {
  if (!rest) return { data: MOCK_LIFE_UPDATES };

  const { data, error } = await rest
    .from("public_notes")
    .select("*")
    .eq("is_published", true)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return { error };
  return { data };
}

export async function fetchSectionsByPath(
  pagePath: string,
): Promise<PublicResult<PortfolioSection[]>> {
  if (!rest) {
    return { data: MOCK_SECTIONS.filter((s) => s.page_path === pagePath) };
  }

  const { data, error } = await rest
    .from("portfolio_sections")
    .select(PUBLIC_SECTION_WITH_ITEMS_SELECT)
    .eq("page_path", pagePath)
    .eq("is_visible", true)
    .order("display_order")
    .order("display_order", { foreignTable: "portfolio_items" });
  if (error) return { error };
  return { data: data as PortfolioSection[] };
}

/** Static mode: case studies are whatever the mock sections carry. */
function mockCaseStudies(): CaseStudy[] {
  return MOCK_SECTIONS.flatMap((s) => s.portfolio_items ?? []).filter(
    (item): item is CaseStudy => !!item.has_case_study,
  );
}

/** Slugs of every published case study — the /work/<slug>/ pages to build. */
export async function fetchCaseStudySlugs(): Promise<PublicResult<string[]>> {
  if (!rest) return { data: mockCaseStudies().map((c) => c.slug) };

  const { data, error } = await rest
    .from("portfolio_items")
    .select("slug")
    .eq("has_case_study", true);
  if (error) return { error };
  return {
    data: (data ?? []).map((row) => row.slug).filter((s): s is string => !!s),
  };
}

export async function fetchCaseStudyBySlug(
  slug: string,
): Promise<PublicResult<CaseStudy>> {
  if (!rest) {
    const found = mockCaseStudies().find((c) => c.slug === slug);
    return found ? { data: found } : notFound("Mock");
  }

  const { data, error } = await rest
    .from("portfolio_items")
    .select(PUBLIC_CASE_STUDY_SELECT)
    .eq("slug", slug)
    .eq("has_case_study", true)
    .maybeSingle();
  if (error) return { error };
  if (!data) return notFound();
  return { data: data as CaseStudy };
}

/**
 * For build-time callers: the data, or `undefined` when the fetch failed.
 * A failed fetch at build must not fail the build — the page then ships
 * without a preload and the browser fetches as a client-only page does.
 */
export async function orUndefined<T>(
  result: Promise<PublicResult<T>>,
): Promise<T | undefined> {
  try {
    const settled = await result;
    return "data" in settled && settled.data !== undefined
      ? settled.data
      : undefined;
  } catch {
    return undefined;
  }
}
