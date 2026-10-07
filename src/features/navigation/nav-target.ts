import { BUILTIN_ROUTES, RESERVED_SEGMENTS } from "@/lib/constants";

/**
 * What a navigation href actually resolves to on the public site.
 *
 * The navigation table is not just a menu. `(public)/[...slug]` builds one
 * prerendered page per *visible* nav link whose first segment is not reserved,
 * so for those paths the link is the only thing that makes the page exist. For
 * a reserved path the page comes from a route file instead and the link is
 * purely a menu entry. Three reserved segments have no route file at all.
 *
 * The owner cannot tell these apart from the href, and the consequences differ
 * sharply — so this is derived once, here, rather than guessed per call site.
 */
export type NavTargetKind = "builtin" | "cms" | "dead" | "invalid";

export interface NavTarget {
  kind: NavTargetKind;
  /** Short badge text. */
  label: string;
  /** One sentence explaining what this path does. */
  detail: string;
}

const reserved: readonly string[] = RESERVED_SEGMENTS;
const builtin: readonly string[] = BUILTIN_ROUTES;

/** Trailing slashes are equivalent to their bare form; `/` is left as `/`. */
export function normalizeHref(href: string): string {
  const trimmed = href.trim();
  if (trimmed === "/") return "/";
  return trimmed.replace(/\/+$/, "");
}

function rootSegment(href: string): string {
  return normalizeHref(href).replace(/^\//, "").split("/")[0] ?? "";
}

export function resolveNavTarget(href: string): NavTarget {
  const path = normalizeHref(href);

  if (!path.startsWith("/") || /\s/.test(path)) {
    return {
      kind: "invalid",
      label: "Not a site path",
      detail:
        "Only paths on this site work here — external URLs are turned into broken build output.",
    };
  }

  if (builtin.includes(path)) {
    return {
      kind: "builtin",
      label: "Built-in page",
      detail:
        "This page has its own route and exists whether or not it is linked. Content sections you add for this path are appended to it.",
    };
  }

  // Reserved but not built-in: nothing generates it and no route file serves
  // it, so the menu entry points at a 404.
  if (reserved.includes(rootSegment(path))) {
    return {
      kind: "dead",
      label: "No page exists",
      detail:
        "This path is reserved, so the CMS will not build a page for it, and there is no route that serves it. The link will 404.",
    };
  }

  return {
    kind: "cms",
    label: "CMS page",
    detail:
      "This page exists only because this link does. It works as soon as you add it, and is built into the site at the next deploy. Hiding or deleting the link removes it again.",
  };
}

/**
 * Hrefs that collide once normalized.
 *
 * Two links sharing a path produce duplicate `generateStaticParams` entries and
 * a menu with two identical destinations. Nothing in the database prevents it —
 * there is no unique index on `href`.
 */
export function duplicateHrefs(links: { href: string }[]): Set<string> {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const link of links) {
    const path = normalizeHref(link.href);
    if (seen.has(path)) dupes.add(path);
    seen.add(path);
  }
  return dupes;
}
