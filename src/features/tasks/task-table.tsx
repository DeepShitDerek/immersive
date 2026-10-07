"use client";

import { CircleSlash } from "lucide-react";
import type { Task, TaskProject } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import {
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  type TaskPriority,
  type TaskStatus,
} from "./task-meta";
import { formatMinutes } from "./task-card";
import { type TaskGroup } from "./task-filters";
import { TaskDue } from "./task-due";

export interface TaskTableProps {
  groups: TaskGroup[];
  projectsById: Map<string, TaskProject>;
  blockersFor: (task: Task) => Task[];
  onOpenTask: (task: Task) => void;
}

/**
 * Dense rows, grouped.
 *
 * The table scrolls inside its own container rather than the page, because a
 * table is the one place where a horizontal scrollbar is correct — the columns
 * have a minimum readable width and wrapping them destroys the alignment that
 * makes a table worth using.
 */
export function TaskTable({
  groups,
  projectsById,
  blockersFor,
  onOpenTask,
}: TaskTableProps) {
  return (
    <div className="overflow-x-auto rounded-surface bg-card shadow-e1">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="px-3 py-2 font-medium">
              Task
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Status
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Priority
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Project
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Due
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Time
            </th>
          </tr>
        </thead>

        {groups.map((group) => (
          <tbody key={group.key}>
            <tr>
              <th
                scope="colgroup"
                colSpan={6}
                className="bg-secondary/40 px-3 py-1.5 text-left text-xs font-medium text-muted-foreground"
              >
                {group.label}
                <span className="ml-2 tabular-nums">{group.tasks.length}</span>
              </th>
            </tr>

            {group.tasks.map((task) => {
              const status = (task.status ?? "todo") as TaskStatus;
              const priority = (task.priority ?? "medium") as TaskPriority;
              const project = task.project_id
                ? projectsById.get(task.project_id)
                : undefined;
              const blockers = blockersFor(task);

              return (
                <tr
                  key={task.id}
                  onClick={() => onOpenTask(task)}
                  className="cursor-pointer border-b last:border-0 hover:bg-secondary/40"
                >
                  <td className="max-w-[22rem] px-3 py-2">
                    <span className="flex items-center gap-2">
                      {blockers.length > 0 && (
                        <span title={`Blocked by ${blockers.length}`}>
                          <CircleSlash
                            aria-hidden
                            className="size-3.5 shrink-0 text-destructive"
                          />
                          <span className="sr-only">
                            Blocked by {blockers.length} task(s)
                          </span>
                        </span>
                      )}
                      <span
                        className={cn(
                          "min-w-0 break-words",
                          task.status === "done" &&
                            "text-muted-foreground line-through",
                        )}
                      >
                        {task.title}
                      </span>
                    </span>
                  </td>

                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 px-1.5 text-micro",
                        TASK_STATUS_META[status].pill,
                      )}
                    >
                      {TASK_STATUS_META[status].label}
                    </Badge>
                  </td>

                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 px-1.5 text-micro",
                        TASK_PRIORITY_META[priority].pill,
                      )}
                    >
                      {TASK_PRIORITY_META[priority].label}
                    </Badge>
                  </td>

                  <td className="max-w-[10rem] truncate px-3 py-2 text-muted-foreground">
                    {project?.name ?? "—"}
                  </td>

                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {task.due_date ? <TaskDue task={task} icon={false} /> : "—"}
                  </td>

                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatMinutes(task.tracked_minutes) || "—"}
                    {task.estimate_minutes
                      ? ` / ${formatMinutes(task.estimate_minutes)}`
                      : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
