"use client";

import { useMemo } from "react";
import { CalendarPlus, ListTodo } from "lucide-react";
import type { Task } from "@/types";
import { cn } from "@/lib/cn";

/**
 * Unscheduled tasks, ready to be dragged onto the grid.
 *
 * Morgen's idea, and the one this app is best placed to copy: the tasks
 * already exist, already carry an estimate and a due date, and were previously
 * only ever *shown* on the calendar at a fabricated 09:00. Dragging one in
 * turns it into a real block of time you have actually set aside.
 *
 * "Unscheduled" means no block exists for it yet, not that it has no due date.
 * A due date says when something must be finished; a block says when you will
 * do it, and confusing the two is why task lists and calendars usually fail to
 * talk to each other.
 */
export function TaskRail({
  tasks,
  scheduledTaskIds,
  onSchedule,
  className,
}: {
  tasks: Task[];
  /** Task ids that already have a block on the calendar. */
  scheduledTaskIds: ReadonlySet<string>;
  /**
   * Block time for a task without dragging (WCAG 2.1.1 and 2.5.7):
   * the drag is a mouse-only gesture, so every card also has a button.
   */
  onSchedule: (taskId: string) => void;
  className?: string;
}) {
  const unscheduled = useMemo(
    () =>
      tasks
        .filter(
          (task) => task.status !== "done" && !scheduledTaskIds.has(task.id),
        )
        // Soonest due first; undated tasks last, because a task with a date is
        // the one with a reason to be scheduled now.
        .sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        })
        .slice(0, 25),
    [tasks, scheduledTaskIds],
  );

  return (
    <section
      className={cn("space-y-2", className)}
      aria-label="Unscheduled tasks"
    >
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ListTodo className="size-4 text-muted-foreground" aria-hidden />
          To schedule
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Drag one onto the grid, or use its + button, to block time for it.
        </p>
      </div>

      {unscheduled.length === 0 ? (
        <p className="rounded-surface border bg-card p-3 text-xs text-muted-foreground">
          Nothing waiting. Every open task already has time set aside.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {unscheduled.map((task) => (
            <li key={task.id}>
              <div
                draggable
                /*
                  Read by FullCalendar's external `drop`: the browser's own
                  drag payload is not available there, so the id travels on the
                  element itself.
                */
                data-task-id={task.id}
                onDragStart={(event) => {
                  event.dataTransfer.setData("application/x-task-id", task.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                className="group cursor-grab rounded-surface border bg-card p-2.5 transition-colors hover:border-input active:cursor-grabbing"
              >
                <p className="flex items-start gap-2 text-xs font-medium text-foreground">
                  <span className="min-w-0 flex-1 break-words">
                    {task.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSchedule(task.id)}
                    aria-label={`Block time for “${task.title}” at the next half hour`}
                    title="Block time at the next half hour"
                    className="-m-1 inline-flex size-6 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-ring"
                  >
                    <CalendarPlus className="size-3.5" aria-hidden />
                  </button>
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 pl-5 text-micro text-muted-foreground">
                  {task.estimate_minutes ? (
                    <span>{formatEstimate(task.estimate_minutes)}</span>
                  ) : (
                    <span className="italic">no estimate</span>
                  )}
                  {task.due_date && <span>· due {task.due_date.slice(5)}</span>}
                  {task.priority === "high" && (
                    <span className="text-warning">· high</span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatEstimate(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
