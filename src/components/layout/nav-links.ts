/**
 * How the public navigation is laid out (led by the work).
 *
 * The links themselves come from the CMS (`navigation_links`, or
 * portfolio.config.ts in static mode). Two rules shape them:
 *
 *  - The link to /contact is the call to action. It renders as the primary
 *    button at the end of the header rather than as one more text link, and
 *    keeps whatever label the owner gave it ("Work with me").
 *  - The footer repeats the nav and adds footer-only links (Updates by
 *    default), so pages that left the header stay one click away.
 */

export type NavLink = { label: string; href: string };

export const CTA_HREF = "/contact";

/** "/contact/" and "/contact" are the same page under trailingSlash. */
export function samePath(a: string, b: string): boolean {
  const clean = (href: string) =>
    href.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
  return clean(a) === clean(b);
}

export function splitNav(links: readonly NavLink[]): {
  items: NavLink[];
  cta: NavLink | undefined;
} {
  const cta = links.find((link) => samePath(link.href, CTA_HREF));
  return { items: links.filter((link) => link !== cta), cta };
}

/** Nav links, then footer-only links the nav doesn't already carry. */
export function footerLinks(
  nav: readonly NavLink[],
  extra: readonly NavLink[] | undefined,
): NavLink[] {
  const additions = (extra ?? []).filter(
    (link) => !nav.some((existing) => samePath(existing.href, link.href)),
  );
  return [...nav, ...additions];
}
