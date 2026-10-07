import type { DashboardData } from "@/types";
import { isDueOn, todayIso } from "@/features/habits/habit-schedule";
import { indexLogs, isSatisfiedOn } from "@/features/habits/habit-progress";

/**
 * The day as one continuous thing, rather than a grid of modules.
 *
 * Every dashboard I replaced here was a set of panels — one per module, each
 * answering "how is Tasks", "how is Finance". But nobody opens their own tools
 * asking about a module. They ask *what is my day*, and the answer is a shape
 * in time: what has gone, what is happening now, what is still ahead.
 *
 * So the hero is a spine. Hours run down it, the current moment is a line
 * across it, and everything the app knows about today is docked at the hour it
 * belongs to. Events have real times. Habits have a time of day. Tasks due
 * today have neither, so they sit in a dock rather than being invented a slot
 * — a task pinned to 09:00 because something had to go somewhere is the exact
 * lie the old calendar told.
 *
 * All of it is pure. The interesting parts are arithmetic — which hours to
 * show, where an event sits, what counts as "next" — and arithmetic is
 * testable in a way that a positioned div is not.
 */

/**
 * The hours the spine draws.
 *
 * It starts an hour *before* now rather than at the top of the working day,
 * because the morning is not useful at four in the afternoon — the spine
 * should be mostly the part you can still do something about. Before the day
 * starts it shows the whole day, which is the one time the morning matters.
 */
export function spineHours(
  now: Date,
  startHour: number,
  endHour: number,
): number[] {
  const current = now.getHours();
  const from = Math.max(startHour, Math.min(current - 1, endHour - 1));
  const first = current < startHour ? startHour : from;

  const hours: number[] = [];
  for (let hour = first; hour < Math.max(endHour, first + 1); hour += 1) {
    hours.push(hour);
  }
  return hours;
}

export interface PlacedItem {
  id: string;
  title: string;
  /** Fraction down the spine, 0–1. */
  top: number;
  /** Fraction of the spine's height. */
  height: number;
  detail?: string;
  isPast: boolean;
  isNow: boolean;
}

/** Where "now" sits on the spine, 0–1, or null when it is outside it. */
export function nowOffset(now: Date, hours: number[]): number | null {
  if (hours.length === 0) return null;

  const first = hours[0];
  const span = hours.length;
  const position = now.getHours() + now.getMinutes() / 60 - first;

  if (position < 0 || position > span) return null;
  return position / span;
}

/**
 * Place today's events on the spine.
 *
 * An event that started before the spine begins is clipped to the top rather
 * than dropped: a meeting running since nine is still happening at ten, and
 * hiding it because it started off-screen would be worse than showing it
 * short.
 */
export function placeEvents(
  events: DashboardData["todaysEvents"],
  hours: number[],
  now = new Date(),
): PlacedItem[] {
  if (hours.length === 0) return [];

  const first = hours[0];
  const span = hours.length;

  return events
    .filter((event) => !event.is_all_day)
    .map((event): PlacedItem | null => {
      const start = new Date(event.start_time);
      // A missing end is an hour, the same default the calendar grid uses.
      const end = event.end_time
        ? new Date(event.end_time)
        : new Date(start.getTime() + 60 * 60_000);

      const startAt = start.getHours() + start.getMinutes() / 60 - first;
      const endAt = end.getHours() + end.getMinutes() / 60 - first;

      // Entirely before or after the spine.
      if (endAt <= 0 || startAt >= span) return null;

      const top = Math.max(startAt, 0) / span;
      const bottom = Math.min(endAt, span) / span;

      return {
        id: event.id,
        title: event.title,
        top,
        // A floor, or a fifteen-minute event renders as a hairline.
        height: Math.max(bottom - top, 0.04),
        detail: formatTime(start),
        isPast: end <= now,
        isNow: start <= now && end > now,
      };
    })
    .filter((item): item is PlacedItem => item !== null);
}

function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export interface NextUp {
  title: string;
  at: string;
  minutesAway: number;
  happening: boolean;
}

/**
 * The single most useful sentence on the page: what is next, and when.
 *
 * Something in progress outranks something upcoming — you are already late to
 * the first and merely early for the second.
 */
export function nextUp(
  events: DashboardData["todaysEvents"],
  now = new Date(),
): NextUp | null {
  const timed = events
    .filter((event) => !event.is_all_day)
    .map((event) => ({
      event,
      start: new Date(event.start_time),
      end: event.end_time
        ? new Date(event.end_time)
        : new Date(new Date(event.start_time).getTime() + 60 * 60_000),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const running = timed.find((entry) => entry.start <= now && entry.end > now);
  if (running) {
    return {
      title: running.event.title,
      at: formatTime(running.start),
      minutesAway: 0,
      happening: true,
    };
  }

  const upcoming = timed.find((entry) => entry.start > now);
  if (!upcoming) return null;

  return {
    title: upcoming.event.title,
    at: formatTime(upcoming.start),
    minutesAway: Math.round(
      (upcoming.start.getTime() - now.getTime()) / 60_000,
    ),
    happening: false,
  };
}

/** `95` → `1h 35m`. Minutes alone stop being readable somewhere past ninety. */
export function untilLabel(minutes: number): string {
  if (minutes < 1) return "now";
  if (minutes < 60) return `in ${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `in ${hours}h` : `in ${hours}h ${rest}m`;
}

export interface Pulse {
  percent: number;
  segments: { label: string; done: number; total: number }[];
}

/**
 * One figure for "how much of today have I actually done".
 *
 * Composite rather than three separate percentages, because the question is
 * about the day and not about a module. The segments are kept alongside it so
 * the number can always be taken apart — a score you cannot interrogate is a
 * score nobody believes twice.
 *
 * A day with nothing due is complete. Showing 0% for a rest day would be a
 * failing grade for doing exactly what was asked.
 */
export function dayPulse(data: DashboardData, now = new Date()): Pulse {
  const today = todayIso(now);
  const active = data.habits.filter((habit) => !habit.archived_at);

  let habitsDue = 0;
  let habitsDone = 0;
  for (const habit of active) {
    if (!isDueOn(habit, today)) continue;
    habitsDue += 1;
    if (isSatisfiedOn(habit, indexLogs(habit), today)) habitsDone += 1;
  }

  // Tasks: today's include the finished ones, so ticking one off moves the
  // ring. Overdue counts against the day too — it is work that was
  // owed before it — and leaves the list once done.
  const tasksDone = data.tasksDueToday.filter(
    (task) => task.status === "done",
  ).length;
  const tasksTotal = data.tasksDueToday.length + data.overdueTasks.length;

  const segments = [
    { label: "Habits", done: habitsDone, total: habitsDue },
    { label: "Tasks", done: tasksDone, total: tasksTotal },
  ].filter((segment) => segment.total > 0);

  const total = segments.reduce((sum, segment) => sum + segment.total, 0);
  const done = segments.reduce((sum, segment) => sum + segment.done, 0);

  return { percent: total === 0 ? 100 : (done / total) * 100, segments };
}

/**
 * The next few hours of the working day, for the timeline when it is not
 * showing the whole day: from the current hour (or the start of the day,
 * before it begins), `span` hours long, kept inside [startHour, endHour).
 * After the day ends it shows the last `span` hours, so it is never empty.
 */
export function windowHours(
  now: Date,
  startHour: number,
  endHour: number,
  span: number,
): number[] {
  const last = Math.max(startHour + 1, endHour);
  const from = Math.min(
    Math.max(now.getHours(), startHour),
    Math.max(startHour, last - span),
  );
  const to = Math.min(last, from + span);
  return Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);
}
