"use client";

import { useState, type DragEvent } from "react";
import { Plus } from "lucide-react";
import type { Task, TaskProject } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { moveWithin } from "@/lib/reorder";
import { TASK_STATUSES, TASK_STATUS_META, type TaskStatus } from "./task-meta";
import { TaskCard } from "./task-card";

export interface TaskBoardProps {
  tasks: Task[];
  projectsById: Map<string, TaskProject>;
  blockersFor: (task: Task) => Task[];
  onOpenTask: (task: Task) => void;
  onChangeStatus: (task: Task, status: TaskStatus) => void;
  onStartTimer: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onNewTask: (status: TaskStatus) => void;
  /**
   * The column's full running order after a card was moved within it.
   *
   * The whole column, not just the pair that moved: the RPC numbers the ids it
   * receives, so anything omitted keeps a stale rank and the order comes apart
   * on the next read.
   */
  onReorder: (taskIds: string[]) => void;
}

/**
 * Status columns.
 *
 * One column per status in `TASK_STATUSES`, including empty ones — a column
 * that vanishes when it empties gives you nowhere to drop the first card.
 */
export function TaskBoard({
  tasks,
  projectsById,
  blockersFor,
  onOpenTask,
  onChangeStatus,
  onStartTimer,
  onDeleteTask,
  onNewTask,
  onReorder,
}: TaskBoardProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);
  /** The card the pointer is currently above, so the gap is visible. */
  const [overTaskId, setOverTaskId] = useState<string | null>(null);

  /**
   * A drop on the column background: a status change, or nothing.
   *
   * Dropping a card back on its own column with no card under the pointer
   * means "put it last", which is a reorder rather than a no-op.
   */
  const handleDrop = (status: TaskStatus) => {
    setOverStatus(null);
    setOverTaskId(null);
    const task = tasks.find((t) => t.id === draggedId);
    setDraggedId(null);
    if (!task) return;

    if ((task.status ?? "todo") !== status) {
      onChangeStatus(task, status);
      return;
    }

    reorderWithin(status, task.id, null);
  };

  /** Reorder within one column, then persist the column's whole new order. */
  const reorderWithin = (
    status: TaskStatus,
    movedId: string,
    beforeId: string | null,
  ) => {
    const column = tasks
      .filter((t) => (t.status ?? "todo") === status)
      .map((t) => t.id);

    const next = moveWithin(column, movedId, beforeId);
    // null means the card was dropped where it already was.
    if (next) onReorder(next);
  };

  const allowDrop = (e: DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setOverStatus(status);
  };

  return (
    // One row of columns, always. A 2-up grid below xl put "In review" and
    // "Done" under the first two; where four don't fit, the board scrolls
    // sideways and snaps column by column, as kanban boards do. Focusable so
    // the keyboard can scroll it even when no column holds a card.
    <div
      role="region"
      aria-label="Task board"
      tabIndex={0}
      className="-mx-1 flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-1 pb-3 focus-ring"
    >
      {TASK_STATUSES.map((status) => {
        const meta = TASK_STATUS_META[status];
        const columnTasks = tasks.filter(
          (t) => (t.status ?? "todo") === status,
        );

        return (
          <section
            key={status}
            aria-label={meta.label}
            onDragOver={(e) => allowDrop(e, status)}
            onDragLeave={() => setOverStatus(null)}
            onDrop={() => handleDrop(status)}
            className={cn(
              "flex w-[85vw] max-w-[20rem] shrink-0 snap-start flex-col gap-2 rounded-surface bg-secondary/30 p-2 transition-colors sm:w-auto sm:min-w-[15rem] sm:max-w-none sm:flex-1",
              overStatus === status && "bg-primary/10 ring-2 ring-primary/40",
            )}
          >
            <header className="flex items-center justify-between px-1 py-1">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <span
                  aria-hidden
                  className={cn("size-2 rounded-full", meta.dot)}
                />
                {meta.label}
                <span className="text-xs tabular-nums text-muted-foreground">
                  {columnTasks.length}
                </span>
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`New task in ${meta.label}`}
                onClick={() => onNewTask(status)}
              >
                <Plus className="size-4" aria-hidden />
              </Button>
            </header>

            {columnTasks.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                Nothing here
              </p>
            ) : (
              columnTasks.map((task, index) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onMoveUp={
                    index > 0
                      ? () =>
                          reorderWithin(
                            status,
                            task.id,
                            columnTasks[index - 1].id,
                          )
                      : undefined
                  }
                  onMoveDown={
                    index < columnTasks.length - 1
                      ? () =>
                          reorderWithin(
                            status,
                            task.id,
                            columnTasks[index + 2]?.id ?? null,
                          )
                      : undefined
                  }
                  project={
                    task.project_id
                      ? projectsById.get(task.project_id)
                      : undefined
                  }
                  blockers={blockersFor(task)}
                  onOpen={() => onOpenTask(task)}
                  onChangeStatus={(status) => onChangeStatus(task, status)}
                  onStartTimer={() => onStartTimer(task)}
                  onDelete={() => onDeleteTask(task)}
                  draggable
                  onDragStart={() => setDraggedId(task.id)}
                  onDragOver={(event) => {
                    // Claimed here so the column's own handler does not treat
                    // a drop on a card as a drop on the background.
                    event.preventDefault();
                    event.stopPropagation();
                    setOverStatus(status);
                    if (task.id !== draggedId) setOverTaskId(task.id);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const moved = tasks.find((t) => t.id === draggedId);
                    setOverStatus(null);
                    setOverTaskId(null);
                    setDraggedId(null);
                    if (!moved || moved.id === task.id) return;

                    // Across columns this is still a status change; the drop
                    // position only means something within one column.
                    if ((moved.status ?? "todo") !== status) {
                      onChangeStatus(moved, status);
                      return;
                    }
                    reorderWithin(status, moved.id, task.id);
                  }}
                  className={cn(
                    draggedId === task.id && "opacity-50",
                    // A line where the card would land, rather than moving the
                    // others out of the way — cheaper, and it does not make the
                    // column jump under the pointer.
                    overTaskId === task.id &&
                      draggedId !== null &&
                      "border-t-2 border-t-primary",
                  )}
                />
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}
