"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Quote } from "lucide-react";
import type { PortfolioItem } from "@/types";
import { safeImageUrl } from "@/lib/safe-url";
import { cn } from "@/lib/cn";
import {
  CountUp,
  Reveal,
  Stagger,
  StaggerItem,
} from "@/components/layout/motion";
import { timelineDuration } from "./timeline-model";
import { useNow } from "./use-now";
import { useBuiltCaseStudySlugs } from "@/store/public-preload";
import { caseStudyHref } from "@/features/work/case-study-href";
import {
  CARD,
  ItemDates,
  ItemImage,
  ItemTags,
  Markdown,
  Monogram,
  PlainText,
  TextLink,
  isLinkable,
} from "./shared";

type LayoutProps = { items: PortfolioItem[] };

/** De-duplicated, non-blank tags — for layouts where tags are content. */
function cleanTags(tags?: string[] | null): string[] {
  return Array.from(
    new Set((tags ?? []).map((t) => t?.trim()).filter((t): t is string => !!t)),
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="t-micro">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/**
 * Long-form proof of work: a wide hero, then the story beside a margin rail
 * of facts — when, the stack, and the way in.
 *
 * Ruled entries, not cards: a card is for something that is
 * one link, and only the "Read the case study" line here is. The rail sits on
 * the left, as on the home page's rows and in a post.
 *
 * The hero renders only for a real image. A case study without one reads fine
 * as text, and a placeholder would waste the top of the card. The project link
 * goes through `TextLink`'s allowlist; `link_url` is unconstrained TEXT and
 * the seed stores `javascript:` values in it.
 *
 * An item with a written case study leads with "Read case study";
 * the project link then steps down to a secondary action.
 */
export function CaseStudyLayout({ items }: LayoutProps) {
  const built = useBuiltCaseStudySlugs();
  return (
    <div className="space-y-12 border-b border-border pb-12">
      {items.map((item) => {
        const tags = cleanTags(item.tags);
        const hasDates = !!(item.date_from?.trim() || item.date_to?.trim());
        const linked = isLinkable(item.link_url);
        const story =
          item.has_case_study && item.slug
            ? caseStudyHref(item.slug, built)
            : null;
        const hasRail = hasDates || tags.length > 0 || linked || !!story;

        return (
          <Reveal
            key={item.id}
            as="article"
            className="border-t border-border pt-8"
          >
            {safeImageUrl(item.image_url) && (
              <ItemImage
                src={item.image_url}
                alt={item.title}
                className="mb-8 aspect-[21/9] w-full rounded-surface object-cover"
              />
            )}
            <div
              className={cn(
                "grid gap-6",
                hasRail && "lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-x-8",
              )}
            >
              <div className="min-w-0">
                {item.subtitle?.trim() && (
                  <p className="t-eyebrow">{item.subtitle}</p>
                )}
                <h3 className="t-heading mt-2 [overflow-wrap:anywhere]">
                  {item.title}
                </h3>
                <Markdown className="mt-5 text-base text-muted-foreground">
                  {item.description}
                </Markdown>
              </div>

              {hasRail && (
                <aside className="min-w-0 space-y-5 lg:order-first">
                  {hasDates && (
                    <Meta label="When">
                      <ItemDates
                        from={item.date_from}
                        to={item.date_to}
                        className="text-sm text-foreground"
                      />
                    </Meta>
                  )}
                  {tags.length > 0 && (
                    <Meta label="Stack">
                      <ItemTags tags={tags} max={10} />
                    </Meta>
                  )}
                  {story && (
                    <Link
                      href={story}
                      className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-control text-sm font-semibold text-primary underline-offset-4 hover:underline focus-ring"
                    >
                      Read case study
                      <span className="sr-only">: {item.title}</span>
                      <ArrowRight aria-hidden className="size-4" />
                    </Link>
                  )}
                  {linked && (
                    <TextLink
                      href={item.link_url}
                      className={cn(
                        "inline-flex items-center gap-1.5 text-sm font-semibold",
                        // A text link, never a filled button: a page of
                        // rows each with its own filled button had a dozen
                        // primaries competing in one viewport.
                        "w-fit text-primary underline-offset-4 hover:underline",
                      )}
                    >
                      View project
                      <ArrowUpRight aria-hidden className="size-4" />
                    </TextLink>
                  )}
                </aside>
              )}
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}

/**
 * What you offer. Tags become the checklist, so here they are content rather
 * than metadata — not capped and not truncated.
 */
export function ServicesLayout({ items }: LayoutProps) {
  return (
    <Stagger className="grid gap-5 md:grid-cols-3">
      {items.map((item) => {
        const features = cleanTags(item.tags);
        return (
          <StaggerItem
            key={item.id}
            className={cn(CARD, "flex min-w-0 flex-col p-6 sm:p-7")}
          >
            {/* No letter tile in place of an icon: a tile repeating the
                title's first letter is a placeholder. */}
            <h3 className="font-heading text-lg font-semibold [overflow-wrap:anywhere]">
              <TextLink
                href={item.link_url}
                className="transition-colors hover:text-primary"
              >
                {item.title}
              </TextLink>
            </h3>
            <PlainText
              className="mt-1 text-sm font-medium text-primary"
              clamp={1}
            >
              {item.subtitle}
            </PlainText>
            <Markdown className="mt-3 text-muted-foreground">
              {item.description}
            </Markdown>
            {features.length > 0 && (
              <ul className="mt-auto space-y-2 border-t border-border/60 pt-5 [&:not(:first-child)]:mt-5">
                {features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm"
                  >
                    <Check
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-primary"
                    />
                    <span className="[overflow-wrap:anywhere]">{feature}</span>
                  </li>
                ))}
              </ul>
            )}
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}

/**
 * Roles: the organisation's mark, the role, the organisation, the dates and
 * how long it lasted — the same honest duration the timeline gives.
 */
export function WorkExperienceLayout({ items }: LayoutProps) {
  const now = useNow();

  return (
    <Stagger as="ol" className="space-y-4">
      {items.map((item) => {
        const duration = timelineDuration(item.date_from, item.date_to, now);
        return (
          <StaggerItem
            as="li"
            key={item.id}
            className={cn(
              CARD,
              "grid gap-4 p-5 sm:gap-5 sm:p-6",
              // The logo column exists only when there is a logo.
              safeImageUrl(item.image_url) &&
                "sm:grid-cols-[3.5rem_minmax(0,1fr)]",
            )}
          >
            {safeImageUrl(item.image_url) && (
              <ItemImage
                src={item.image_url}
                alt=""
                className="hidden size-14 rounded-control object-cover sm:block"
              />
            )}
            <div className="min-w-0">
              <div className="flex flex-col gap-x-4 gap-y-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-heading text-lg font-semibold leading-snug [overflow-wrap:anywhere]">
                    <TextLink
                      href={item.link_url}
                      className="transition-colors hover:text-primary"
                    >
                      {item.title}
                    </TextLink>
                  </h3>
                  <PlainText
                    className="text-sm font-medium text-primary"
                    clamp={2}
                  >
                    {item.subtitle}
                  </PlainText>
                </div>
                <div className="shrink-0 sm:text-right">
                  <ItemDates from={item.date_from} to={item.date_to} />
                  {duration && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {duration}
                    </p>
                  )}
                </div>
              </div>
              <Markdown className="mt-3 text-muted-foreground">
                {item.description}
              </Markdown>
              <ItemTags tags={item.tags} className="mt-4" max={8} />
            </div>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}

/**
 * A quote, clamped when long and expandable in place — a 1,000-character
 * testimonial once made its grid cell six times its neighbour's height.
 */
function QuoteText({ quote, limit }: { quote: string; limit: number }) {
  if (quote.length <= limit + 20) return <>{quote}</>;
  return (
    <details className="group inline">
      <summary className="list-none [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">
          {quote.slice(0, limit).trimEnd()}…{" "}
          <span className="cursor-pointer text-sm font-medium text-primary underline-offset-4 hover:underline">
            Read more
          </span>
        </span>
      </summary>
      <span>{quote}</span>
    </details>
  );
}

function Attribution({ item }: { item: PortfolioItem }) {
  if (!item.subtitle?.trim() && !item.description?.trim()) return null;
  return (
    <figcaption className="mt-6 flex items-center gap-3">
      {safeImageUrl(item.image_url) ? (
        <ItemImage
          src={item.image_url}
          alt=""
          className="size-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <Monogram
          text={item.subtitle}
          className="size-10 rounded-full text-sm"
        />
      )}
      <div className="min-w-0">
        <PlainText className="text-sm font-semibold" clamp={1}>
          {item.subtitle}
        </PlainText>
        <PlainText className="text-xs text-muted-foreground" clamp={2}>
          {item.description}
        </PlainText>
      </div>
    </figcaption>
  );
}

/**
 * title = quote, subtitle = who, description = their role, image = avatar.
 *
 * The first testimonial is set large, on its own — one voice given room reads
 * as conviction, where a uniform grid reads as a wall. The rest follow in two
 * columns.
 */
export function TestimonialsLayout({ items }: LayoutProps) {
  const [featured, ...rest] = items;
  if (!featured) return null;

  return (
    <div className="space-y-5">
      <Reveal
        as="figure"
        className={cn(CARD, "relative overflow-hidden p-7 sm:p-10")}
      >
        <Quote
          aria-hidden
          data-featured
          className="absolute right-6 top-6 size-16 text-primary/10 sm:size-24"
        />
        <blockquote className="relative max-w-3xl font-heading text-xl leading-snug [overflow-wrap:anywhere] sm:text-2xl">
          <QuoteText quote={featured.title ?? ""} limit={420} />
        </blockquote>
        <Attribution item={featured} />
      </Reveal>

      {rest.length > 0 && (
        <Stagger className="grid items-start gap-5 md:grid-cols-2">
          {rest.map((item) => (
            <StaggerItem
              as="figure"
              key={item.id}
              className={cn(CARD, "min-w-0 p-6 sm:p-7")}
            >
              <blockquote className="text-[0.9375rem] leading-relaxed [overflow-wrap:anywhere]">
                <span
                  aria-hidden
                  className="mr-1 font-heading text-2xl leading-none text-primary"
                >
                  “
                </span>
                <QuoteText quote={item.title ?? ""} limit={300} />
              </blockquote>
              <Attribution item={item} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

/** md column classes by count, so three figures are three columns, not four. */
const IMPACT_COLUMNS: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
};

/**
 * Quantified results as one panel with hairline divisions, each figure
 * counting up. The hairlines are a 1px gap over a `bg-border` fill — seamless,
 * unlike per-cell outlines, which doubled on shared edges. An odd last cell
 * spans the row on a phone rather than leaving a grey hole.
 */
export function ImpactNumbersLayout({ items }: LayoutProps) {
  return (
    <Stagger
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-surface bg-border shadow-e1",
        IMPACT_COLUMNS[items.length] ?? "md:grid-cols-4",
      )}
    >
      {items.map((item) => (
        <StaggerItem
          key={item.id}
          className="min-w-0 bg-card p-6 max-md:[&:last-child:nth-child(odd)]:col-span-2 sm:p-8"
        >
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
