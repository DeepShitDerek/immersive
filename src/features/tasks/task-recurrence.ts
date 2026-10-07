import type { Task, TaskRecurrence } from "@/types";

/**
 * Repeat handling.
 *
 * Completing a repeating task creates the next instance rather than resetting
 * the current one, so the history of what was actually finished survives — the
 * dashboard's completion stats read `completed_at`, and a task that resets in
 * place would report a single completion no matter how many times it ran.
 */

/** Days in a month, honouring leap years. */
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Advance a `YYYY-MM-DD` date by one repeat interval.
 *
 * Parsed as UTC deliberately. `new Date("2026-03-29")` is UTC midnight, but
 * `new Date(2026, 2, 29)` is local midnight — mixing the two shifts the result
 * by a day either side of a DST boundary, which for a daily task means a
 * skipped or duplicated day twice a year.
 *
 * Monthly repeats clamp to the end of the target month, so the 31st of January
 * advances to the 28th of February rather than rolling into March.
 */
function advanceDate(
  isoDate: string,
  recurrence: TaskRecurrence,
  interval = 1,
): string {
  const step = Math.max(1, Math.floor(interval));
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;

  if (recurrence === "monthly") {
    const targetMonth = m - 1 + step;
    const year = y + Math.floor(targetMonth / 12);
    const monthIndex = ((targetMonth % 12) + 12) % 12;
    const day = Math.min(d, daysInMonth(year, monthIndex));
    return toIso(year, monthIndex + 1, day);
  }

  const days = recurrence === "weekly" ? 7 * step : step;
  const next = new Date(Date.UTC(y, m - 1, d));
  next.setUTCDate(next.getUTCDate() + days);
  return toIso(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
  );
}

function toIso(year: number, month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * The task to create when a repeating task is completed, or null when there is
 * nothing to repeat.
 *
 * The start date shifts by the same number of days the due date moved, so a
 * task scheduled to run over three days keeps its three-day window rather than
 * collapsing onto the new due date.
 */
export function nextOccurrence(task: Task): Partial<Task> | null {
  if (!task.recurrence || !task.due_date) return null;

  const interval = task.recurrence_interval ?? 1;
  const nextDue = advanceDate(task.due_date, task.recurrence, interval);

  let nextStart: string | null = null;
  if (task.start_date) {
    const span = daysBetween(task.start_date, task.due_date);
    nextStart = addDays(nextDue, -span);
  }

  return {
    project_id: task.project_id ?? null,
    title: task.title,
    description: task.description ?? null,
    status: "todo",
    priority: task.priority ?? "medium",
    start_date: nextStart,
    due_date: nextDue,
    tags: task.tags ?? null,
    estimate_minutes: task.estimate_minutes ?? null,
    // Tracked time belongs to the instance that did the work, not the series.
    tracked_minutes: 0,
    recurrence: task.recurrence,
    recurrence_interval: task.recurrence_interval ?? null,
    recurrence_parent_id: task.recurrence_parent_id ?? task.id,
  };
}

/**
 * Whether the series already has the task `nextOccurrence` would create
 *. Un-completing a repeating task and completing it again used to
 * add a second "next" task each time.
 */
export function hasNextOccurrence(
  tasks: readonly Task[],
  completed: Task,
  next: Partial<Task>,
): boolean {
  const series = next.recurrence_parent_id ?? completed.id;
  return tasks.some(
    (t) =>
      t.id !== completed.id &&
      (t.recurrence_parent_id ?? t.id) === series &&
      t.due_date === next.due_date,
  );
}

export function daysBetween(fromIso: string, toIsoDate: string): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIsoDate.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86400000);
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d));
  next.setUTCDate(next.getUTCDate() + days);
  return toIso(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
  );
}

/** Human summary for a chip: "Every 2 weeks". */
export function describeRecurrence(
  recurrence: TaskRecurrence | null | undefined,
  interval: number | null | undefined,
): string {
  if (!recurrence) return "";
  const n = interval ?? 1;
  const unit = { daily: "day", weekly: "week", monthly: "month" }[recurrence];
  return n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`;
}
