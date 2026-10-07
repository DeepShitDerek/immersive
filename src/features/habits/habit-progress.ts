import type { Habit, HabitLog } from "@/types";
import {
  addDays,
  isDueOn,
  scheduledDatesBetween,
  startOfWeek,
  todayIso,
} from "./habit-schedule";

/**
 * Progress, streaks and completion, computed against the schedule.
 *
 * The previous implementation counted consecutive calendar days and divided
 * logs by a fixed 14-day window, so any habit that was not daily reported a
 * broken streak and an understated completion rate.
 */

/** Logs indexed by date, so per-day lookups are not repeated scans. */
export function indexLogs(habit: Habit): Map<string, HabitLog> {
  return new Map(
    (habit.habit_logs ?? []).map((log) => [log.completed_date, log]),
  );
}

export function targetValue(habit: Pick<Habit, "target_value">): number {
  const target = habit.target_value;
  return target != null && target > 0 ? target : 1;
}

export function stepValue(habit: Pick<Habit, "step" | "target_value">): number {
  const step = habit.step;
  return step != null && step > 0 ? step : 1;
}

/** How much was recorded on a date. Absent log means nothing was done. */
function valueOn(logs: Map<string, HabitLog>, iso: string): number {
  const log = logs.get(iso);
  if (!log) return 0;
  // Rows written before the `value` column existed default to 1, but a null
  // that slipped through must not read as zero — the log itself is the signal.
  return log.value ?? 1;
}

/**
 * Was the habit satisfied on this date?
 *
 * A "quit" habit inverts: success is the *absence* of a log. Logging a quit
 * habit records a slip, so a day with no entry is a good day.
 */
export function isSatisfiedOn(
  habit: Habit,
  logs: Map<string, HabitLog>,
  iso: string,
): boolean {
  const value = valueOn(logs, iso);
  if ((habit.kind ?? "build") === "quit") return value === 0;
  return value >= targetValue(habit);
}

/**
 * The value a tap in the history grid sets for a day.
 *
 * A done day clears; anything short of done — including a partial day, 3 of
 * 8 glasses — becomes done. It used to clear whenever any log existed, so
 * tapping a partial day played the "completed" confetti and then deleted the
 * partial count. A quit habit's log is a slip: a tap records one, or clears it.
 */
export function toggledValue(
  habit: Habit,
  logs: Map<string, HabitLog>,
  iso: string,
): number {
  if ((habit.kind ?? "build") === "quit") return valueOn(logs, iso) > 0 ? 0 : 1;
  return isSatisfiedOn(habit, logs, iso) ? 0 : targetValue(habit);
}

export interface DayProgress {
  value: number;
  target: number;
  /** 0–1. Clamped, so overshooting does not render past the ring. */
  ratio: number;
  satisfied: boolean;
}

export function progressOn(
  habit: Habit,
  logs: Map<string, HabitLog>,
  iso: string,
): DayProgress {
  const value = valueOn(logs, iso);
  const target = targetValue(habit);
  return {
    value,
    target,
    ratio: Math.min(1, target > 0 ? value / target : 0),
    satisfied: isSatisfiedOn(habit, logs, iso),
  };
}

/**
 * The first day a streak could possibly have started.
 *
 * A "quit" habit is satisfied by the *absence* of a log, so without a floor the
 * walk backwards would never find a miss and would report a streak stretching
 * to the loop bound. The habit cannot have been kept before it existed.
 */
function earliestBound(habit: Habit): string {
  const created = habit.created_at?.slice(0, 10);
  const logDates = (habit.habit_logs ?? []).map((l) => l.completed_date).sort();
  if (created && logDates.length > 0) {
    return created < logDates[0] ? created : logDates[0];
  }
  return created ?? logDates[0] ?? todayIso();
}

/**
 * Current streak, in scheduled days.
 *
 * Days the habit is not due are skipped rather than breaking the run, which is
 * the whole point of storing a schedule. Today is not counted as a miss while
 * it is still in progress — a daily habit at 9am has not failed yet — so an
 * unsatisfied today starts the walk at yesterday instead of ending it at zero.
 */
export function currentStreak(habit: Habit, today = todayIso()): number {
  const logs = indexLogs(habit);
  const floor = earliestBound(habit);
  let streak = 0;
  let cursor = today;

  if (isDueOn(habit, today) && !isSatisfiedOn(habit, logs, today)) {
    cursor = addDays(today, -1);
  }

  // Bounded twice: by the habit's own start, and by a hard ceiling so a corrupt
  // created_at cannot spin the loop.
  for (let i = 0; i < 3650 && cursor >= floor; i++) {
    if (!isDueOn(habit, cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (!isSatisfiedOn(habit, logs, cursor)) break;
    streak++;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

/**
 * Longest run of satisfied scheduled days on record.
 *
 * Starts at the habit's own beginning rather than assuming an unbounded past,
 * for the same reason `currentStreak` does.
 */
export function bestStreak(habit: Habit, today = todayIso()): number {
  const logs = indexLogs(habit);
  const scheduled = scheduledDatesBetween(habit, earliestBound(habit), today);
  let best = 0;
  let run = 0;

  for (const iso of scheduled) {
    if (isSatisfiedOn(habit, logs, iso)) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  return best;
}

/**
 * Completion over the last `days` scheduled occurrences.
 *
 * Denominator is scheduled days, not calendar days: a weekends-only habit that
 * never misses is at 100%, where dividing by 14 would have reported 29%.
 */
export function completionRate(
  habit: Habit,
  days = 30,
  today = todayIso(),
): number {
  const logs = indexLogs(habit);
  const scheduled = scheduledDatesBetween(
    habit,
    addDays(today, -(days - 1)),
    today,
  );
  if (scheduled.length === 0) return 0;

  const met = scheduled.filter((iso) => isSatisfiedOn(habit, logs, iso)).length;
  return Math.round((met / scheduled.length) * 100);
}

/**
 * Progress within the current week, for `weekly_count` habits.
 *
 * These name a quantity, not days ("three times a week"), so a per-day verdict
 * is meaningless — what matters is how many of the week's opportunities have
 * been taken.
 */
export function weeklyProgress(
  habit: Habit,
  today = todayIso(),
): { done: number; target: number } {
  const logs = indexLogs(habit);
  const start = startOfWeek(today);
  let done = 0;

  for (let i = 0; i < 7; i++) {
    const iso = addDays(start, i);
    if (iso > today) break;
    if (isSatisfiedOn(habit, logs, iso)) done++;
  }

  return { done, target: habit.target_per_week ?? 7 };
}

/** Habits due today that are not yet satisfied. */
export function dueToday(habits: Habit[], today = todayIso()): Habit[] {
  return habits.filter((habit) => isDueOn(habit, today));
}
