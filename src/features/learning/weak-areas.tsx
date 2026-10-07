"use client";

import { useMemo } from "react";
import { TrendingDown } from "lucide-react";
import type { LearningTopic } from "@/types";
import { weakAreas } from "./spaced-review";

/**
 * What keeps slipping.
 *
 * `lapses` and `ease` have been recorded since the module's first migration
 * and never shown anywhere, so the one question a study tool ought to be able
 * to answer — "what am I actually bad at?" — had no screen. Both are already
 * honest signals rather than invented scores: a lapse is a topic you had
 * learned and then failed to recall, and ease falls each time that happens.
 *
 * Deliberately short. A list of everything you are weak at is a list nobody
 * opens twice, and the point is to pick something up, not to be audited.
 */
export function WeakAreas({
  topics,
  onOpen,
}: {
  topics: LearningTopic[];
  onOpen: (topic: LearningTopic) => void;
}) {
  const areas = useMemo(() => weakAreas(topics), [topics]);

  // Nothing has lapsed yet, which is not a state worth a panel — an empty
  // "weak areas" heading reads as a failure to load.
  if (areas.length === 0) return null;

  return (
    <section
      aria-label="Weak areas"
      className="mt-6 rounded-surface border bg-card p-5"
    >
      <h2 className="t-eyebrow mb-3 flex items-center gap-1.5">
        <TrendingDown className="size-3.5 text-warning" aria-hidden />
        Keeps slipping
      </h2>
      <ul className="space-y-1.5">
        {areas.map(({ topic, lapses }) => (
          <li key={topic.id}>
            <button
              type="button"
              onClick={() => onOpen(topic)}
              className="flex w-full items-center justify-between gap-3 rounded-control px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary focus-ring"
            >
              <span className="min-w-0 truncate">{topic.title}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                forgotten {lapses}×
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Counted from reviews you had learned and then could not recall — not
        from first attempts, which are supposed to be wrong.
      </p>
    </section>
  );
}
