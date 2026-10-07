"use client";

import { useMemo } from "react";
import { Flame, PartyPopper } from "lucide-react";
import type { Habit } from "@/types";
import { cn } from "@/lib/cn";
import { completionRate } from "./habit-progress";
import {
  standingSentence,
  streaksAtRisk,
  todayStanding,
  type TrailDay,
} from "./habit-momentum";
import { recentTrail } from "./habit-momentum";
import { habitColor } from "./habit-color";

/**
 * The lead, in place of four stat cards.
 *
 * The previous header was four equal-weight numbers — done today, longest
 * streak, 30-day average, active habits — which is the failure the dashboard
 * rebuild diagnosed: equal weight makes the reader do the triage the screen
 * exists to do. "Active habits: 5" in particular is a number that has never
 * once required a decision.
 *
 * This says one thing, then shows what is on the line. No points, levels or
 * badges: the XP card was removed from this module once already because its
 * score rewarded breadth over persistence, and nothing here is a number that
 * is not a plain fact about the habits.
 */
export function HabitStanding({
  habits,
  today,
}: {
  habits: Habit[];
  today: string;
}) {
  const { standing, atRisk, sentence, thirtyDay } = useMemo(() => {
    const standing = todayStanding(habits, today);
    const atRisk = streaksAtRisk(habits, today);

    // Averaged per habit rather than pooling every log, so a habit due twice a
    // week is not drowned out by a daily one.
    const rates = habits.map((habit) => completionRate(habit, 30, today));
    const thirtyDay =
      rates.length > 0
        ? Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length)
        : null;

    return {
      standing,
      atRisk,
      sentence: standingSentence(standing, atRisk),
      thirtyDay,
    };
  }, [habits, today]);

  if (habits.length === 0) return null;

  return (
    <section
      aria-label="Where you stand"
      className="mb-6 rounded-surface bg-card p-5 shadow-e1"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="flex items-center gap-2 text-lg font-semibold">
          {standing.perfect && (
            <PartyPopper className="size-5 text-success" aria-hidden />
          )}
          {sentence}
        </p>

        {/*
          The count is still here, and still small. It answers "how much is
          left" for someone who wants the number; it is not the headline,
          because the number is not the reason to come back.
        */}
        {!standing.restDay && (
          <p className="text-sm tabular-nums text-muted-foreground">
            {standing.done}/{standing.due} today
            {thirtyDay !== null && <> · {thirtyDay}% over 30 days</>}
          </p>
        )}
      </div>

      {atRisk.length > 0 && (
        <div className="mt-4">
          <h3 className="t-eyebrow mb-2 flex items-center gap-1.5">
            <Flame className="size-3.5 text-warning" aria-hidden />
            On the line today
          </h3>
          <ul className="flex flex-wrap gap-2">
            {atRisk.slice(0, 4).map(({ habit, streak }) => (
              <li
                key={habit.id}
                className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm"
              >
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ backgroundColor: habitColor(habit) }}
                />
                <span className="min-w-0 truncate">{habit.title}</span>
                <span className="tabular-nums text-muted-foreground">
                  {streak}d
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * The last fortnight for one habit.
 *
 * The single most motivating thing a habit tracker draws, and it needs no
 * score attached: you can see the chain, and you can see the gap.
 *
 * A day the habit was never due is drawn as nothing rather than as a miss.
 * Without that distinction a perfectly kept weekends-only habit renders as a
 * wall of failures — the same mistake the schedule work in this module was
 * done to fix.
 */
export function HabitTrail({
  habit,
  today,
  days = 14,
}: {
  habit: Habit;
  today: string;
  days?: number;
}) {
  const trail = useMemo(
    () => recentTrail(habit, days, today),
    [habit, days, today],
  );
  const colour = habitColor(habit);
  const kept = trail.filter((day) => day.done).length;
  const due = trail.filter((day) => day.due).length;

  return (
    <span
      className="inline-flex items-center gap-[3px]"
      role="img"
      aria-label={`${kept} of ${due} kept in the last ${days} days`}
    >
      {trail.map((day: TrailDay) => (
        <span
          key={day.date}
          aria-hidden
          className={cn(
            "h-3.5 w-1.5 rounded-full",
            !day.due && "bg-border/40",
            day.due && !day.done && "bg-border",
          )}
          style={day.done ? { backgroundColor: colour } : undefined}
        />
      ))}
    </span>
  );
}
