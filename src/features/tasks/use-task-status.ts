import { useCallback } from "react";
import { toast } from "sonner";
import type { Task } from "@/types";
import type { TaskStatus } from "./task-meta";
import { getErrorMessage } from "@/lib/utils";
import {
  useAddTaskMutation,
  useLazyGetTasksQuery,
  useUpdateTaskMutation,
} from "@/store/api/admin/tasksApi";
import { hasNextOccurrence, nextOccurrence } from "./task-recurrence";

/**
 * Change a task's status, scheduling the next one when a repeating task is
 * completed. Shared by the Tasks page and the dashboard, so ticking
 * a task off from either place does the same thing.
 *
 * `known` is the task list the caller already holds; without it the list is
 * read (from cache when fresh) only when a repeating task needs the check.
 */
export function useSetTaskStatus() {
  const [updateTask] = useUpdateTaskMutation();
  const [addTask] = useAddTaskMutation();
  const [loadTasks] = useLazyGetTasksQuery();

  return useCallback(
    async (
      task: Task,
      status: TaskStatus,
      known?: readonly Task[],
    ): Promise<boolean> => {
      try {
        await updateTask({ id: task.id, status }).unwrap();

        if (status === "done" && task.status !== "done" && task.recurrence) {
          const next = nextOccurrence(task);
          const tasks = next
            ? (known ?? (await loadTasks(undefined, true).unwrap()))
            : [];
          // Done, undone and done again: the next one already exists.
          if (next && !hasNextOccurrence(tasks, task, next)) {
            await addTask(next).unwrap();
            toast.success("Completed — next one scheduled", {
              description: `Due ${next.due_date}`,
            });
          }
        }
        return true;
      } catch (err) {
        toast.error("Couldn't update the task", {
          description: getErrorMessage(err),
        });
        return false;
      }
    },
    [updateTask, addTask, loadTasks],
  );
}
