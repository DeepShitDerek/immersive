"use client";

import { useMemo, useRef } from "react";
import { Search, X } from "lucide-react";
import type { LifeUpdate } from "@/types";
import { useDisplayTimeZone } from "@/hooks/use-hydrated";
import { useUpdatesFeed } from "@/features/updates/use-updates-feed";
import { CategoryIcon } from "@/features/updates/category-icon";
import { FeedEnd } from "@/features/updates/feed-end";
import { DynamicPageContent } from "@/features/sections/dynamic-page-content";
import {
  byNewest,
  categoryOption,
  groupByMonth,
  monthLabel,
} from "@/lib/life-update";
import { safeImageUrl } from "@/lib/safe-url";
import { Markdown } from "@/components/ui/markdown";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { useScene } from "../motion/scroll-provider";
import { Chip, PageTitle, Rule, WithScroll, ruleScene } from "../shared/ruled";

const ACTION =
  "im-mono mt-6 inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border px-3 text-foreground transition-colors duration-fast hover:border-foreground focus-ring";

/** The day in the margin. An update with no usable date gets no mark, not "Invalid Date". */
function DayMark({ iso }: { iso?: string }) {
  const timeZone = useDisplayTimeZone();
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return (
    <time dateTime={iso} className="im-mono block text-foreground">
      {date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone,
      })}
    </time>
  );
}

/** One update: what kind it is and when in the margin, then what it says. */
function Entry({
  update,
  large,
  level: Heading,
  onTag,
  activeTag,
}: {
  update: LifeUpdate;
  /** The pinned update that opens the page. */
  large?: boolean;
  /** h2 above the month headings (the pinned block), h3 under one. */
  level: "h2" | "h3";
  onTag: (tag: string) => void;
  activeTag: string | null;
}) {
  const option = categoryOption(update.category);
  // Owner-entered, rendered publicly: through the image allowlist.
  const image = safeImageUrl(update.image_url);
  const title = update.title?.trim();
  const tags = (update.tags ?? []).filter((tag) => tag.trim());

  return (
    <article className="grid gap-x-10 gap-y-3 py-7 md:grid-cols-[9rem_minmax(0,1fr)]">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 md:block md:space-y-2">
        <DayMark iso={update.created_at} />
        <p className="im-mono inline-flex items-center gap-1.5">
          <CategoryIcon category={option.value} />
          {option.label}
        </p>
        {update.is_pinned && <p className="im-mono text-primary">Pinned</p>}
      </div>
      <div className="min-w-0">
        {title && (
          <Heading
            className={cn(
              "im-display !normal-case",
              large ? "im-display-md" : "text-2xl !leading-tight",
            )}
          >
            {title}
          </Heading>
        )}
        {update.content?.trim() && (
          <Markdown
            className={cn(
              "max-w-prose break-words text-base",
              title ? "mt-3 text-muted-foreground" : "text-foreground",
            )}
          >
            {update.content}
          </Markdown>
        )}
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={title ?? ""}
            loading="lazy"
            className="mt-5 max-h-[32rem] w-full max-w-prose rounded-surface border border-border object-cover"
          />
        )}
        {tags.length > 0 && (
          <ul
            className="mt-4 flex list-none flex-wrap gap-2 p-0"
            aria-label="Tags"
          >
            {tags.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  onClick={() => onTag(tag)}
                  aria-pressed={activeTag === tag}
                  aria-label={`Show updates tagged ${tag}`}
                  className={cn(
                    "im-mono inline-flex min-h-6 items-center rounded-control transition-colors duration-fast hover:text-foreground focus-ring",
                    activeTag === tag && "text-primary",
                  )}
                >
                  #{tag}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

/**
 * Updates in an immersive style: a dated stream under large month headings,
 * everything visible, the pinned update opening the page.
 *
 * What the page does (category, tag and search filters, what is pinned) is
 * `useUpdatesFeed`, the hook the Classic page calls. The owner's timeline or
 * scrapbook choice is a Classic setting and does not apply here.
 */
function Page() {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, ruleScene);
  const timeZone = useDisplayTimeZone();
  const {
    all,
    isLoading,
    pinned,
    feed,
    filtering,
    category,
    setCategory,
    tag,
    setTag,
    toggleTag,
    searchTerm,
    setSearchTerm,
    clearFilters,
    categoryCounts,
    presentCategories,
    oldest,
  } = useUpdatesFeed();

  // Filtered, the feed includes pinned updates, and the site's query returns
  // those first whatever their date. Grouping takes consecutive runs, so they
  // are put back in date order here, or a month would get two headings.
  const groups = useMemo(
    () =>
      groupByMonth(
        filtering ? [...feed].sort(byNewest) : feed,
        undefined,
        timeZone,
      ),
    [feed, filtering, timeZone],
  );

  return (
    <>
      <section
        ref={ref}
        data-page="updates"
        className="px-[var(--band-x)] pb-24 pt-12 max-[399px]:px-4 md:pt-20"
      >
        <PageTitle
          eyebrow="Now & then"
          title="Updates"
          lead="What I'm working on, watching and thinking about — the small news between projects."
        />

        {isLoading ? (
          <div className="mt-12 space-y-6" aria-busy>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="im-rule h-28" />
            ))}
          </div>
        ) : all.length === 0 ? (
          <div className="im-rule mt-12 py-14">
            <p className="t-lead">Nothing posted yet.</p>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <section aria-label="Pinned" data-part="pinned" className="mt-12">
                {pinned.map((update, index) => (
                  <div key={update.id}>
                    <Rule />
                    <Entry
                      update={update}
                      large={index === 0}
                      level="h2"
                      onTag={toggleTag}
                      activeTag={tag}
                    />
                  </div>
                ))}
              </section>
            )}

            <div className="mb-4 mt-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {presentCategories.length > 1 ? (
                <ul
                  aria-label="Filter by category"
                  className="flex min-w-0 flex-wrap gap-2"
                >
                  <li>
                    <Chip
                      active={category === "all"}
                      count={all.length}
                      onClick={() => setCategory("all")}
                    >
                      All
                    </Chip>
                  </li>
                  {presentCategories.map((option) => (
                    <li key={option.value}>
                      <Chip
                        active={category === option.value}
                        count={categoryCounts.get(option.value)}
                        onClick={() => setCategory(option.value)}
                      >
                        <CategoryIcon category={option.value} />
                        {option.label}
                      </Chip>
                    </li>
                  ))}
                </ul>
              ) : (
                <span />
              )}
              <div className="relative w-full shrink-0 sm:max-w-xs">
                <Search
                  aria-hidden
                  className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search updates…"
                  aria-label="Search updates"
                  className="h-11 pl-11"
                />
              </div>
            </div>

            {tag && (
              <p className="im-mono mb-4 flex items-center gap-2">
                Tagged
                <button
                  type="button"
                  onClick={() => setTag(null)}
                  aria-label={`Stop filtering by ${tag}`}
                  className="inline-flex min-h-6 items-center gap-1 rounded-control text-primary focus-ring"
                >
                  #{tag}
                  <X className="size-3.5" aria-hidden />
                </button>
              </p>
            )}

            {feed.length === 0 ? (
              filtering && (
                <div className="im-rule mt-8 py-14">
                  <p className="t-lead">No updates match.</p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className={ACTION}
                  >
                    <X className="size-3.5" aria-hidden />
                    Clear filters
                  </button>
                </div>
              )
            ) : (
              <>
                {groups.map((group) => (
                  <section
                    key={group.label}
                    aria-label={group.label}
                    data-month
                    className="mt-14"
                  >
                    <h2 className="im-display im-display-lg">{group.label}</h2>
                    <ol className="mt-6 list-none p-0">
                      {group.updates.map((update) => (
                        <li key={update.id} data-row>
                          <Rule />
                          <Entry
                            update={update}
                            level="h3"
                            onTag={toggleTag}
                            activeTag={tag}
                          />
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
                <FeedEnd
                  label={
                    filtering ? "That's every match" : "You're all caught up"
                  }
                  detail={
                    filtering
                      ? `${feed.length} of ${all.length} updates`
                      : oldest
                        ? `${all.length} ${all.length === 1 ? "update" : "updates"} since ${monthLabel(oldest, timeZone)}`
                        : undefined
                  }
                />
              </>
            )}
          </>
        )}

        <DynamicPageContent pagePath="/updates" className="mt-16" />
      </section>
    </>
  );
}

/*
  The page is rendered inside the provider, not around it: `useScene` reads
  the provider's context, so a component that called the hook and then
  rendered the provider as its own child would never get a scene.
*/
export default function ImmersiveUpdates() {
  return (
    <WithScroll>
      <Page />
    </WithScroll>
  );
}
