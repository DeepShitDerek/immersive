import { RESERVED_SEGMENTS } from "@/lib/constants";
import type { NavLink } from "@/types";

/**
 * Resolving a CMS page from the 404 route.
 *
 * **Why this exists at all.** `(public)/[...slug]` builds one prerendered page
 * per visible nav link, and `generateStaticParams` runs *at build time* with
 * `dynamicParams = false`. The navigation itself is fetched at *runtime*. So a
 * page created in the admin after the last deploy appears in the site's own
 * menu of a build that contains no HTML for it, and GitHub Pages answers with
 * `404.html`. That is not a bug in the route — it is what `output: "export"`
 * means, and no amount of extra route generation can fix it, because the page
 * did not exist when the build ran.
 *
 * GitHub Pages serves `404.html` for *any* unmatched path, which makes it the
 * one place a static export can still make a decision about a URL. So the 404
 * page asks this: does a visible nav link claim this path? If it does, the
 * same `CmsPage` renders and the visitor never sees a 404. The prerendered
 * route remains the fast path for everything that existed at build time; this
 * is the catch-up path for everything created since.
 *
 * Kept as a pure function, separate from the page, because the interesting
 * part is the matching rules and those are worth testing without a DOM.
 */

export interface ResolvedCmsPage {
  /** The `page_path` its sections are stored against. */
  pagePath: string;
  /** The nav link's label, which is the page's title. */
  title: string;
}

/**
 * A path reduced to the form `navigation_links.href` is written in.
 *
 * `trailingSlash: true` means every URL the visitor arrives on carries one,
 * and the stored hrefs do not.
 */
function normalizePagePath(path: string): string {
  const [withoutQuery = ""] = path.split(/[?#]/);
  const trimmed = withoutQuery.replace(/\/+$/, "");
  if (trimmed === "") return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * The CMS page claiming `pathname`, or null when the 404 is a real 404.
 *
 * `links` is expected to be the public nav query's result, which already
 * filters to visible links — so a hidden link cannot resurrect a page here.
 * That matters: hiding a CMS link is documented as *removing the page from the
 * build*, and a fallback that ignored visibility would quietly undo the one
 * gesture the owner has for unpublishing a page.
 */
export function resolveCmsPage(
  pathname: string,
  links: Pick<NavLink, "label" | "href">[] | undefined,
): ResolvedCmsPage | null {
  if (!links || links.length === 0) return null;

  const pagePath = normalizePagePath(pathname);

  // Home has its own route. If it 404s, something else is wrong and rendering
  // an empty CMS shell over it would hide that.
  if (pagePath === "/") return null;

  // A reserved first segment is skipped by the catch-all, so no CMS page can
  // exist there — `/blog/whatever` is a missing post, not an unbuilt page.
  const [root] = pagePath.slice(1).split("/");
  const reserved: readonly string[] = RESERVED_SEGMENTS;
  if (reserved.includes(root)) return null;

  const match = links.find((link) => normalizePagePath(link.href) === pagePath);
  if (!match) return null;

  // An absolute URL stored as an href normalises to something starting with a
  // slash but is not a site path; it can never be what the visitor is on.
  if (/^https?:/i.test(match.href.trim())) return null;

  return { pagePath, title: match.label };
}
