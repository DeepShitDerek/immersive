import type { DashboardData, Habit } from "@/types";
import { isDueOn } from "@/features/habits/habit-schedule";
import { indexLogs, isSatisfiedOn } from "@/features/habits/habit-progress";
import { heatmapDates } from "./chart-geometry";

/**
 * What the charts are actually plotting.
 *
 * Separated from the components for the usual reason — a chart's bugs live in
 * its arithmetic — but also because two of these are less obvious than they
 * look. Filling gaps in a daily series and deciding what "a habit day" means
 * are both decisions, and both are wrong in a way that still renders.
 */

/**
 * A value per day for the last `days` days, oldest first, zero-filled.
 *
 * The database only returns days that had rows. Plotting that directly draws a
 * straight line from Tuesday to Saturday and calls it steady spending, when in
 * fact nothing was spent in between — the same failure the analytics series
 * had. Every day gets a point.
 */
function dailySeries(
  rows: { day: string; total: number }[],
  days: number,
  today = new Date(),
): { date: string; value: number }[] {
  const byDay = new Map(rows.map((row) => [row.day.slice(0, 10), row.total]));

  return buildDays(days, today).map((date) => ({
    date,
    value: byDay.get(date) ?? 0,
  }));
}

/** Local calendar days, oldest first. */
function buildDays(days: number, today: Date): string[] {
  const out: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - offset,
    );
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    out.push(`${date.getFullYear()}-${month}-${day}`);
  }
  return out;
}

/**
 * Habit consistency per day, as a fraction of what was actually due.
 *
 * The denominator is the point. Counting completions against *all* habits
 * punishes a weekday-only routine every Saturday, when in truth there was
 * nothing to do — so a perfectly kept week would render as five-sevenths grey.
 * A day with nothing due is not a failure; it has no intensity at all.
 */
export function habitHeat(
  habits: Habit[],
  weeks = 12,
  today = new Date(),
): { date: string; intensity: number }[] {
  const active = habits.filter((habit) => !habit.archived_at);
  const logs = new Map(active.map((habit) => [habit.id, indexLogs(habit)]));

  return heatmapDates(weeks, today).map((date) => {
    let due = 0;
    let done = 0;

    for (const habit of active) {
      if (!isDueOn(habit, date)) continue;
      due += 1;
      if (isSatisfiedOn(habit, logs.get(habit.id)!, date)) done += 1;
    }

    return { date, intensity: due === 0 ? 0 : done / due };
  });
}

/** Money in and out over the same days, for a two-series chart. */
export function cashflow(
  data: DashboardData,
  days = 7,
  today = new Date(),
): {
  dates: string[];
  earned: number[];
  spent: number[];
  totalEarned: number;
  totalSpent: number;
} {
  const earnedSeries = dailySeries(data.dailyEarnings, days, today);
  const spentSeries = dailySeries(data.dailyExpenses, days, today);

  return {
    dates: earnedSeries.map((entry) => entry.date),
    earned: earnedSeries.map((entry) => entry.value),
    spent: spentSeries.map((entry) => entry.value),
    totalEarned: earnedSeries.reduce((sum, entry) => sum + entry.value, 0),
    totalSpent: spentSeries.reduce((sum, entry) => sum + entry.value, 0),
  };
}
