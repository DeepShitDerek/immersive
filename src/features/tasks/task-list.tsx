"use client";

import { CircleSlash } from "lucide-react";
import type { Task, TaskProject } from "@/types";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";
import { TASK_PRIORITY_META, type TaskPriority } from "./task-meta";
import { formatMinutes } from "./task-card";
import { describeRecurrence } from "./task-recurrence";
import { type TaskGroup } from "./task-filters";
import { TaskDue } from "./task-due";

export interface TaskListProps {
  groups: TaskGroup[];
  projectsById: Map<string, TaskProject>;
  blockersFor: (task: Task) => Task[];
  onOpenTask: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
}

/**
 * The list view.
 *
 * Distinct from the table on purpose: the table is for comparing tasks across
 * fixed columns, this is for working down a list. Every row carries a checkbox,
 * so the common operation — finishing something — takes one click and never
 * opens a panel.
 */
export function TaskList({
  groups,
  projectsById,
  blockersFor,
  onOpenTask,
  onToggleComplete,
}: TaskListProps) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label}>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
            <span className="tabular-nums">{group.tasks.length}</span>
          </h3>

          {group.tasks.length === 0 ? (
            <p className="rounded-surface bg-secondary/30 px-3 py-4 text-center text-xs text-muted-foreground">
              Nothing here
            </p>
          ) : (
            <ul className="overflow-hidden rounded-surface bg-card shadow-e1">
              {group.tasks.map((task) => {
                const priority = (task.priority ?? "medium") as TaskPriority;
                const project = task.project_id
                  ? projectsById.get(task.project_id)
                  : undefined;
                const blockers = blockersFor(task);
                const done = task.status === "done";
                const subtasks = task.sub_tasks ?? [];
                const repeat = describeRecurrence(
                  task.recurrence,
                  task.recurrence_interval,
                );

                return (
                  <li
                    key={task.id}
                    className={cn(
                      "flex items-start gap-3 border-b border-l-2 px-3 py-2.5 last:border-b-0 hover:bg-secondary/40",
                      TASK_PRIORITY_META[priority].edge,
                    )}
                  >
                    <Checkbox
                      checked={done}
                      onCheckedChange={() => onToggleComplete(task)}
                      aria-label={
                        done ? `Reopen ${task.title}` : `Complete ${task.title}`
                      }
                      className="mt-0.5 shrink-0"
                    />

                    <button
                      type="button"
                      onClick={() => onOpenTask(task)}
                      className="min-w-0 flex-1 text-left focus-ring"
                    >
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {blockers.length > 0 && (
                          <CircleSlash
                            aria-hidden
                            className="size-3.5 shrink-0 text-destructive"
                          />
                        )}
                        <span
                          className={cn(
                            "min-w-0 break-words text-sm font-medium",
                            done && "text-muted-foreground line-through",
                          )}
                        >
                          {task.title}
                        </span>
                        {project && (
                          <span className="inline-flex shrink-0 items-center gap-1 text-micro text-muted-foreground">
                            <span
                              aria-hidden
                              className="size-2 rounded-full"
                              style={{
                                backgroundColor:
                                  project.color ?? "hsl(var(--primary))",
                              }}
                            />
                            {project.name}
                          </span>
                        )}
                      </span>

                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-muted-foreground">
                        {blockers.length > 0 && (
                          <span className="text-destructive">
                            Blocked by {blockers.length}
                          </span>
                        )}
                        <TaskDue task={task} icon={false} />
                        {subtasks.length > 0 && (
                          <span>
                            {subtasks.filter((s) => s.is_completed).length}/
                            {subtasks.length} subtasks
                          </span>
                        )}
                        {formatMinutes(task.tracked_minutes) && (
                          <span>{formatMinutes(task.tracked_minutes)}</span>
                        )}
                        {repeat && <span>{repeat}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
