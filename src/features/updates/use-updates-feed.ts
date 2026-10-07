"use client";

import { useMemo, useState } from "react";
import {
  useGetPublishedLifeUpdatesQuery,
  useGetSiteIdentityQuery,
} from "@/store/api/publicApi";
import { LIFE_UPDATE_CATEGORY_OPTIONS } from "@/lib/constants";
import { matchesSearch } from "@/lib/life-update";
import type { LifeUpdate, LifeUpdateCategory } from "@/types";

export interface FeedFilter {
  category: LifeUpdateCategory | "all";
  tag: string | null;
  searchTerm: string;
}

/**
 * Unfiltered, the feed leaves out what is already pinned above it. Filtered,
 * it is a result list and includes every match: a search that silently
 * skipped pinned updates would look broken.
 */
export function selectFeed(
  all: readonly LifeUpdate[],
  { category, tag, searchTerm }: FeedFilter,
): { pinned: LifeUpdate[]; feed: LifeUpdate[]; filtering: boolean } {
  const filtering = category !== "all" || !!searchTerm.trim() || !!tag;
  const pinned = all.filter((u) => u.is_pinned);
  const feed = filtering
    ? all.filter(
        (u) =>
          (category === "all" || u.category === category) &&
          (!tag || (u.tags ?? []).includes(tag)) &&
          matchesSearch(u, searchTerm),
      )
    : all.filter((u) => !u.is_pinned);
  return { pinned, feed, filtering };
}

const NO_UPDATES: LifeUpdate[] = [];

/**
 * What the updates page does, apart from how it looks: the updates, the
 * category, tag and search filters, what is pinned. The Classic page and the
 * immersive one both call this.
 */
export function useUpdatesFeed() {
  const { data: all = NO_UPDATES, isLoading } =
    useGetPublishedLifeUpdatesQuery();
  const { data: identity } = useGetSiteIdentityQuery();
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState<LifeUpdateCategory | "all">("all");
  const [tag, setTag] = useState<string | null>(null);

  const layout = identity?.profile_data.updates_layout ?? "scrapbook";

  const { pinned, feed, filtering } = useMemo(
    () => selectFeed(all, { category, tag, searchTerm }),
    [all, category, tag, searchTerm],
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const update of all) {
      counts.set(update.category, (counts.get(update.category) ?? 0) + 1);
    }
    return counts;
  }, [all]);

  const presentCategories = LIFE_UPDATE_CATEGORY_OPTIONS.filter((option) =>
    categoryCounts.has(option.value),
  );

  const clearFilters = () => {
    setSearchTerm("");
    setCategory("all");
    setTag(null);
  };

  const toggleTag = (next: string) =>
    setTag((current) => (current === next ? null : next));

  return {
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
    oldest: all[all.length - 1]?.created_at,
  };
}
