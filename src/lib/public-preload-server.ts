import {
  fetchCaseStudySlugs,
  fetchPublishedLifeUpdates,
  fetchPublishedPosts,
  fetchSectionsByPath,
  orUndefined,
} from "@/lib/public-data";
import type { PublicPreloadData } from "@/store/public-preload";
import type { PortfolioSection } from "@/types";

/**
 * Build-time data for one public page. Called from the pages'
 * server components during `next build`; the result goes to <PublicPreload>.
 * Anything that fails to load is simply left out, and that part of the page
 * falls back to fetching in the browser.
 */
export async function pagePreload({
  sections = [],
  posts = false,
  lifeUpdates = false,
}: {
  sections?: string[];
  posts?: boolean;
  lifeUpdates?: boolean;
}): Promise<PublicPreloadData> {
  const [sectionResults, postList, updates, caseStudySlugs] = await Promise.all(
    [
      Promise.all(
        sections.map((path) => orUndefined(fetchSectionsByPath(path))),
      ),
      posts ? orUndefined(fetchPublishedPosts()) : undefined,
      lifeUpdates ? orUndefined(fetchPublishedLifeUpdates()) : undefined,
      // Any page showing sections may link to a case study.
      sections.length > 0 ? orUndefined(fetchCaseStudySlugs()) : undefined,
    ],
  );

  const sectionsByPath: Record<string, PortfolioSection[]> = {};
  sections.forEach((path, i) => {
    const found = sectionResults[i];
    if (found) sectionsByPath[path] = found;
  });

  return {
    sectionsByPath,
    posts: postList,
    lifeUpdates: updates,
    caseStudySlugs,
  };
}
