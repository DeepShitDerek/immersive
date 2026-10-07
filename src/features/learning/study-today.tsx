"use client";

import { useMemo } from "react";
import { Brain, CalendarCheck, Play, Plus } from "lucide-react";
import type {
  LearningReview,
  LearningSession,
  LearningSubject,
  LearningTopic,
} from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { daysOverdue, retentionRate } from "./spaced-review";

export interface StudyTodayProps {
  queue: { due: LearningTopic[]; fresh: LearningTopic[]; deferred: number };
  topics: LearningTopic[];
  subjects: LearningSubject[];
  sessions: LearningSession[];
  reviews: LearningReview[];
  today: string;
  onStart: () => void;
  onAddTopic: () => void;
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-surface border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && (
        <p className="mt-0.5 text-micro text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/**
 * The front door: one thing to do, and the reason to do it.
 *
 * The page used to open on four stat cards and a heatmap — a report on the
 * past, requiring you to decide what to study before you could start. Deciding
 * is the expensive part, and it happens at the exact moment motivation is
 * lowest. Now the decision is already made and there is a single button.
 */
export function StudyToday({
  queue,
  topics,
  reviews,
  today,
  onStart,
  onAddTopic,
}: StudyTodayProps) {
  const total = queue.due.length + queue.fresh.length;

  const stats = useMemo(() => {
    const retention = retentionRate(reviews);
    const learning = topics.filter(
      (t) => t.last_reviewed_at && !t.archived_at,
    ).length;
    // Anything on a long interval has genuinely stuck rather than been declared
    // "Mastered" by hand.
    const settled = topics.filter(
      (t) => (t.interval_days ?? 0) >= 21 && !t.archived_at,
    ).length;
    return { retention, learning, settled };
  }, [reviews, topics]);

  const oldest = queue.due[0] ? daysOverdue(queue.due[0], today) : 0;

  return (
    <div className="space-y-6">
      <section
        className={cn(
          "rounded-surface border p-6",
          total > 0 ? "border-primary/30 bg-card" : "bg-secondary/40",
        )}
      >
        {total > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">Today</p>
            <p className="mt-1 text-2xl font-semibold">
              {total} topic{total === 1 ? "" : "s"} to go over
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {queue.due.length > 0 && (
                <>
                  {queue.due.length} due for review
                  {queue.fresh.length > 0 && ", "}
                </>
              )}
              {queue.fresh.length > 0 && `${queue.fresh.length} new`}
              {/* Framed as a rough estimate, not a commitment. A number you can
                  fail to hit is a number that stops you starting. */}
              {" · "}about {Math.max(2, Math.round(total * 1.5))} minutes
            </p>

            <Button
              size="lg"
              className="mt-5 w-full sm:w-auto"
              onClick={onStart}
            >
              <Play className="mr-2 size-4" aria-hidden />
              Start
            </Button>

            {/*
              Deferred work is mentioned once, quietly, and never as a running
              total of failure. An unbounded backlog is the most reliable way to
              make someone stop opening a study tool.
            */}
            {queue.deferred > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                {queue.deferred} more waiting — they&apos;ll come up over the
                next few days. No need to catch up all at once.
              </p>
            )}
            {oldest > 14 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Some of these have been waiting a while. That&apos;s fine —
                they&apos;re scheduled to come back, not overdue.
              </p>
            )}
          </>
        ) : (
          <>
            <CalendarCheck
              aria-hidden
              className="mb-2 size-8 text-muted-foreground"
            />
            <p className="text-lg font-medium">Nothing due today</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything you&apos;re tracking is scheduled further out. Adding a
              topic is the only thing worth doing here right now.
            </p>
            <Button variant="outline" className="mt-4" onClick={onAddTopic}>
              <Plus className="mr-2 size-4" aria-hidden /> Add a topic
            </Button>
          </>
        )}
      </section>

      {/*
        Three numbers, none of which is hours studied. Time spent rewards
        sitting still; retention rewards remembering, which is the actual goal.
      */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat
          label="Recall rate"
          value={stats.retention === null ? "—" : `${stats.retention}%`}
          hint={
            stats.retention === null
              ? "After your first few reviews"
              : "Reviews you remembered"
          }
        />
        <Stat
          label="In rotation"
          value={`${stats.learning}`}
          hint="Topics with a schedule"
        />
        <Stat
          label="Settled"
          value={`${stats.settled}`}
          hint="Coming back in 3+ weeks"
        />
      </div>

      {total > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Brain aria-hidden className="size-3.5" />
            Up next
          </h2>
          <ul className="list-none divide-y rounded-surface border bg-card p-0">
            {[...queue.due, ...queue.fresh].slice(0, 5).map((topic) => (
              <li
                key={topic.id}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{topic.title}</span>
                <span className="shrink-0 text-micro text-muted-foreground">
                  {topic.last_reviewed_at ? "review" : "new"}
                </span>
              </li>
            ))}
            {total > 5 && (
              <li className="px-3 py-1 text-xs text-muted-foreground">
                and {total - 5} more
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
