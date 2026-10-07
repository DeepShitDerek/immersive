"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { publicApi } from "@/store/api/publicApi";
import { useAppStore } from "@/store/hooks";
import type { AppDispatch, RootState } from "@/store/store";
import type { NavLink } from "@/lib/public-data";
import type {
  BlogPost,
  CaseStudy,
  LifeUpdate,
  PortfolioSection,
  SiteContent,
} from "@/types";

/**
 * Build-time data for the public pages.
 *
 * Server components fetch it during `next build` and pass it down; it is
 * written into the RTK Query cache *before* the components that read it
 * render, so the static HTML contains real content and the components need no
 * changes — they still call their hooks and simply find the data there.
 */
export interface PublicPreloadData {
  siteIdentity?: SiteContent;
  navLinks?: NavLink[];
  posts?: BlogPost[];
  lifeUpdates?: LifeUpdate[];
  sectionsByPath?: Record<string, PortfolioSection[]>;
  postsBySlug?: Record<string, BlogPost>;
  caseStudiesBySlug?: Record<string, CaseStudy>;
  /**
   * The case studies that have a prerendered /work/<slug>/ page in this
   * build. Not cache data: it tells links which URL exists (caseStudyHref).
   */
  caseStudySlugs?: string[];
}

type TagDescription = Parameters<
  typeof publicApi.util.invalidateTags
>[0][number];

/**
 * Writes preloaded data into the cache, skipping any entry already there.
 *
 * Skipping matters on client-side navigation: by then the cache may hold data
 * fetched live in this session, and replacing it with the build snapshot
 * would show the visitor something older than what they just saw.
 *
 * Returns the tags of what it seeded, for revalidation.
 */
export function seedPublicCache(
  state: RootState,
  dispatch: AppDispatch,
  data: PublicPreloadData | undefined,
): TagDescription[] {
  if (!data) return [];

  const { endpoints } = publicApi;
  const entries: Parameters<typeof publicApi.util.upsertQueryEntries>[0] = [];
  const tags: TagDescription[] = [];
  const missing = (cached: { data?: unknown }) => cached.data === undefined;

  if (data.siteIdentity && missing(endpoints.getSiteIdentity.select()(state))) {
    entries.push({
      endpointName: "getSiteIdentity",
      arg: undefined,
      value: data.siteIdentity,
    });
    tags.push("SiteContent");
  }
  if (data.navLinks && missing(endpoints.getNavLinks.select()(state))) {
    entries.push({
      endpointName: "getNavLinks",
      arg: undefined,
      value: data.navLinks,
    });
    tags.push("Navigation");
  }
  if (data.posts && missing(endpoints.getPublishedBlogPosts.select()(state))) {
    entries.push({
      endpointName: "getPublishedBlogPosts",
      arg: undefined,
      value: data.posts,
    });
    tags.push({ type: "Posts", id: "LIST" });
  }
  if (
    data.lifeUpdates &&
    missing(endpoints.getPublishedLifeUpdates.select()(state))
  ) {
    entries.push({
      endpointName: "getPublishedLifeUpdates",
      arg: undefined,
      value: data.lifeUpdates,
    });
    tags.push("LifeUpdates");
  }
  for (const [path, sections] of Object.entries(data.sectionsByPath ?? {})) {
    if (missing(endpoints.getSectionsByPath.select(path)(state))) {
      entries.push({
        endpointName: "getSectionsByPath",
        arg: path,
        value: sections,
      });
      tags.push({ type: "Portfolio", id: path });
    }
  }
  for (const [slug, post] of Object.entries(data.postsBySlug ?? {})) {
    if (missing(endpoints.getBlogPostBySlug.select(slug)(state))) {
      entries.push({
        endpointName: "getBlogPostBySlug",
        arg: slug,
        value: post,
      });
      tags.push({ type: "Post", id: `slug:${slug}` });
    }
  }

  for (const [slug, study] of Object.entries(data.caseStudiesBySlug ?? {})) {
    if (missing(endpoints.getCaseStudyBySlug.select(slug)(state))) {
      entries.push({
        endpointName: "getCaseStudyBySlug",
        arg: slug,
        value: study,
      });
      tags.push({ type: "CaseStudy", id: `slug:${slug}` });
    }
  }

  if (entries.length > 0) {
    dispatch(publicApi.util.upsertQueryEntries(entries));
  }
  return tags;
}

/**
 * Seeds synchronously on the first render — before its children render, so
 * the prerendered HTML includes the data — then, once mounted, asks RTK Query
 * to refetch what it seeded. The build snapshot is the first paint; the live
 * database is what the visitor ends up looking at.
 */
export function useSeedPublicCache(data: PublicPreloadData | undefined): void {
  const store = useAppStore();
  const seeded = useRef<TagDescription[] | null>(null);

  if (seeded.current === null) {
    seeded.current = seedPublicCache(store.getState(), store.dispatch, data);
  }

  useEffect(() => {
    const tags = seeded.current ?? [];
    if (tags.length > 0) store.dispatch(publicApi.util.invalidateTags(tags));
  }, [store]);
}

const BuiltCaseStudies = createContext<readonly string[] | undefined>(
  undefined,
);

/** The case-study slugs this build prerendered, if the page was told. */
export function useBuiltCaseStudySlugs(): readonly string[] | undefined {
  return useContext(BuiltCaseStudies);
}

/** Page-level boundary: `<PublicPreload data={…}>page</PublicPreload>`. */
export function PublicPreload({
  data,
  children,
}: {
  data: PublicPreloadData | undefined;
  children: React.ReactNode;
}) {
  useSeedPublicCache(data);
  return (
    <BuiltCaseStudies.Provider value={data?.caseStudySlugs}>
      {children}
    </BuiltCaseStudies.Provider>
  );
}
