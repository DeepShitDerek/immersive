"use client";

import { useMemo } from "react";
import type { LifeUpdate } from "@/types";
import { Reveal } from "@/components/layout/motion";
import { distributeColumns, useColumnCount } from "@/hooks/use-column-count";
import { groupByMonth } from "@/lib/life-update";
import { useDisplayTimeZone } from "@/hooks/use-hydrated";
import { UpdateCard } from "./update-card";

interface FeedProps {
  updates: LifeUpdate[];
  onTag?: (tag: string) => void;
  activeTag?: string | null;
}

/**
 * Pinned updates, above the feed: the one or two things that are true for a
 * while rather than true on a day. The first is the feature; the rest sit
 * beside it at entry size, so pinning three things does not produce three
 * competing headlines.
 */
export function PinnedUpdates({ updates, onTag, activeTag }: FeedProps) {
  if (updates.length === 0) return null;
  const [first, ...rest] = updates;

  return (
    <section aria-label="Pinned" className="mb-16">
      <Reveal>
        <UpdateCard
          update={first}
          variant="feature"
          onTag={onTag}
          activeTag={activeTag}
        />
      </Reveal>
      {rest.length > 0 && (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {rest.map((update) => (
            <UpdateCard
              key={update.id}
              update={update}
              onTag={onTag}
              activeTag={activeTag}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * The journal: one reading column, a month at a time, each entry dated in the
 * margin — day number large, weekday under it — so the eye can run down the
 * dates without reading the cards. No rail and no dots: the old timeline drew
 * its structure with a line; here the margin column and the space between
 * months carry it.
 */
export function JournalFeed({ updates, onTag, activeTag }: FeedProps) {
  const timeZone = useDisplayTimeZone();
  const groups = useMemo(
    () => groupByMonth(updates, undefined, timeZone),
    [updates, timeZone],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-14">
      {groups.map((group) => (
        <Reveal key={group.label} as="div">
          <section aria-label={group.label}>
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-semibold tracking-tight">
                {group.label}
              </h2>
              <p className="text-sm text-muted-foreground">
                {group.updates.length}{" "}
                {group.updates.length === 1 ? "update" : "updates"}
              </p>
            </div>
            <ol className="list-none space-y-5 p-0">
              {group.updates.map((update) => (
                <li
                  key={update.id}
                  className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-5"
                >
                  <DayMark iso={update.created_at} />
                  <UpdateCard
                    update={update}
                    showDate={false}
                    onTag={onTag}
                    activeTag={activeTag}
                  />
                </li>
              ))}
            </ol>
          </section>
        </Reveal>
      ))}
    </div>
  );
}

function DayMark({ iso }: { iso?: string }) {
  const timeZone = useDisplayTimeZone();
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return <span aria-hidden />;
  return (
    <time dateTime={iso} className="pt-4 text-right">
      <span className="block font-heading text-2xl font-semibold leading-none tabular-nums text-foreground sm:text-3xl">
        {date.toLocaleDateString("en-US", { day: "numeric", timeZone })}
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">
        {date.toLocaleDateString("en-US", { weekday: "short", timeZone })}
      </span>
    </time>
  );
}

/**
 * The wall: every update at a glance, in ordered masonry. Round-robin columns
 * (see `distributeColumns`) so the newest read across the top row and each
 * column stays chronological downward, with no hole under a short card.
 */
export function WallFeed({ updates, onTag, activeTag }: FeedProps) {
  const columnCount = useColumnCount();
  const columns = useMemo(
    () => distributeColumns(updates, columnCount),
    [updates, columnCount],
  );

  return (
    <div className="flex items-start gap-5">
      {columns.map((column, index) => (
        <div key={index} className="flex min-w-0 flex-1 flex-col gap-5">
          {column.map((update) => (
            <UpdateCard
              key={update.id}
              update={update}
              onTag={onTag}
              activeTag={activeTag}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
