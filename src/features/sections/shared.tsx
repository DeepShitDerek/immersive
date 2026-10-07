import Link from "next/link";
import { Markdown as MarkdownBase } from "@/components/ui/markdown";
import { ArrowRight, ArrowUpRight, ImageOff } from "lucide-react";
import type { PortfolioItem } from "@/types";
import { cn } from "@/lib/utils";
import { isInternalUrl, safeImageUrl, safeLinkUrl } from "@/lib/safe-url";

/* ────────────────────────────────────────────────────────────────
 * Sorting
 * ──────────────────────────────────────────────────────────────── */

/**
 * Items sorted by display_order. Array.prototype.sort is stable, so items
 * sharing a display_order keep their API order instead of shuffling between
 * renders — the seed has deliberate collisions to prove it.
 */
export function sortedItems(items?: PortfolioItem[]): PortfolioItem[] {
  return [...(items ?? [])].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
  );
}

/* ────────────────────────────────────────────────────────────────
 * Markdown
 * ──────────────────────────────────────────────────────────────── */

/**
 * Body markdown.
 *
 * `urlTransform` runs every link and image URL through the allowlist, so a
 * `[click](javascript:alert(1))` in a description renders as inert text.
 * Raw HTML stays escaped: rehype-raw is deliberately NOT installed.
 *
 * `break-words` matters more than it looks — the seed stores a 400-character
 * unbroken token, and without it that token widens the whole page on mobile.
 */
export function Markdown({
  children,
  className,
}: {
  children?: string | null;
  className?: string;
}) {
  if (!children?.trim()) return null;
  return (
    <MarkdownBase className={cn("text-sm leading-relaxed", className)}>
      {children}
    </MarkdownBase>
  );
}

/** Single-line plain text — for slots where markdown would be noise. */
export function PlainText({
  children,
  className,
  clamp,
}: {
  children?: string | null;
  className?: string;
  clamp?: 1 | 2 | 3 | 4;
}) {
  if (!children?.trim()) return null;
  return (
    <p
      className={cn(
        "[overflow-wrap:anywhere]",
        clamp === 1 && "line-clamp-1",
        clamp === 2 && "line-clamp-2",
        clamp === 3 && "line-clamp-3",
        clamp === 4 && "line-clamp-4",
        className,
      )}
    >
      {children}
    </p>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Tags
 * ──────────────────────────────────────────────────────────────── */

/**
 * Tag chips.
 *
 * Two fixes over the old version: duplicate tags no longer collide on the
 * React key (the array is de-duplicated first), and blank/whitespace tags are
 * dropped rather than rendering an empty pill. `max` collapses the tail into a
 * "+N" chip so a 30-tag row cannot take over a card.
 */
export function ItemTags({
  tags,
  className,
  max,
}: {
  tags?: string[] | null;
  className?: string;
  max?: number;
}) {
  const clean = Array.from(
    new Set((tags ?? []).map((t) => t?.trim()).filter((t): t is string => !!t)),
  );
  if (!clean.length) return null;

  const shown = max ? clean.slice(0, max) : clean;
  const overflow = clean.length - shown.length;

  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {shown.map((tag) => (
        // Soft pills in the body face. These were bordered mono labels — the
        // retired v2 "technical metadata" voice.
        <li
          key={tag}
          className="max-w-[14rem] truncate rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
          title={tag}
        >
          {tag}
        </li>
      ))}
      {overflow > 0 && (
        <li className="px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          +{overflow}
        </li>
      )}
    </ul>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Dates
 * ──────────────────────────────────────────────────────────────── */

/**
 * Date range.
 *
 * BUG FIX: the previous separator expression was
 *   `{from && (to || !from) ? " — " : ""}` followed by `{to ?? (from ? "Present" : "")}`
 * With `from` set and `to` null, the condition is false but the fallback still
 * prints "Present", so the seeded certification rendered as "Jan 2026Present".
 *
 * The rules are now explicit:
 *   from + to   → "2021 — 2024"
 *   from only   → "2021 — Present"
 *   to only     → "Until 2024"   (rather than a bare, ambiguous date)
 *   neither     → nothing
 *
 * Values are free TEXT in the database — "2024", "Mar 2024" and "Present" are
 * all legal — so no parsing is attempted. `<time>` is deliberately not used
 * for that reason.
 */
export function ItemDates({
  from,
  to,
  className,
}: {
  from?: string | null;
  to?: string | null;
  className?: string;
}) {
  const start = from?.trim() || null;
  const end = to?.trim() || null;
  if (!start && !end) return null;

  const label = start ? `${start} — ${end ?? "Present"}` : `Until ${end}`;

  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap text-xs font-medium tabular-nums text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Links
 * ──────────────────────────────────────────────────────────────── */

/**
 * Wraps children in a link when the item has a usable one.
 *
 * Three fixes:
 *  1. The href goes through `safeLinkUrl`, so `javascript:`, `data:` and
 *     protocol-relative values fall back to a plain <div> instead of becoming
 *     a live anchor.
 *  2. Internal hrefs ("/work") use next/link and no longer open a new tab.
 *  3. `asChild` lets a caller render the wrapper as something other than a
 *     block <div>, which is how the nested-anchor invalid-HTML in the old
 *     FeatureAlternating layout is avoided.
 */
export function MaybeLink({
  href,
  className,
  children,
  ariaLabel,
}: {
  href?: string | null;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const safe = safeLinkUrl(href);
  if (!safe) return <div className={className}>{children}</div>;

  const classes = cn("group/link block focus-ring rounded-control", className);

  if (isInternalUrl(safe)) {
    return (
      <Link href={safe} className={classes} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className={classes}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );
}

/** Inline text link — for use *inside* a card that is already a link. */
export function TextLink({
  href,
  className,
  children,
}: {
  href?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const safe = safeLinkUrl(href);
  if (!safe) return <span className={className}>{children}</span>;
  if (isInternalUrl(safe)) {
    return (
      <Link href={safe} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Images
 * ──────────────────────────────────────────────────────────────── */

/**
 * CMS image.
 *
 * The old version returned `null` for a missing src, which silently collapsed
 * cards in the masonry and gallery layouts — the seed's "Missing Image Probe"
 * row produced a card with no media well and a different height to every
 * neighbour. Now a missing or unsafe src renders a graph-paper placeholder of
 * the same shape, so the grid stays even.
 *
 * `onError` swaps a dead URL (the seeded cdn.invalid.example row) for the same
 * placeholder rather than leaving the browser's broken-image glyph.
 */
export function ItemImage({
  src,
  alt,
  className,
  placeholderClassName,
  fallbackLabel,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  fallbackLabel?: string;
}) {
  const safe = safeImageUrl(src);

  if (!safe) {
    return (
      <div
        aria-hidden
        className={cn(
          // A plain tinted surface. The v2 placeholder was a graph-paper
          // ground, which read as an intentional texture rather than as a
          // missing image.
          "flex items-center justify-center bg-secondary text-muted-foreground",
          className,
          placeholderClassName,
        )}
      >
        {fallbackLabel ? (
          <span className="text-2xl font-semibold">{fallbackLabel}</span>
        ) : (
          <ImageOff className="size-6" />
        )}
      </div>
    );
  }

  return (
    // Static export runs with images.unoptimized — a plain img avoids remote-domain config.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={safe}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn("bg-secondary", className)}
      // Prerendered pages: a dead URL can fail before React hydrates,
      // and then onError never fires — the browser's broken-image glyph
      // stays. So also check once React attaches to the element.
      ref={(el) => {
        if (el && el.complete && el.naturalWidth === 0) hideBrokenImage(el);
      }}
      onError={(e) => hideBrokenImage(e.currentTarget)}
    />
  );
}

/** A failed image leaves its tinted well, not the broken-image glyph. */
function hideBrokenImage(el: HTMLImageElement) {
  el.style.visibility = "hidden";
  el.parentElement?.classList.add("bg-secondary");
}

/* ────────────────────────────────────────────────────────────────
 * Empty state
 * ──────────────────────────────────────────────────────────────── */

/**
 * Rendered when a section has a layout but no items.
 *
 * Previously these produced a heading, a dotted rule, and then nothing — the
 * seeded "Empty By Design" section looked like a broken page. In production
 * the section is skipped entirely; in development it says why, so the author
 * can see the section exists and needs items.
 */
export function EmptySection({
  label = "No items in this section yet.",
}: {
  label?: string;
}) {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div className="rounded-surface border border-dashed bg-muted/10 px-4 py-8 text-center">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground/70">
        Visible in development only.
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Cards
 * ──────────────────────────────────────────────────────────────── */

/** A card: a fill and an elevation, never a border. */
export const CARD = "rounded-surface bg-card shadow-e1";

/**
 * The lift a *linked* card gets on hover. Only linked cards: a card that rises
 * under the pointer promises it goes somewhere.
 */
export const CARD_INTERACTIVE =
  "transition-[box-shadow,transform] duration-base ease-enter hover:-translate-y-0.5 hover:shadow-e2 motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/** Whether an item's link will actually render as one. */
export function isLinkable(href?: string | null): boolean {
  return safeLinkUrl(href) !== null;
}

/**
 * The arrow that says a card goes somewhere, and where: up-right leaves the
 * site, right stays on it. Renders nothing for an unusable link, so a card
 * never promises a destination it does not have.
 */
export function LinkCue({
  href,
  className,
}: {
  href?: string | null;
  className?: string;
}) {
  const safe = safeLinkUrl(href);
  if (!safe) return null;
  const internal = isInternalUrl(safe);
  const Icon = internal ? ArrowRight : ArrowUpRight;
  return (
    <Icon
      aria-hidden
      data-link-cue
      className={cn(
        "size-4 shrink-0 text-muted-foreground transition-[transform,color] duration-base ease-enter group-hover/link:text-primary motion-reduce:transition-none",
        internal
          ? "group-hover/link:translate-x-0.5"
          : "group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5",
        className,
      )}
    />
  );
}

/** A first-letter mark for an item with no image, in the theme's primary. */
export function Monogram({
  text,
  className,
}: {
  text?: string | null;
  className?: string;
}) {
  const letter = (text?.trim().charAt(0) || "?").toUpperCase();
  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center bg-primary/10 font-heading font-semibold text-primary",
        className,
      )}
    >
      {letter}
    </div>
  );
}
