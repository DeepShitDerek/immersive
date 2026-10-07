import type { PortfolioItem, PortfolioSection } from "@/types";
import { sortedItems } from "@/features/sections/shared";

const fold = (tag: string) => tag.trim().toLowerCase();

/** Every project on /work, in the order the owner set. */
export function allItems(
  sections: readonly PortfolioSection[] | undefined,
): PortfolioItem[] {
  return (sections ?? []).flatMap((section) =>
    sortedItems(section.portfolio_items),
  );
}

/** Each tag once, as first written, in the order it first appears. */
export function allTags(items: readonly PortfolioItem[]): string[] {
  const seen = new Map<string, string>();
  for (const item of items) {
    for (const tag of item.tags ?? []) {
      const key = fold(tag);
      if (key && !seen.has(key)) seen.set(key, tag.trim());
    }
  }
  return [...seen.values()];
}

/**
 * The tag a URL asks for, as the list spells it, or null. A tag nobody has
 * (a stale link, a typo) is no filter, not an empty page.
 */
export function resolveTag(
  tag: string | null,
  tags: readonly string[],
): string | null {
  if (!tag) return null;
  return tags.find((candidate) => fold(candidate) === fold(tag)) ?? null;
}

export function filterByTag(
  items: readonly PortfolioItem[],
  tag: string | null,
): PortfolioItem[] {
  if (!tag) return [...items];
  return items.filter((item) =>
    (item.tags ?? []).some((t) => fold(t) === fold(tag)),
  );
}
