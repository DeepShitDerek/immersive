"use client";

import { useMemo } from "react";
import type { Task, TaskProject } from "@/types";
import { cn } from "@/lib/cn";
import { type TaskPriority } from "./task-meta";
import { formatDueDate } from "./task-card";
import { isOverdue } from "./task-filters";
import {
  barPosition,
  monthTicks,
  schedulableTasks,
  timelineRange,
  todayMarker,
} from "./task-timeline";

export interface TaskTimelineViewProps {
  tasks: Task[];
  projectsById: Map<string, TaskProject>;
  onOpenTask: (task: Task) => void;
}

const BAR_TONE: Record<TaskPriority, string> = {
  high: "bg-destructive/70",
  medium: "bg-chart-3/70",
  low: "bg-muted-foreground/50",
};

/**
 * Read-only Gantt.
 *
 * Bars are positioned as percentages of the date range, so the chart reflows
 * with the container instead of needing a fixed pixel scale. Dragging to
 * reschedule is deliberately not here — it needs pointer capture and a
 * day-snapping model, and a wrong drag silently moves a deadline.
 */
export function TaskTimelineView({
  tasks,
  projectsById,
  onOpenTask,
}: TaskTimelineViewProps) {
  const placeable = useMemo(() => schedulableTasks(tasks), [tasks]);
  const range = useMemo(() => timelineRange(placeable), [placeable]);
  const ticks = useMemo(() => monthTicks(range), [range]);
  const marker = useMemo(() => todayMarker(range), [range]);

  const undated = tasks.length - placeable.length;

  if (placeable.length === 0) {
    return (
      <p className="rounded-surface bg-card px-6 py-12 text-center text-sm text-muted-foreground shadow-e1">
        Nothing to place on a timeline yet — a task needs a due date to appear
        here.
      </p>
    );
  }

  return (
    <div className="rounded-surface bg-card p-4 shadow-e1">
      <div className="overflow-x-auto">
        <div className="min-w-[40rem]">
          {/* Month scale */}
          <div className="relative mb-2 h-5 border-b">
            {ticks.map((tick) => (
              <span
                key={tick.label}
                className="absolute top-0 text-micro text-muted-foreground"
                style={{ left: `${tick.left}%` }}
              >
                {tick.label}
              </span>
            ))}
          </div>

          <div className="relative">
            {marker !== null && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 z-raised w-px bg-primary"
                style={{ left: `${marker}%` }}
              />
            )}

            <ul className="space-y-1.5">
              {placeable.map((task) => {
                const bar = barPosition(task, range);
                if (!bar) return null;
                const priority = (task.priority ?? "medium") as TaskPriority;
                const project = task.project_id
                  ? projectsById.get(task.project_id)
                  : undefined;
                const overdue = isOverdue(task);

                return (
                  <li key={task.id} className="relative h-8">
                    <button
                      type="button"
                      onClick={() => onOpenTask(task)}
                      title={`${task.title}${task.due_date ? ` — due ${formatDueDate(task.due_date)}` : ""}`}
                      style={{
                        left: `${bar.left}%`,
                        width: `${bar.width}%`,
                        backgroundColor: project?.color ?? undefined,
                      }}
                      className={cn(
                        "absolute inset-y-0 flex min-w-0 items-center rounded-control px-2 text-left text-micro text-foreground transition-opacity hover:opacity-80 focus-ring",
                        !project?.color && BAR_TONE[priority],
                        task.status === "done" && "opacity-50",
                        overdue && "ring-1 ring-destructive",
                      )}
                    >
                      <span className="truncate">{task.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      {undated > 0 && (
        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          {undated} task{undated === 1 ? "" : "s"} not shown — no due date.
        </p>
      )}
    </div>
  );
}
