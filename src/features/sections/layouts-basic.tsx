"use client";

import { ArrowRight } from "lucide-react";
import type { PortfolioItem } from "@/types";
import { distributeColumns, useColumnCount } from "@/hooks/use-column-count";
import { cn } from "@/lib/cn";
import { Timeline } from "./timeline";
import {
  CountUp,
  Reveal,
  Stagger,
  StaggerItem,
} from "@/components/layout/motion";
import {
  CARD,
  CARD_INTERACTIVE,
  ItemDates,
  ItemImage,
  ItemTags,
  LinkCue,
  Markdown,
  MaybeLink,
  PlainText,
  TextLink,
  isLinkable,
} from "./shared";

type LayoutProps = { items: PortfolioItem[] };

/*
 * The basic layouts.
 *
 * Every one of them shares the motion vocabulary in `motion.tsx` and the card
 * vocabulary in `shared.tsx`, so they differ in *arrangement* — a list, a grid,
 * columns, alternating features — rather than each inventing its own shadow,
 * hover and entrance.
 *
 * Carried over from the previous version, and still load-bearing:
 *  • `min-w-0` on every flex/grid child holding text, and `overflow-wrap:
 *    anywhere` on titles — the seed stores a 400-character unbroken token.
 *  • `items-start` where a date sits beside a title, so it stays level with
 *    the first line when the title wraps.
 *  • Tags are capped, with the tail as "+N".
 */

/** Rows: title and subtitle, the dates and a link cue at the right. */
export function DefaultListLayout({ items }: LayoutProps) {
  return (
    <Stagger as="ul" className="divide-y divide-border/60">
      {items.map((item) => {
        const linked = isLinkable(item.link_url);
        return (
          <StaggerItem as="li" key={item.id}>
            <MaybeLink
              href={item.link_url}
              className={cn(
                "-mx-3 rounded-surface px-3 py-5",
                linked &&
                  "transition-colors duration-base ease-enter hover:bg-muted/50",
              )}
            >
              <div className="flex flex-col gap-x-6 gap-y-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading text-base font-semibold [overflow-wrap:anywhere] transition-colors group-hover/link:text-primary sm:text-lg">
                    {item.title}
                  </h3>
                  <PlainText
                    className="mt-0.5 text-sm text-muted-foreground"
                    clamp={2}
                  >
                    {item.subtitle}
                  </PlainText>
                </div>
                <div className="flex shrink-0 items-center gap-3 sm:pt-1">
                  <ItemDates from={item.date_from} to={item.date_to} />
                  <LinkCue href={item.link_url} />
                </div>
              </div>
              <Markdown className="mt-2.5 max-w-prose text-muted-foreground">
                {item.description}
              </Markdown>
              <ItemTags tags={item.tags} className="mt-3" max={8} />
            </MaybeLink>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}

/** The timeline — dates, a rail that fills as you read, and a card per item. */
export function TimelineLayout({ items }: LayoutProps) {
  return <Timeline items={items} />;
}

function CardFooter({ item, max }: { item: PortfolioItem; max: number }) {
  const hasTags = (item.tags ?? []).some((t) => t?.trim());
  const hasDates = !!(item.date_from?.trim() || item.date_to?.trim());
  if (!hasTags && !hasDates) return null;
  // mt-auto pins the footer to the bottom so cards in a row line up.
  return (
    <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-5">
      <ItemTags tags={item.tags} max={max} />
      <ItemDates from={item.date_from} to={item.date_to} className="ml-auto" />
    </div>
  );
}

function GridCard({ item }: { item: PortfolioItem }) {
  const linked = isLinkable(item.link_url);
  return (
    <MaybeLink
      href={item.link_url}
      className={cn(
        CARD,
        "flex h-full flex-col p-6",
        linked && CARD_INTERACTIVE,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 font-heading text-lg font-semibold leading-snug [overflow-wrap:anywhere] transition-colors group-hover/link:text-primary">
          {item.title}
        </h3>
        <LinkCue href={item.link_url} className="mt-1" />
      </div>
      <PlainText className="mt-1 text-sm text-muted-foreground" clamp={2}>
        {item.subtitle}
      </PlainText>
      <Markdown className="mt-3 text-muted-foreground">
        {item.description}
      </Markdown>
      <CardFooter item={item} max={6} />
    </MaybeLink>
  );
}

export function Grid2ColLayout({ items }: LayoutProps) {
  return (
    <Stagger className="grid gap-5 sm:grid-cols-2">
      {items.map((item) => (
        <StaggerItem key={item.id}>
          <GridCard item={item} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

export function Grid3ColLayout({ items }: LayoutProps) {
  return (
    <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <StaggerItem key={item.id}>
          <GridCard item={item} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/** The image slowly leans in under the pointer; the frame stays put. */
const IMAGE_ZOOM =
  "transition-transform duration-700 ease-enter group-hover/link:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover/link:scale-100";

/** Cards led by an image. */
export function CardsWithImageLayout({ items }: LayoutProps) {
  return (
    <Stagger className="grid gap-6 sm:grid-cols-2">
      {items.map((item) => {
        const linked = isLinkable(item.link_url);
        return (
          <StaggerItem key={item.id}>
            <MaybeLink
              href={item.link_url}
              className={cn(
                CARD,
                "flex h-full flex-col overflow-hidden",
                linked && CARD_INTERACTIVE,
              )}
            >
              <div className="overflow-hidden">
                <ItemImage
                  src={item.image_url}
                  alt={item.title}
                  className={cn(
                    "aspect-[16/10] w-full object-cover",
                    IMAGE_ZOOM,
                  )}
                  fallbackLabel={item.title.trim().charAt(0).toUpperCase()}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 font-heading text-lg font-semibold leading-snug [overflow-wrap:anywhere] transition-colors group-hover/link:text-primary">
                    {item.title}
                  </h3>
                  <LinkCue href={item.link_url} className="mt-1" />
                </div>
                <PlainText
                  className="mt-1 text-sm text-muted-foreground"
                  clamp={2}
                >
                  {item.subtitle}
                </PlainText>
                <Markdown className="mt-3 text-muted-foreground">
                  {item.description}
                </Markdown>
                <CardFooter item={item} max={6} />
              </div>
            </MaybeLink>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}

/** Pills — tools, skills, a stack. */
export function CompactCardsLayout({ items }: LayoutProps) {
  return (
    <Stagger as="ul" step={0.03} className="flex flex-wrap gap-2.5">
      {items.map((item) => (
        <StaggerItem as="li" key={item.id} className="max-w-full">
          <MaybeLink
            href={item.link_url}
            className={cn(
              "flex max-w-full items-center gap-2 rounded-full bg-card py-2 pl-4 pr-2 shadow-e1",
              !item.subtitle?.trim() && "pr-4",
              isLinkable(item.link_url) &&
                "transition-shadow duration-base ease-enter hover:shadow-e2",
            )}
          >
            <span className="truncate text-sm font-medium transition-colors group-hover/link:text-primary">
              {item.title}
            </span>
            {item.subtitle?.trim() && (
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                {item.subtitle}
              </span>
            )}
          </MaybeLink>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/**
 * Number-first cards. The figure counts up when it arrives; the label is plain
 * text, clamped — `description` is markdown, and printing it raw here once
 * put visible `**` on the page.
 */
export function StatsGridLayout({ items }: LayoutProps) {
  return (
    <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map((item) => (
        <StaggerItem
          key={item.id}
          className={cn(CARD, "relative min-w-0 overflow-hidden p-6")}
        >
          <span
            aria-hidden
            className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary/60"
          />
          <CountUp
            value={item.title}
            className="block font-heading text-4xl font-semibold tracking-tight tabular-nums text-primary [overflow-wrap:anywhere] sm:text-5xl"
          />
          <PlainText className="mt-2 text-sm text-muted-foreground" clamp={3}>
            {item.subtitle || item.description}
          </PlainText>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/**
 * Masonry that keeps reading order.
 *
 * This used CSS columns, which fill the whole first column before starting the
 * second — so the first three items read top to bottom down the left edge
 * instead of across the top. `distributeColumns` deals round-robin instead,
 * the pattern `/updates` and Notes already use. Cards without an image simply
 * have no media well: in masonry, uneven heights are the point.
 */
export function MasonryLayout({ items }: LayoutProps) {
  const columns = useColumnCount();
  const buckets = distributeColumns(items, columns);

  return (
    <div className="flex items-start gap-5">
      {buckets.map((bucket, column) => (
        <Stagger key={column} className="flex min-w-0 flex-1 flex-col gap-5">
          {bucket.map((item) => {
            const linked = isLinkable(item.link_url);
            return (
              <StaggerItem key={item.id}>
                <MaybeLink
                  href={item.link_url}
                  className={cn(
                    CARD,
                    "overflow-hidden",
                    linked && CARD_INTERACTIVE,
                  )}
                >
                  {item.image_url?.trim() && (
                    <div className="overflow-hidden">
                      <ItemImage
                        src={item.image_url}
                        alt={item.title}
                        className={cn("h-auto w-full object-cover", IMAGE_ZOOM)}
                        placeholderClassName="aspect-[4/3]"
                      />
                    </div>
                  )}
                  <div className="min-w-0 p-5">
                    <h3 className="font-heading font-semibold [overflow-wrap:anywhere] transition-colors group-hover/link:text-primary">
                      {item.title}
                    </h3>
                    <Markdown className="mt-1.5 text-muted-foreground">
                      {item.description}
                    </Markdown>
                    <ItemTags tags={item.tags} className="mt-3" max={5} />
                  </div>
                </MaybeLink>
              </StaggerItem>
            );
          })}
        </Stagger>
      ))}
    </div>
  );
}

/**
 * Large alternating features — the image arrives from its own side and the
 * text follows a beat later.
 *
 * The title is an inline `TextLink` rather than a second block link, which is
 * what kept an earlier version from nesting anchors. Both cells carry an
 * explicit `order`, so the flip does not depend on there being exactly two.
 * The eyebrow is the subtitle, or nothing — not a hard-coded "Featured"
 * shouted down the page.
 */
export function FeatureAlternatingLayout({ items }: LayoutProps) {
  return (
    // overflow-x-clip: the sideways entrance must not widen the page.
    <div className="space-y-20 overflow-x-clip md:space-y-28">
      {items.map((item, index) => {
        const flip = index % 2 === 1;
        return (
          <article
            key={item.id}
            className="grid items-center gap-8 md:grid-cols-12 md:gap-12"
          >
            <Reveal
              from={flip ? "right" : "left"}
              className={cn(
                "md:col-span-7",
                flip ? "md:order-2" : "md:order-1",
              )}
            >
              <MaybeLink
                href={item.link_url}
                ariaLabel={item.title}
                className="overflow-hidden rounded-surface bg-card shadow-e2"
              >
                <ItemImage
                  src={item.image_url}
                  alt={item.image_url ? item.title : ""}
                  className={cn(
                    "aspect-[16/10] w-full object-cover",
                    IMAGE_ZOOM,
                  )}
                  fallbackLabel={item.title.trim().charAt(0).toUpperCase()}
                />
              </MaybeLink>
            </Reveal>

            <Reveal
              delay={0.12}
              className={cn(
                "min-w-0 md:col-span-5",
                flip ? "md:order-1" : "md:order-2",
              )}
            >
              {item.subtitle?.trim() && (
                <p className="t-eyebrow">{item.subtitle}</p>
              )}
              <h3 className="t-heading mt-2 [overflow-wrap:anywhere]">
                <TextLink
                  href={item.link_url}
                  className="transition-colors hover:text-primary"
                >
                  {item.title}
                </TextLink>
              </h3>
              <ItemDates
                from={item.date_from}
                to={item.date_to}
                className="mt-2 block"
              />
              <Markdown className="mt-4 text-base text-muted-foreground">
                {item.description}
              </Markdown>
              <ItemTags tags={item.tags} className="mt-5" max={8} />
              {isLinkable(item.link_url) && (
                <TextLink
                  href={item.link_url}
                  className="group mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  View project
                  <ArrowRight
                    aria-hidden
                    className="size-4 transition-transform duration-base ease-enter group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </TextLink>
              )}
            </Reveal>
          </article>
        );
      })}
    </div>
  );
}
