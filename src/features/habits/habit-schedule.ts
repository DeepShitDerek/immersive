import type { Habit } from "@/types";

/**
 * When a habit is actually due.
 *
 * The old model stored `target_per_week` as a bare number with no notion of
 * *which* days, so nothing could answer "am I due today?" — and the streak
 * calculation counted every calendar day, meaning a Mon/Wed/Fri habit broke its
 * streak every Tuesday. Everything downstream (streaks, completion rate, the
 * today view) depends on this being right, so it lives in one place.
 */

/** ISO weekday, 1 = Monday … 7 = Sunday. */
function isoWeekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return day === 0 ? 7 : day;
}

/** Local calendar day as `YYYY-MM-DD`. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d));
  next.setUTCDate(next.getUTCDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/**
 * Is this habit due on the given date?
 *
 * `weekly_count` is deliberately due every day: "three times a week" does not
 * name the days, so any day is a legitimate opportunity. Its progress is judged
 * per week rather than per day — see `weeklyProgress`.
 */
export function isDueOn(
  habit: Pick<Habit, "schedule" | "schedule_days">,
  iso: string,
): boolean {
  const weekday = isoWeekday(iso);

  switch (habit.schedule ?? "daily") {
    case "weekdays":
      return weekday <= 5;
    case "weekends":
      return weekday >= 6;
    case "custom":
      // No days selected means due never. The database rejects that, but a row
      // written before the constraint existed would otherwise be due daily,
      // which is the opposite of what an empty selection means.
      return (habit.schedule_days ?? []).includes(weekday);
    case "weekly_count":
    case "daily":
    default:
      return true;
  }
}

/** Scheduled dates in `[fromIso, toIso]`, oldest first. */
export function scheduledDatesBetween(
  habit: Pick<Habit, "schedule" | "schedule_days">,
  fromIso: string,
  toIso: string,
): string[] {
  const dates: string[] = [];
  let cursor = fromIso;
  // Bounded so a reversed range cannot spin forever.
  for (let i = 0; i < 4000 && cursor <= toIso; i++) {
    if (isDueOn(habit, cursor)) dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

/** "Every day", "Mon, Wed, Fri", "3× per week". */
export function describeSchedule(
  habit: Pick<Habit, "schedule" | "schedule_days" | "target_per_week">,
): string {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  switch (habit.schedule ?? "daily") {
    case "weekdays":
      return "Weekdays";
    case "weekends":
      return "Weekends";
    case "weekly_count":
      return `${habit.target_per_week ?? 7}× per week`;
    case "custom": {
      const days = [...(habit.schedule_days ?? [])].sort((a, b) => a - b);
      if (days.length === 0) return "No days selected";
      if (days.length === 7) return "Every day";
      return days.map((d) => names[d - 1]).join(", ");
    }
    case "daily":
    default:
      return "Every day";
  }
}

/** The Monday that starts the week containing `iso`. */
export function startOfWeek(iso: string): string {
  return addDays(iso, -(isoWeekday(iso) - 1));
}
