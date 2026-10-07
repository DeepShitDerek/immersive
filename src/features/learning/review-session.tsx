"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Eye, PartyPopper, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { LearningTopic } from "@/types";
import { useRecordReviewMutation } from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { getErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/cn";
import {
  REVIEW_RATINGS,
  describeInterval,
  isMarkable,
  previewIntervals,
  promptFor,
  type ReviewRating,
} from "./spaced-review";

export interface ReviewSessionProps {
  queue: LearningTopic[];
  onExit: () => void;
  onEditTopic: (topic: LearningTopic) => void;
}

/**
 * One topic at a time, recall first.
 *
 * The old flow was: open a topic, read your own notes, and separately remember
 * to start a timer. Reading your notes is the least effective thing you can do
 * with them — recognition feels like knowing and is not. So the notes stay
 * hidden until you have tried to remember, and the only input afterwards is how
 * it went, which is one tap and also sets the next review date.
 *
 * There is no progress bar over the whole backlog on purpose. A queue you
 * cannot see the end of is a queue you do not start.
 */
export function ReviewSession({
  queue,
  onExit,
  onEditTopic,
}: ReviewSessionProps) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  /** Which option was chosen, for a multiple-choice topic. */
  const [picked, setPicked] = useState<string | null>(null);
  const [recordReview, { isLoading }] = useRecordReviewMutation();

  const topic = queue[index];
  const preview = useMemo(
    () => (topic ? previewIntervals(topic) : null),
    [topic],
  );

  const markable = topic ? isMarkable(topic) : false;
  const choices = useMemo(
    () => (markable ? (topic?.choices ?? []) : []),
    [markable, topic],
  );

  // Space reveals, 1–4 rates. Studying is repetitive by design; reaching for
  // the mouse for every card is what makes it feel like admin.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!topic) return;
      if (event.key === " " && !revealed) {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      if (!revealed) return;
      const digit = Number(event.key);
      if (digit >= 1 && digit <= 4) {
        event.preventDefault();
        void rate(REVIEW_RATINGS[digit - 1].value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, revealed]);

  const rate = async (rating: ReviewRating) => {
    if (!topic) return;
    try {
      await recordReview({ topic_id: topic.id, rating }).unwrap();
      setRevealed(false);
      setPicked(null);
      setIndex((i) => i + 1);
    } catch (err) {
      toast.error("Couldn't save that review", {
        description: getErrorMessage(err),
      });
    }
  };

  if (!topic) {
    return (
      <div className="rounded-surface border bg-card px-6 py-16 text-center">
        <PartyPopper
          aria-hidden
          className="mx-auto mb-3 size-10 text-success"
        />
        <p className="text-lg font-medium">Done for today</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {queue.length} topic{queue.length === 1 ? "" : "s"} reviewed. Come
          back tomorrow — the schedule will bring things up when they need it.
        </p>
        <Button className="mt-6" onClick={onExit}>
          Back to learning
        </Button>
      </div>
    );
  }

  const isFirstTime = !topic.last_reviewed_at;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft className="mr-2 size-4" aria-hidden /> Stop
        </Button>
        {/* The count is of today's queue, which is capped — never of everything
            outstanding. */}
        <span className="text-sm tabular-nums text-muted-foreground">
          {index + 1} of {queue.length}
        </span>
      </div>
      {/* Progress through today's queue, as a bar under the count. */}
      <div
        role="progressbar"
        aria-label="Today's reviews"
        aria-valuemin={0}
        aria-valuemax={queue.length}
        aria-valuenow={index}
        className="mb-4 h-1 overflow-hidden rounded-full bg-secondary"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-base"
          style={{ width: `${(index / Math.max(queue.length, 1)) * 100}%` }}
        />
      </div>

      <article className="rounded-surface border bg-card p-6">
        {isFirstTime && (
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-control bg-info/10 px-2 py-1 text-xs font-medium text-info">
            <Sparkles aria-hidden className="size-3" />
            First time
          </p>
        )}

        {/*
          The prompt, which is not the title.
          
          A title is a label you scan in a list ("TCP handshake"); a prompt is
          the question you are actually asked ("What are the three messages, in
          order?"). Asking with a label is why recall felt vague — you were
          guessing what was being asked as well as the answer. Falls back to
          the title, so every existing topic reads exactly as it did.
        */}
        <h2 className="break-words text-xl font-semibold">
          {promptFor(topic)}
        </h2>
        {topic.prompt?.trim() && (
          <p className="mt-1 text-xs text-muted-foreground">{topic.title}</p>
        )}

        {/*
          Multiple choice, shown before the reveal.
          
          Picking an option is a harder act than deciding you "sort of knew
          it", which is the point: certification practice needs you committed
          to an answer before you see the right one. Options are stored as
          values and matched by value, so reordering them in the editor cannot
          silently change which is correct.
        */}
        {!revealed && choices.length > 0 && (
          <ul className="mt-6 space-y-2">
            {choices.map((choice) => (
              <li key={choice}>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(choice);
                    setRevealed(true);
                  }}
                  className={cn(
                    "w-full rounded-control bg-secondary px-4 py-2.5 text-left text-sm transition-colors",
                    "hover:bg-secondary/70 focus-ring",
                  )}
                >
                  {choice}
                </button>
              </li>
            ))}
          </ul>
        )}

        {revealed && markable && (
          <p
            className={cn(
              "mt-4 inline-flex items-center gap-1.5 rounded-control px-2.5 py-1 text-sm font-medium",
              picked === null
                ? "bg-secondary text-muted-foreground"
                : picked === topic.answer
                  ? "bg-success/15 text-success"
                  : "bg-destructive/15 text-destructive",
            )}
          >
            {picked === null
              ? "Answer"
              : picked === topic.answer
                ? "Correct"
                : "Not quite"}
            <span className="font-normal">— {topic.answer}</span>
          </p>
        )}

        {!revealed && choices.length === 0 ? (
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              {isFirstTime
                ? "Read through it, then rate how well it landed."
                : "What do you remember? Try to answer before revealing."}
            </p>
            <Button className="mt-4" onClick={() => setRevealed(true)}>
              <Eye className="mr-2 size-4" aria-hidden />
              {isFirstTime ? "Show notes" : "Reveal"}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">or press space</p>
          </div>
        ) : (
          <>
            <div className="mt-4 border-t pt-4">
              {topic.core_notes ? (
                <Markdown className="text-sm">{topic.core_notes}</Markdown>
              ) : (
                <p className="text-sm italic text-muted-foreground">
                  No notes yet.{" "}
                  <button
                    type="button"
                    className="text-primary underline-offset-4 hover:underline"
                    onClick={() => onEditTopic(topic)}
                  >
                    Add some
                  </button>{" "}
                  — future you will be reviewing from them.
                </p>
              )}
            </div>

            {topic.resources && topic.resources.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                {topic.resources.map((resource) => (
                  <li key={resource.url}>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-control bg-secondary px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {resource.name}
                    </a>
                  </li>
                ))}
              </ul>
            )}

            {/* On a phone the ratings ride at the bottom of the screen, above
                the tab bar, so a long answer never pushes them out of reach. */}
            <div className="sticky bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] -mx-6 mt-6 border-t bg-card px-6 pb-4 pt-4 sm:static sm:mx-0 sm:px-0 sm:pb-0">
              <p className="mb-2 text-xs text-muted-foreground">
                How did that go?
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {REVIEW_RATINGS.map((option, i) => (
                  <Button
                    key={option.value}
                    variant={option.value === "good" ? "default" : "outline"}
                    disabled={isLoading}
                    onClick={() => void rate(option.value)}
                    className={cn(
                      "h-auto flex-col items-start gap-0.5 px-3 py-2 text-left",
                      option.value === "again" &&
                        "border-destructive/30 text-destructive hover:bg-destructive/10",
                    )}
                  >
                    <span className="flex w-full items-center justify-between text-sm font-medium">
                      {option.label}
                      <kbd className="text-micro font-normal opacity-70">
                        {i + 1}
                      </kbd>
                    </span>
                    <span className="text-micro font-normal opacity-80">
                      {preview && describeInterval(preview[option.value])}
                    </span>
                  </Button>
                ))}
              </div>
              {/* Stated plainly so the ratings are a scheduling tool rather
                  than a self-assessment to feel bad about. */}
              <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                <Check aria-hidden className="mt-0.5 size-3 shrink-0" />
                This only sets when you next see it. There is no score.
              </p>
            </div>
          </>
        )}
      </article>
    </div>
  );
}
