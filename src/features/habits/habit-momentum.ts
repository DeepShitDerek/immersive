import type { Habit } from "@/types";
import { addDays, isDueOn, todayIso } from "./habit-schedule";
import {
  currentStreak,
  dueToday,
  indexLogs,
  isSatisfiedOn,
} from "./habit-progress";

/**
 * What makes this section worth coming back to.
 *
 * The module worked and was not motivating, which is a different complaint
 * from a bug and needs a different kind of answer. Four stat cards of equal
 * weight — done today, longest streak, 30-day average, *active habits* — is
 * the same failure the dashboard rebuild diagnosed: equal weight makes the
 * reader do the triage the screen exists to do, and "active habits: 5" is a
 * number that has never once required a decision.
 *
 * What is here instead comes from what actually holds a habit:
 *
 * - **Loss aversion beats reward.** A streak you do not want to break is a
 *   stronger pull than any score. The module already computed streaks and then
 *   buried the motivating one — the streak you have *right now*, and what it
 *   costs to lose it today — behind a trivia stat about the longest ever.
 * - **One ask, not a scoreboard.** What is left today, said once.
 * - **A visible chain.** Seeing the last fortnight as a row of marks is the
 *   single most motivating thing a habit tracker draws, and it needs no
 *   points, levels or badges to work.
 *
 * Deliberately no gamification. The XP card was removed from this module once
 * already, because its score was the raw count of every log ever written — so
 * fourteen habits ticked once outranked one habit kept for a fortnight, which
 * is the opposite of what a tracker should reward. Nothing here invents a
 * number that is not a fact about the habits.
 */

export interface StreakAtRisk {
  habit: Habit;
  /** Days the streak currently runs to. Always ≥ 1, or it is not at risk. */
  streak: number;
}

/**
 * Habits with a live streak, due today, not yet done.
 *
 * The honest version of loss aversion: it names only streaks that are real and
 * only on days the habit is actually due. A tracker that told you a Mon/Wed/Fri
 * habit was "at risk" on a Tuesday would be manufacturing urgency, and you
 * would stop believing it — which costs more than the nudge was worth.
 */
export function streaksAtRisk(
  habits: Habit[],
  today = todayIso(),
): StreakAtRisk[] {
  return dueToday(habits, today)
    .filter((habit) => !isSatisfiedOn(habit, indexLogs(habit), today))
    .map((habit) => ({
      // The streak up to *yesterday* is what is on the line; measuring to today
      // would read zero for every unfinished habit and hide every risk there is.
      habit,
      streak: currentStreak(habit, addDays(today, -1)),
    }))
    .filter((entry) => entry.streak > 0)
    .sort((a, b) => b.streak - a.streak);
}

export interface TrailDay {
  date: string;
  /** Was the habit due on this day at all? */
  due: boolean;
  /** Due and satisfied. */
  done: boolean;
}

/**
 * The last `days` days for one habit, oldest first.
 *
 * `due` and `done` are separate because a gap on a day the habit was never due
 * is not a miss, and drawing it as one turns a perfectly kept weekends-only
 * habit into a wall of failures.
 */
export function recentTrail(
  habit: Habit,
  days = 14,
  today = todayIso(),
): TrailDay[] {
  const logs = indexLogs(habit);
  const trail: TrailDay[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const due = isDueOn(habit, date);
    trail.push({
      date,
      due,
      done: due && isSatisfiedOn(habit, logs, date),
    });
  }

  return trail;
}

export interface TodayStanding {
  due: number;
  done: number;
  remaining: number;
  /** Every habit due today is done. False when nothing was due — see below. */
  perfect: boolean;
  /** Nothing was scheduled at all. A rest day is not an achievement. */
  restDay: boolean;
}

export function todayStanding(
  habits: Habit[],
  today = todayIso(),
): TodayStanding {
  const due = dueToday(habits, today);
  const done = due.filter((habit) =>
    isSatisfiedOn(habit, indexLogs(habit), today),
  ).length;

  return {
    due: due.length,
    done,
    remaining: due.length - done,
    // A day with nothing scheduled is not a perfect day. Congratulating
    // somebody for a day that asked nothing of them is how a tracker teaches
    // you to stop reading it.
    perfect: due.length > 0 && done === due.length,
    restDay: due.length === 0,
  };
}

/**
 * One sentence about the standing, in place of a percentage.
 *
 * A number invites you to optimise it; a sentence tells you where you are. The
 * distinction matters most on the bad weeks, which are the weeks somebody
 * stops opening the app.
 */
export function standingSentence(
  standing: TodayStanding,
  atRisk: StreakAtRisk[],
): string {
  if (standing.restDay) return "Nothing scheduled today.";

  if (standing.remaining === 0) {
    return standing.due === 1
      ? "That was the one thing due today."
      : `All ${standing.due} done today.`;
  }

  if (atRisk.length > 0) {
    const longest = atRisk[0];
    return `${longest.habit.title} is on a ${longest.streak}-day run.`;
  }

  return standing.remaining === 1
    ? "One left today."
    : `${standing.remaining} left today.`;
}
