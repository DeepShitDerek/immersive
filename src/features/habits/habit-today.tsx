"use client";

import { Check, Flame, Minus, Plus, Undo2 } from "lucide-react";
import type { Habit } from "@/types";
import { Button } from "@/components/ui/button";
import { HABIT_TIME_OF_DAY_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { habitColor } from "./habit-color";
import { HabitTrail } from "./habit-standing";
import { describeSchedule } from "./habit-schedule";
import {
  currentStreak,
  indexLogs,
  progressOn,
  stepValue,
  targetValue,
  weeklyProgress,
} from "./habit-progress";

export interface HabitTodayProps {
  habits: Habit[];
  today: string;
  onSetValue: (habit: Habit, value: number) => void;
  onOpen: (habit: Habit) => void;
}

/** A ring that fills with the day's progress. */
function ProgressRing({
  ratio,
  color,
  children,
}: {
  ratio: number;
  color: string;
  children: React.ReactNode;
}) {
  const size = 44;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <span className="relative inline-flex size-11 shrink-0 items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        className="absolute inset-0 -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="transition-[stroke-dashoffset] duration-slow ease-enter motion-reduce:transition-none"
        />
      </svg>
      {children}
    </span>
  );
}

function HabitTodayRow({
  habit,
  today,
  onSetValue,
  onOpen,
}: {
  habit: Habit;
  today: string;
  onSetValue: (habit: Habit, value: number) => void;
  onOpen: (habit: Habit) => void;
}) {
  const logs = indexLogs(habit);
  const progress = progressOn(habit, logs, today);
  const target = targetValue(habit);
  const step = stepValue(habit);
  const color = habitColor(habit);
  const streak = currentStreak(habit, today);
  const isQuit = (habit.kind ?? "build") === "quit";
  const isQuantified = target > 1;
  const weekly =
    habit.schedule === "weekly_count" ? weeklyProgress(habit, today) : null;

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-surface bg-card p-3 shadow-e1 transition-shadow duration-base ease-enter hover:shadow-e2",
        progress.satisfied && !isQuit && "opacity-70",
      )}
    >
      <ProgressRing
        ratio={isQuit ? (progress.value > 0 ? 1 : 0) : progress.ratio}
        color={isQuit && progress.value > 0 ? "hsl(var(--destructive))" : color}
      >
        {progress.satisfied && !isQuit ? (
          <Check className="size-4" style={{ color }} aria-hidden />
        ) : (
          <span className="text-micro font-medium tabular-nums">
            {isQuit ? (progress.value > 0 ? "!" : "✓") : progress.value}
          </span>
        )}
      </ProgressRing>

      <button
        type="button"
        onClick={() => onOpen(habit)}
        className="min-w-0 flex-1 text-left focus-ring"
      >
        <span
          className={cn(
            "block break-words text-sm font-medium",
            progress.satisfied && !isQuit && "line-through",
          )}
        >
          {habit.title}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-micro text-muted-foreground">
          <span>{describeSchedule(habit)}</span>
          {weekly && (
            <span>
              {weekly.done}/{weekly.target} this week
            </span>
          )}
          {isQuantified && !isQuit && (
            <span>
              {progress.value}/{target}
              {habit.unit ? ` ${habit.unit}` : ""}
            </span>
          )}
          {streak > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <Flame aria-hidden className="size-3" />
              {streak}
            </span>
          )}
        </span>

        {/*
          The chain, where you tick things off rather than on a separate
          screen. Seeing the last fortnight is the thing that makes a gap feel
          like a gap, and it needs no score attached to work.
        */}
        <span className="mt-1.5 block">
          <HabitTrail habit={habit} today={today} />
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        {isQuit ? (
          /* A quit habit is kept by doing nothing, so the only action is to
             admit a slip — and to take it back. */
          progress.value > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSetValue(habit, 0)}
              aria-label={`Undo slip for ${habit.title}`}
            >
              <Undo2 className="mr-1.5 size-3.5" aria-hidden /> Undo
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSetValue(habit, 1)}
              aria-label={`Record a slip for ${habit.title}`}
            >
              Slipped
            </Button>
          )
        ) : isQuantified ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={progress.value <= 0}
              onClick={() =>
                onSetValue(habit, Math.max(0, progress.value - step))
              }
              aria-label={`Decrease ${habit.title}`}
            >
              <Minus className="size-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onSetValue(habit, progress.value + step)}
              aria-label={`Add ${step}${habit.unit ? ` ${habit.unit}` : ""} to ${habit.title}`}
            >
              <Plus className="size-4" aria-hidden />
            </Button>
          </>
        ) : (
          <Button
            variant={progress.satisfied ? "secondary" : "outline"}
            size="icon"
            className="size-8"
            onClick={() => onSetValue(habit, progress.satisfied ? 0 : target)}
            aria-label={
              progress.satisfied
                ? `Mark ${habit.title} not done`
                : `Complete ${habit.title}`
            }
          >
            <Check className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Today, grouped by time of day.
 *
 * This is the view the module was missing: it opened on a habit × day grid,
 * which is a record of the past rather than a prompt for the present. Every
 * tracker worth copying leads with "what is due now".
 */
export function HabitToday({
  habits,
  today,
  onSetValue,
  onOpen,
}: HabitTodayProps) {
  const groups = HABIT_TIME_OF_DAY_OPTIONS.map((option) => ({
    ...option,
    habits: habits.filter(
      (habit) => (habit.time_of_day ?? "anytime") === option.value,
    ),
  })).filter((group) => group.habits.length > 0);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.value} aria-label={group.label}>
          {/* Only worth a heading when there is more than one group. */}
          {groups.length > 1 && (
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group.label}
            </h3>
          )}
          <ul className="space-y-2">
            {group.habits.map((habit) => (
              <HabitTodayRow
                key={habit.id}
                habit={habit}
                today={today}
                onSetValue={onSetValue}
                onOpen={onOpen}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
