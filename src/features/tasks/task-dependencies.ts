import type { Task, TaskDependency } from "@/types";

/**
 * Dependency reasoning for the task board.
 *
 * "Blocked" is derived here rather than stored as a fourth status. A stored
 * flag would be a second copy of a fact the dependency graph already holds, and
 * the two drift the moment a blocker is completed by any path that forgets to
 * clear it — drag-to-column, a bulk status change, the focus timer.
 */

export interface DependencyIndex {
  /** task id → ids of the tasks it is waiting on. */
  blockedBy: Map<string, string[]>;
  /** task id → ids of the tasks waiting on it. */
  blocks: Map<string, string[]>;
}

export function indexDependencies(
  dependencies: TaskDependency[],
): DependencyIndex {
  const blockedBy = new Map<string, string[]>();
  const blocks = new Map<string, string[]>();

  for (const dep of dependencies) {
    blockedBy.set(dep.task_id, [
      ...(blockedBy.get(dep.task_id) ?? []),
      dep.depends_on_id,
    ]);
    blocks.set(dep.depends_on_id, [
      ...(blocks.get(dep.depends_on_id) ?? []),
      dep.task_id,
    ]);
  }

  return { blockedBy, blocks };
}

/**
 * The blockers of `taskId` that are not yet done.
 *
 * A blocker that has been deleted leaves a dangling id — `ON DELETE CASCADE`
 * removes the edge, but a cached list can still be a moment behind, so an
 * unknown id is treated as resolved rather than blocking the task forever.
 */
export function unmetBlockers(
  taskId: string,
  index: DependencyIndex,
  byId: Map<string, Task>,
): Task[] {
  const blockers = index.blockedBy.get(taskId) ?? [];
  return blockers
    .map((id) => byId.get(id))
    .filter((task): task is Task => !!task && task.status !== "done");
}

export function isBlocked(
  taskId: string,
  index: DependencyIndex,
  byId: Map<string, Task>,
): boolean {
  return unmetBlockers(taskId, index, byId).length > 0;
}

/** Index tasks by id — every dependency lookup needs this. */
export function indexTasks(tasks: Task[]): Map<string, Task> {
  return new Map(tasks.map((task) => [task.id, task]));
}

/**
 * Would making `taskId` depend on `dependsOnId` close a loop?
 *
 * The database rejects cycles too (`reject_dependency_cycle`), which is the
 * authority. This exists so the UI can grey the option out and explain why,
 * rather than offering a choice that always fails.
 */
function wouldCreateCycle(
  taskId: string,
  dependsOnId: string,
  index: DependencyIndex,
): boolean {
  if (taskId === dependsOnId) return true;

  // Walk forward from the proposed blocker; reaching taskId closes the loop.
  const seen = new Set<string>();
  const queue = [dependsOnId];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (current === taskId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    queue.push(...(index.blockedBy.get(current) ?? []));
  }

  return false;
}

/** Tasks that may be added as a blocker of `taskId` without closing a loop. */
export function eligibleBlockers(
  taskId: string,
  tasks: Task[],
  index: DependencyIndex,
): Task[] {
  const existing = new Set(index.blockedBy.get(taskId) ?? []);
  return tasks.filter(
    (candidate) =>
      candidate.id !== taskId &&
      !existing.has(candidate.id) &&
      !wouldCreateCycle(taskId, candidate.id, index),
  );
}
