"use client";

import {
  Award,
  FolderGit2,
  Headphones,
  Megaphone,
  Mic,
  Newspaper,
  Presentation,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { PortfolioItem } from "@/types";
import { safeImageUrl } from "@/lib/safe-url";
import { cn } from "@/lib/cn";
import { Reveal, Stagger, StaggerItem } from "@/components/layout/motion";
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

/** Repositories: a mark, the name, its meta line, what it does. */
export function OpenSourceLayout({ items }: LayoutProps) {
  return (
    <Stagger className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => {
        const linked = isLinkable(item.link_url);
        return (
          <StaggerItem key={item.id}>
            <MaybeLink
              href={item.link_url}
              className={cn(
                CARD,
                "flex h-full flex-col p-5",
                linked && CARD_INTERACTIVE,
              )}
            >
              <div className="flex items-start gap-3">
                {safeImageUrl(item.image_url) ? (
                  <ItemImage
                    src={item.image_url}
                    alt=""
                    className="size-10 shrink-0 rounded-control object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary"
                  >
                    <FolderGit2 className="size-5" />
                  </span>
                )}
                {/*
                  The meta line sits under the name rather than beside it: pinned
                  to the right, it truncated the repository name away on a
                  phone.
                */}
                <div className="min-w-0 flex-1">
                  <h3
                    className="truncate font-semibold transition-colors group-hover/link:text-primary"
                    title={item.title}
                  >
                    {item.title}
                  </h3>
                  <PlainText
                    className="mt-0.5 text-xs text-muted-foreground"
                    clamp={1}
                  >
                    {item.subtitle}
                  </PlainText>
                </div>
                <LinkCue href={item.link_url} className="mt-1" />
              </div>
              <Markdown className="mt-3 text-muted-foreground">
                {item.description}
              </Markdown>
              <ItemTags tags={item.tags} className="mt-auto pt-4" max={6} />
            </MaybeLink>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}

/** The mark for a talk, podcast, article… read from the subtitle's words. */
const KINDS: { pattern: RegExp; kind: string; icon: LucideIcon }[] = [
  { pattern: /podcast|episode/i, kind: "podcast", icon: Headphones },
  {
    pattern: /workshop|course|training|class/i,
    kind: "workshop",
    icon: Presentation,
  },
  { pattern: /video|youtube|stream|webinar/i, kind: "video", icon: Video },
  {
    pattern: /article|post|essay|blog|interview|paper/i,
    kind: "article",
    icon: Newspaper,
  },
  {
    pattern: /talk|keynote|conference|meetup|panel|lecture/i,
    kind: "talk",
    icon: Mic,
  },
];

function speakingKind(subtitle?: string | null): {
  kind: string;
  icon: LucideIcon;
} {
  const match = KINDS.find(({ pattern }) => pattern.test(subtitle ?? ""));
  return match ?? { kind: "other", icon: Megaphone };
}

/** Talks, articles, podcasts — each with the mark of what it is. */
export function SpeakingLayout({ items }: LayoutProps) {
  return (
    <Stagger as="ul" className="space-y-3">
      {items.map((item) => {
        const { kind, icon: Icon } = speakingKind(item.subtitle);
        const linked = isLinkable(item.link_url);
        return (
          <StaggerItem as="li" key={item.id}>
            <MaybeLink
              href={item.link_url}
              className={cn(
                CARD,
                "flex items-start gap-4 p-5",
                linked && CARD_INTERACTIVE,
              )}
            >
              <span
                aria-hidden
                data-kind={kind}
                className="flex size-10 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary"
              >
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {item.subtitle?.trim() && (
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                      {item.subtitle}
                    </span>
                  )}
                  <ItemDates from={item.date_from} to={item.date_to} />
                </div>
                <h3 className="mt-2 font-heading font-semibold [overflow-wrap:anywhere] transition-colors group-hover/link:text-primary sm:text-lg">
                  {item.title}
                </h3>
                <Markdown className="mt-1.5 text-muted-foreground">
                  {item.description}
                </Markdown>
              </div>
              <LinkCue href={item.link_url} className="mt-1" />
            </MaybeLink>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}

/** Recognition: a compact grid of awards and mentions. */
export function PressAwardsLayout({ items }: LayoutProps) {
  return (
    <Stagger as="ul" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const linked = isLinkable(item.link_url);
        return (
          <StaggerItem as="li" key={item.id} className="min-w-0">
            <MaybeLink
              href={item.link_url}
              className={cn(
                CARD,
                "flex h-full items-center gap-3 p-4",
                linked && CARD_INTERACTIVE,
              )}
            >
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
              >
                <Award className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold [overflow-wrap:anywhere] transition-colors group-hover/link:text-primary">
                  {item.title}
                </p>
                <PlainText className="text-xs text-muted-foreground" clamp={1}>
                  {item.subtitle}
                </PlainText>
              </div>
              <LinkCue href={item.link_url} />
            </MaybeLink>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}

/**
 * "Worked with". Logos rest desaturated and come to colour under the pointer;
 * the filter applies to the image only, so a text fallback for a logo-less
 * client stays readable. The hover belongs to the tile, not the link, so an
 * unlinked logo still responds.
 */
export function ClientLogosLayout({ items }: LayoutProps) {
  return (
    <Stagger
      as="ul"
      step={0.05}
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
    >
      {items.map((item) => (
        <StaggerItem as="li" key={item.id} className="group/logo">
          <MaybeLink
            href={item.link_url}
            ariaLabel={item.title}
            className={cn(
              CARD,
              "flex aspect-[5/3] items-center justify-center p-6",
              isLinkable(item.link_url) && CARD_INTERACTIVE,
            )}
          >
            {safeImageUrl(item.image_url) ? (
              <ItemImage
                src={item.image_url}
                alt={item.title}
                className="max-h-full max-w-full object-contain opacity-70 grayscale transition duration-slow ease-enter group-hover/logo:opacity-100 group-hover/logo:grayscale-0 motion-reduce:transition-none"
              />
            ) : (
              <span className="line-clamp-2 text-center font-heading text-base font-semibold text-muted-foreground transition-colors group-hover/logo:text-foreground">
                {item.title}
              </span>
            )}
          </MaybeLink>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/**
 * What I'm doing now. The subtitle is the category; the first card carries a
 * live pulse — one, not one per card, or nothing reads as current.
 */
export function NowPageLayout({ items }: LayoutProps) {
  return (
    <Stagger className="grid gap-4 sm:grid-cols-2">
      {items.map((item, index) => (
        <StaggerItem key={item.id} className={cn(CARD, "min-w-0 p-6")}>
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold text-primary">
              <span className="relative flex size-2 shrink-0" aria-hidden>
                {index === 0 && (
                  <span
                    data-live
                    className="absolute inset-0 animate-ping rounded-full bg-primary/50 motion-reduce:hidden"
                  />
                )}
                <span className="relative size-2 rounded-full bg-primary" />
              </span>
              <span className="truncate">{item.subtitle?.trim() || "Now"}</span>
            </span>
            <ItemDates from={item.date_from} to={item.date_to} />
          </div>
          <h3 className="mt-3 font-heading text-lg font-semibold [overflow-wrap:anywhere]">
            <TextLink
              href={item.link_url}
              className="transition-colors hover:text-primary"
            >
              {item.title}
            </TextLink>
          </h3>
          <Markdown className="mt-2 text-muted-foreground">
            {item.description}
          </Markdown>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/**
 * Uses / setup, grouped by the subtitle: one panel per category, the tools as
 * rows inside it. Group order follows first appearance, which respects
 * display_order; items with no subtitle collect under "Tools" rather than
 * vanishing. The subtitle is the heading only, never repeated per row.
 */
export function UsesLayout({ items }: LayoutProps) {
  const groups = new Map<string, PortfolioItem[]>();
  for (const item of items) {
    const key = item.subtitle?.trim() || "Tools";
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }

  return (
    <div className="grid items-start gap-6 md:grid-cols-2">
      {Array.from(groups.entries()).map(([category, groupItems], index) => (
        <Reveal
          key={category}
          delay={Math.min(index * 0.06, 0.3)}
          className={cn(CARD, "min-w-0 overflow-hidden")}
        >
          <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
            <h3 className="font-heading font-semibold [overflow-wrap:anywhere]">
              {category}
            </h3>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium tabular-nums text-secondary-foreground">
              {groupItems.length}
            </span>
          </div>
          <ul className="divide-y divide-border/60">
            {groupItems.map((item) => (
              <li key={item.id}>
                <MaybeLink
                  href={item.link_url}
                  className={cn(
                    "flex items-start gap-3 rounded-none px-5 py-3.5",
                    isLinkable(item.link_url) &&
                      "transition-colors duration-base ease-enter hover:bg-muted/50",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium [overflow-wrap:anywhere] transition-colors group-hover/link:text-primary">
                      {item.title}
                    </p>
                    <Markdown className="mt-0.5 text-muted-foreground">
                      {item.description}
                    </Markdown>
                  </div>
                  <LinkCue href={item.link_url} className="mt-0.5" />
                </MaybeLink>
              </li>
            ))}
          </ul>
        </Reveal>
      ))}
    </div>
  );
}
