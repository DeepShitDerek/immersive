import type { Task, TaskProject } from "@/types";
import type { DependencyIndex } from "./task-dependencies";
import { isBlocked } from "./task-dependencies";
import { TASK_STATUSES, type TaskPriority, type TaskStatus } from "./task-meta";

export type TaskGroupBy = "status" | "priority" | "project" | "due";
export type TaskSortBy = "manual" | "due" | "priority" | "created" | "title";

export interface TaskFilters {
  search: string;
  projectId: string | "all" | "none";
  status: TaskStatus | "all";
  priority: TaskPriority | "all";
  tag: string | "all";
  /** Only tasks waiting on an unfinished blocker. */
  blockedOnly: boolean;
  /** Only tasks past their due date and not yet done. */
  overdueOnly: boolean;
  /**
   * Completed tasks are shown by default, so the board's Done column is a
   * column and a card dragged into it does not vanish. The toolbar toggle
   * hides them once the list has grown long.
   */
  showDone: boolean;
}

export const DEFAULT_FILTERS: TaskFilters = {
  search: "",
  projectId: "all",
  status: "all",
  priority: "all",
  tag: "all",
  blockedOnly: false,
  overdueOnly: false,
  showDone: true,
};

const PRIORITY_RANK: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** Local calendar day as `YYYY-MM-DD`, for comparing against DATE columns. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Overdue means the due date has passed and the work is not finished.
 *
 * Compared as `YYYY-MM-DD` strings rather than Date objects: `due_date` is a
 * DATE column with no time or zone, and turning it into a Date makes it
 * midnight UTC, which reads as "yesterday" for anyone west of Greenwich.
 */
export function isOverdue(task: Task, today = todayIso()): boolean {
  if (!task.due_date || task.status === "done") return false;
  return task.due_date < today;
}

export function isDueToday(task: Task, today = todayIso()): boolean {
  return !!task.due_date && task.due_date === today && task.status !== "done";
}

export function filterTasks(
  tasks: Task[],
  filters: TaskFilters,
  index: DependencyIndex,
  byId: Map<string, Task>,
  today = todayIso(),
): Task[] {
  const term = filters.search.trim().toLowerCase();

  return tasks.filter((task) => {
    if (!filters.showDone && task.status === "done") return false;
    if (filters.status !== "all" && task.status !== filters.status)
      return false;
    if (filters.priority !== "all" && task.priority !== filters.priority)
      return false;

    if (filters.projectId === "none") {
      if (task.project_id) return false;
    } else if (filters.projectId !== "all") {
      if (task.project_id !== filters.projectId) return false;
    }

    if (filters.tag !== "all" && !(task.tags ?? []).includes(filters.tag))
      return false;

    if (filters.blockedOnly && !isBlocked(task.id, index, byId)) return false;
    if (filters.overdueOnly && !isOverdue(task, today)) return false;

    if (term) {
      const haystack = [task.title, task.description, ...(task.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }

    return true;
  });
}

export function sortTasks(tasks: Task[], sortBy: TaskSortBy): Task[] {
  const sorted = [...tasks];

  switch (sortBy) {
    case "due":
      // Undated tasks sort last rather than first — an absent due date is
      // "whenever", not "immediately", which is what an empty string would
      // make it under a plain string compare.
      return sorted.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    case "priority":
      return sorted.sort(
        (a, b) =>
          PRIORITY_RANK[(a.priority ?? "medium") as TaskPriority] -
          PRIORITY_RANK[(b.priority ?? "medium") as TaskPriority],
      );
    case "created":
      return sorted.sort((a, b) =>
        (b.created_at ?? "").localeCompare(a.created_at ?? ""),
      );
    case "title":
      return sorted.sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
      );
    case "manual":
    default:
      return sorted.sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
      );
  }
}

export interface TaskGroup {
  key: string;
  label: string;
  tasks: Task[];
}

/**
 * Group tasks for the list and table views.
 *
 * Empty status groups are kept so the board and list agree on what states
 * exist; every other grouping only emits groups that have something in them.
 */
export function groupTasks(
  tasks: Task[],
  groupBy: TaskGroupBy,
  projects: TaskProject[],
  statusLabel: (status: TaskStatus) => string,
  today = todayIso(),
): TaskGroup[] {
  if (groupBy === "status") {
    return TASK_STATUSES.map((status) => ({
      key: status,
      label: statusLabel(status),
      tasks: tasks.filter((t) => (t.status ?? "todo") === status),
    }));
  }

  if (groupBy === "priority") {
    return (["high", "medium", "low"] as TaskPriority[])
      .map((priority) => ({
        key: priority,
        label: `${priority[0].toUpperCase()}${priority.slice(1)} priority`,
        tasks: tasks.filter((t) => (t.priority ?? "medium") === priority),
      }))
      .filter((group) => group.tasks.length > 0);
  }

  if (groupBy === "project") {
    const groups: TaskGroup[] = projects.map((project) => ({
      key: project.id,
      label: project.name,
      tasks: tasks.filter((t) => t.project_id === project.id),
    }));
    groups.push({
      key: "none",
      label: "No project",
      tasks: tasks.filter((t) => !t.project_id),
    });
    return groups.filter((group) => group.tasks.length > 0);
  }

  // Due-date buckets, in the order they demand attention.
  const buckets: TaskGroup[] = [
    { key: "overdue", label: "Overdue", tasks: [] },
    { key: "today", label: "Today", tasks: [] },
    { key: "upcoming", label: "Upcoming", tasks: [] },
    { key: "none", label: "No due date", tasks: [] },
  ];

  for (const task of tasks) {
    if (!task.due_date) buckets[3].tasks.push(task);
    else if (isOverdue(task, today)) buckets[0].tasks.push(task);
    else if (task.due_date === today) buckets[1].tasks.push(task);
    else buckets[2].tasks.push(task);
  }

  return buckets.filter((group) => group.tasks.length > 0);
}

/** Every tag in use, for the tag filter. */
export function collectTags(tasks: Task[]): string[] {
  const tags = new Set<string>();
  for (const task of tasks) {
    for (const tag of task.tags ?? []) tags.add(tag);
  }
  return Array.from(tags).sort();
}
