"use client";

import { Markdown as MarkdownBase } from "@/components/ui/markdown";
import type { PortfolioSection } from "@/types";
import { cn } from "@/lib/utils";
import { EmptySection, sortedItems } from "./shared";
import {
  isKnownLayout,
  resolveLayout,
  SELF_SOURCING_LAYOUTS,
} from "./section-layouts";
import { RepoGrid } from "@/features/github/repo-grid";
import { HighlightWidget } from "@/features/library/highlight-widget";

/** Stable, URL-safe anchor so any section can be deep-linked. */
function sectionAnchor(section: PortfolioSection) {
  const slug = (section.title ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug
    ? `${slug}-${String(section.id).slice(0, 8)}`
    : `section-${section.id}`;
}

function SectionBody({ section }: { section: PortfolioSection }) {
  /**
   * FIX — the single biggest rendering bug.
   *
   * The old switch matched on `layout_style` first and only rendered markdown
   * inside the `default` branch. A markdown section carrying any other layout
   * value therefore rendered that layout with an empty item array: heading,
   * dotted rule, and nothing else. `type` is the contract; `layout_style` only
   * chooses how *items* are arranged, so type wins.
   */
  if (section.type === "markdown") {
    if (!section.content?.trim())
      return <EmptySection label="Markdown section has no content." />;
    return (
      <MarkdownBase className="leading-relaxed">{section.content}</MarkdownBase>
    );
  }

  // Layouts that fetch their own data ignore portfolio_items entirely.
  if (section.layout_style && SELF_SOURCING_LAYOUTS.has(section.layout_style)) {
    return section.layout_style === "highlight" ? (
      <HighlightWidget />
    ) : (
      <RepoGrid />
    );
  }

  const items = sortedItems(section.portfolio_items);

  /**
   * A section with no items would be a heading over nothing, which looks
   * broken. The whole section is left out in production (see SectionRenderer)
   * and explained in development.
   */
  if (!items.length) return <EmptySection />;

  const Layout = resolveLayout(section.layout_style);
  return <Layout items={items} />;
}

/**
 * Renders one CMS section: heading, then body.
 *
 * v3 removed the numbered mono ordinal and the dotted rule that used to sit
 * under every heading — separation now comes from space and from the fact that
 * each layout puts its items on their own surfaces.
 *
 * Retained from the previous version:
 *  - `aria-labelledby` points at the real heading instead of duplicating the
 *    title in an `aria-label`, so screen readers announce it once.
 *  - `scroll-mt-24` + an id make every section deep-linkable without the
 *    sticky header covering it.
 *  - Nothing fades in. A section prerendered at `opacity: 0`, waiting for an
 *    IntersectionObserver, is blank page until the script runs.
 *  - Sections with no renderable body are dropped in production rather than
 *    leaving an orphan heading.
 */
export default function SectionRenderer({
  section,
  index,
  className,
}: {
  section: PortfolioSection;
  index?: number;
  className?: string;
}) {
  const anchor = sectionAnchor(section);

  const isMarkdown = section.type === "markdown";
  const isSelfSourcing =
    !!section.layout_style && SELF_SOURCING_LAYOUTS.has(section.layout_style);
  const hasItems = (section.portfolio_items?.length ?? 0) > 0;
  const hasBody = isMarkdown
    ? !!section.content?.trim()
    : isSelfSourcing || hasItems;

  if (!hasBody && process.env.NODE_ENV === "production") return null;

  const headingId = `${anchor}-heading`;
  // Absent (fallback data, pre-019 rows) means shown.
  const showTitle = section.show_title !== false;

  return (
    <section
      id={anchor}
      aria-labelledby={headingId}
      className={cn("scroll-mt-24", className)}
    >
      {/*
        A hidden title stays in the markup, screen-reader-only: the section's
        landmark is labelled by it, and a nameless region is worse than one
        whose name you cannot see. Only the visible spacing goes with it.
      */}
      <header className={showTitle ? "mb-8" : undefined}>
        {/*
          The `01 /` mono ordinal is a v2 mannerism and is retired. `index` is
          still accepted so callers do not have to change, but a section's
          position is now conveyed by document order alone.
        */}
        <h2
          id={headingId}
          className={cn(
            // The title role, like the home page's own section titles.
            "t-title text-balance [overflow-wrap:anywhere]",
            !showTitle && "sr-only",
          )}
        >
          {section.title}
        </h2>

        {/*
          Development-only warning. layout_style has no CHECK constraint and no
          lookup table, so a typo in the admin produces a section that silently
          renders as a plain list. Surfacing it here means the author notices
          before the visitor does.
        */}
        {process.env.NODE_ENV !== "production" &&
          section.type !== "markdown" &&
          !isKnownLayout(section.layout_style) && (
            <p className="mt-2 rounded border border-dashed border-destructive/40 bg-destructive/5 px-2 py-1 text-xs font-medium text-destructive">
              Unknown layout_style &quot;{section.layout_style}&quot; — falling
              back to Default List.
            </p>
          )}
      </header>

      <SectionBody section={section} />
    </section>
  );
}
