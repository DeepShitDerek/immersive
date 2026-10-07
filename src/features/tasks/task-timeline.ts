import type { Task } from "@/types";
import { addDays, daysBetween } from "./task-recurrence";
import { todayIso } from "./task-filters";

/**
 * Geometry for the timeline view.
 *
 * Kept out of the component because it is the part that can be wrong in ways
 * you cannot see — a bar off by a day looks plausible.
 */

export interface TimelineRange {
  start: string;
  end: string;
  /** Inclusive day count, so a single-day range is 1. */
  days: number;
}

/** Tasks that can be placed: a due date is the minimum. */
export function schedulableTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) => !!task.due_date);
}

/**
 * The window the chart covers.
 *
 * Padded by a few days either side so bars at the extremes are not flush
 * against the edge, and always includes today so the "now" marker has
 * somewhere to sit even when every task is in the past.
 */
export function timelineRange(
  tasks: Task[],
  today = todayIso(),
  padDays = 2,
): TimelineRange {
  const dates: string[] = [today];

  for (const task of schedulableTasks(tasks)) {
    if (task.due_date) dates.push(task.due_date);
    if (task.start_date) dates.push(task.start_date);
  }

  dates.sort();
  const start = addDays(dates[0], -padDays);
  const end = addDays(dates[dates.length - 1], padDays);

  return { start, end, days: daysBetween(start, end) + 1 };
}

export interface Bar {
  /** Percentage offset from the left edge of the chart. */
  left: number;
  /** Percentage width. Never zero — a same-day task still needs to be visible. */
  width: number;
}

/**
 * Where a task's bar sits within the range.
 *
 * A task with no start date is drawn as a single day at its due date rather
 * than stretched back to the beginning of the chart, which would imply a
 * duration nobody entered.
 */
export function barPosition(task: Task, range: TimelineRange): Bar | null {
  if (!task.due_date) return null;

  const start = task.start_date ?? task.due_date;
  const offset = daysBetween(range.start, start);
  const span = daysBetween(start, task.due_date) + 1;

  // Clamp into the range: a bar that starts before the window would render at
  // a negative offset and overflow its container.
  const left = Math.max(0, offset);
  const right = Math.min(range.days, offset + Math.max(1, span));
  const width = Math.max(1, right - left);

  return {
    left: (left / range.days) * 100,
    width: (width / range.days) * 100,
  };
}

/** Where today sits, as a percentage, or null when it is outside the range. */
export function todayMarker(
  range: TimelineRange,
  today = todayIso(),
): number | null {
  const offset = daysBetween(range.start, today);
  if (offset < 0 || offset > range.days) return null;
  return (offset / range.days) * 100;
}

/** Month boundaries within the range, for the header ticks. */
export function monthTicks(
  range: TimelineRange,
): { label: string; left: number }[] {
  const ticks: { label: string; left: number }[] = [];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  for (let day = 0; day < range.days; day++) {
    const iso = addDays(range.start, day);
    const [year, month, dayOfMonth] = iso.split("-").map(Number);
    if (day === 0 || dayOfMonth === 1) {
      ticks.push({
        label: `${months[month - 1]} ${year}`,
        left: (day / range.days) * 100,
      });
    }
  }

  return ticks;
}
