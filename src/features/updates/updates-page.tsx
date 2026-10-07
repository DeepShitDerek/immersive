"use client";

import { Search, X } from "lucide-react";
import { monthLabel } from "@/lib/life-update";
import { useDisplayTimeZone } from "@/hooks/use-hydrated";
import { Band } from "@/components/layout/band";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { FilterBar, FilterChip } from "@/components/ui/filter-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { DynamicPageContent } from "@/features/sections/dynamic-page-content";
import { FeedEnd } from "./feed-end";
import { useUpdatesFeed } from "./use-updates-feed";
import { JournalFeed, PinnedUpdates, WallFeed } from "./update-feeds";
import { CategoryIcon } from "./category-icon";

/**
 * /updates — what the owner is up to.
 *
 * Pinned updates lead as a feature, because a pin means "this is true for a
 * while"; the feed below is everything else, newest first, in the arrangement
 * chosen in Settings (journal or wall). Filtering narrows the feed and leaves
 * the pinned block where it is, so typing a search never makes the page jump.
 * Tags are links into the feed rather than decoration.
 */
export function UpdatesPage() {
  const {
    all,
    isLoading,
    layout,
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
  const timeZone = useDisplayTimeZone();

  const Feed = layout === "timeline" ? JournalFeed : WallFeed;

  return (
    <Band weight="content">
      <PageHeader
        kicker="Now & then"
        title="Updates"
        subheading="What I'm working on, watching and thinking about — the small news between projects."
      />

      {isLoading ? (
        <div className="space-y-5" aria-busy>
          <Skeleton className="h-64 rounded-surface" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-surface" />
            ))}
          </div>
        </div>
      ) : all.length === 0 ? (
        <div className="rounded-surface border border-dashed px-6 py-16 text-center">
          <p className="t-lead">Nothing posted yet.</p>
        </div>
      ) : (
        <>
          <PinnedUpdates updates={pinned} onTag={toggleTag} activeTag={tag} />

          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {presentCategories.length > 1 ? (
              <FilterBar label="Filter by category" className="min-w-0">
                <FilterChip
                  active={category === "all"}
                  count={all.length}
                  onClick={() => setCategory("all")}
                >
                  All
                </FilterChip>
                {presentCategories.map((option) => (
                  <FilterChip
                    key={option.value}
                    active={category === option.value}
                    count={categoryCounts.get(option.value)}
                    onClick={() => setCategory(option.value)}
                  >
                    <CategoryIcon category={option.value} />
                    {option.label}
                  </FilterChip>
                ))}
              </FilterBar>
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
            <div className="-mt-4 mb-8 flex items-center gap-2 text-sm text-muted-foreground">
              Tagged
              <button
                type="button"
                onClick={() => setTag(null)}
                aria-label={`Stop filtering by ${tag}`}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary focus-ring"
              >
                #{tag}
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          )}

          {feed.length === 0 ? (
            filtering ? (
              <div className="rounded-surface border border-dashed px-6 py-16 text-center">
                <p className="t-lead">No updates match.</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-ring"
                >
                  <X className="size-3.5" aria-hidden />
                  Clear filters
                </button>
              </div>
            ) : null
          ) : (
            <>
              <Feed updates={feed} onTag={toggleTag} activeTag={tag} />
              {/*
                Shown for a filtered view too: "that's everything" is as true
                of a filtered feed, and hiding it would leave the reader
                wondering whether the filter cut the list short.
              */}
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

      {/*
        CMS sections for /updates, the way Contact, About and Home already
        have them — the Library's random highlight among them.
      */}
      <DynamicPageContent pagePath="/updates" className="mt-16" />
    </Band>
  );
}
