import type { TaskProject } from "@/types";
import type { TaskPriority } from "./task-meta";

/**
 * Quick add's small grammar: a task
 * is typed as one line, and three kinds of word set its fields.
 *
 *  - **When:** `today`, `tomorrow`, or a weekday (`fri`, `friday`) for the
 *    next one after today (Saturday and Sunday by full name only). A whole word only, so "Today's standup notes"
 *    keeps its title.
 *  - **`#word`:** the project of that name (case and spaces ignored, a
 *    prefix is enough when only one project starts with it); any other
 *    `#word` becomes a tag.
 *  - **`!high` / `!med` / `!low`** (or `!h`, `!m`, `!l`): the priority.
 *
 * Everything else is the title. Pure, so it is tested without a browser.
 */
export interface QuickAddResult {
  title: string;
  dueDate: string | null;
  projectId: string | null;
  priority: TaskPriority | null;
  tags: string[];
  /** What was understood, for the hint under the field. */
  understood: string[];
}

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const PRIORITIES: Record<string, TaskPriority> = {
  high: "high",
  h: "high",
  medium: "medium",
  med: "medium",
  m: "medium",
  low: "low",
  l: "low",
};

const norm = (value: string) => value.toLowerCase().replace(/[\s_-]+/g, "");

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * A weekday from its full name or a short form, else -1. Saturday and Sunday
 * need the full name: "sat" and "sun" are ordinary words ("buy sun cream").
 */
const SHORT_DAYS: Record<string, number> = {
  mon: 1,
  tue: 2,
  tues: 2,
  wed: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  fri: 5,
};
function weekdayOf(word: string): number {
  return SHORT_DAYS[word] ?? WEEKDAYS.indexOf(word);
}

const label = (iso: string, today: string) =>
  iso === today
    ? "Due today"
    : iso === addDays(today, 1)
      ? "Due tomorrow"
      : `Due ${new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}`;

export function parseQuickAdd(
  input: string,
  projects: Pick<TaskProject, "id" | "name">[],
  today: string,
): QuickAddResult {
  let dueDate: string | null = null;
  let projectId: string | null = null;
  let priority: TaskPriority | null = null;
  const tags: string[] = [];
  const understood: string[] = [];
  const kept: string[] = [];

  for (const word of input.trim().split(/\s+/).filter(Boolean)) {
    const lower = word.toLowerCase();

    if (!dueDate && (lower === "today" || lower === "tomorrow")) {
      dueDate = lower === "today" ? today : addDays(today, 1);
      continue;
    }

    const day = dueDate ? -1 : weekdayOf(lower);
    if (day >= 0) {
      const current = new Date(`${today}T00:00:00Z`).getUTCDay();
      dueDate = addDays(today, (day - current + 7) % 7 || 7);
      continue;
    }

    if (word.startsWith("!") && PRIORITIES[lower.slice(1)] && !priority) {
      priority = PRIORITIES[lower.slice(1)];
      understood.push(
        `${priority[0].toUpperCase()}${priority.slice(1)} priority`,
      );
      continue;
    }

    if (word.length > 1 && word.startsWith("#")) {
      const wanted = norm(word.slice(1));
      const exact = projects.find((project) => norm(project.name) === wanted);
      const prefixed = projects.filter((project) =>
        norm(project.name).startsWith(wanted),
      );
      const project =
        exact ?? (prefixed.length === 1 ? prefixed[0] : undefined);
      if (project && !projectId) {
        projectId = project.id;
        understood.push(`Project: ${project.name}`);
      } else {
        const tag = word.slice(1);
        if (!tags.includes(tag)) tags.push(tag);
      }
      continue;
    }

    kept.push(word);
  }

  if (dueDate) understood.unshift(label(dueDate, today));
  if (tags.length)
    understood.push(`Tag${tags.length === 1 ? "" : "s"}: ${tags.join(", ")}`);

  return {
    title: kept.join(" "),
    dueDate,
    projectId,
    priority,
    tags,
    understood,
  };
}
