"use client";

import { useRememberedChoice } from "@/hooks/use-remembered-choice";
import { useUrlParam } from "@/hooks/use-url-param";
import { useCreateIntent } from "@/features/admin-shell/create-intent";
import { useSetTaskStatus } from "./use-task-status";
import { useEffect, useMemo, useState } from "react";
import { ListTodo, Plus } from "lucide-react";
import { toast } from "sonner";
import type { SubTask, Task } from "@/types";
import {
  useAddSubTaskMutation,
  useAddTaskDependencyMutation,
  useAddTaskMutation,
  useDeleteSubTaskMutation,
  useDeleteTaskDependencyMutation,
  useDeleteTaskMutation,
  useUpdateTaskOrderMutation,
  useGetTaskDependenciesQuery,
  useGetTaskProjectsQuery,
  useGetTasksQuery,
  useUpdateSubTaskMutation,
  useUpdateTaskMutation,
} from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";
import {
  EmptyState,
  FormSheet,
  LoadingState,
  ManagerWrapper,
  PageHeader,
  LoadError,
  ModuleTabs,
} from "@/components/admin/shared";
import { useAppDispatch } from "@/store/hooks";
import { startFocus } from "@/store/slices/focusSlice";
import { getErrorMessage } from "@/lib/utils";
import { useUndoableDelete } from "@/hooks/use-undoable-delete";
import { TASK_STATUS_META, type TaskStatus } from "./task-meta";
import {
  eligibleBlockers as computeEligibleBlockers,
  indexDependencies,
  indexTasks,
  unmetBlockers,
} from "./task-dependencies";
import {
  DEFAULT_FILTERS,
  collectTags,
  filterTasks,
  groupTasks,
  sortTasks,
  type TaskFilters,
  type TaskGroupBy,
  type TaskSortBy,
} from "./task-filters";
import { TaskBoard } from "./task-board";
import { TaskList } from "./task-list";
import { TaskTable } from "./task-table";
import { TaskProjectsSheet } from "./task-projects-sheet";
import { TaskProjectRail } from "./task-project-rail";
import { TaskToolbar, VIEW_TABS, type ViewMode } from "./task-toolbar";
import { TaskQuickAdd } from "./task-quick-add";
import { TaskTimelineView } from "./task-timeline-view";
import { TaskForm } from "./task-form";

export default function TasksPage() {
  const confirm = useConfirm();
  const dispatch = useAppDispatch();

  const [view, setView] = useRememberedChoice<ViewMode>("tasks", "board", [
    "board",
    "list",
    "table",
    "timeline",
  ]);
  const [groupBy, setGroupBy] = useState<TaskGroupBy>("status");
  const [sortBy, setSortBy] = useState<TaskSortBy>("manual");
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  /**
   * Whether the sheet is reading or editing.
   *
   * Clicking a task opened the edit form directly, so every glance at
   * something put its every field one stray keystroke from a change. Opening
   * reads; Edit is a deliberate second action. Creating goes straight to
   * "edit" — there is nothing to read yet.
   */
  const [draftDefaults, setDraftDefaults] = useState<Partial<Task> | null>(
    null,
  );

  const {
    data: allTasks = [],
    isLoading,
    error: loadError,
    refetch,
  } = useGetTasksQuery();
  const { data: projects = [] } = useGetTaskProjectsQuery();
  // Archived projects leave the rail and the pickers; their tasks
  // keep the project, and the board still labels them by it.
  const activeProjects = useMemo(
    () => projects.filter((p) => !p.is_archived),
    [projects],
  );
  const { data: dependencies = [] } = useGetTaskDependenciesQuery();

  const [addTask] = useAddTaskMutation();
  const [updateTask] = useUpdateTaskMutation();
  const [deleteTask] = useDeleteTaskMutation();
  const [updateTaskOrder] = useUpdateTaskOrderMutation();
  const [addSubTask] = useAddSubTaskMutation();
  const [updateSubTask] = useUpdateSubTaskMutation();
  const [deleteSubTask] = useDeleteSubTaskMutation();
  const [addDependency] = useAddTaskDependencyMutation();
  const [deleteDependency] = useDeleteTaskDependencyMutation();

  // Deleting offers Undo rather than asking first; the task leaves
  // every view at once and is deleted when the Undo window closes.
  const { pending: deleting, remove: removeTask } = useUndoableDelete<Task>(
    async (task) => {
      try {
        await deleteTask(task.id).unwrap();
      } catch (err) {
        toast.error("Couldn't delete the task", {
          description: getErrorMessage(err),
        });
      }
    },
  );
  const tasks = useMemo(
    () =>
      deleting.size
        ? allTasks.filter((task) => !deleting.has(task.id))
        : allTasks,
    [allTasks, deleting],
  );

  const byId = useMemo(() => indexTasks(tasks), [tasks]);
  const depIndex = useMemo(
    () => indexDependencies(dependencies),
    [dependencies],
  );
  const projectsById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );

  const blockersFor = useMemo(
    () => (task: Task) => unmetBlockers(task.id, depIndex, byId),
    [depIndex, byId],
  );

  const visible = useMemo(
    () => sortTasks(filterTasks(tasks, filters, depIndex, byId), sortBy),
    [tasks, filters, depIndex, byId, sortBy],
  );

  const groups = useMemo(
    () =>
      groupTasks(
        visible,
        groupBy,
        projects,
        (status) => TASK_STATUS_META[status].label,
      ),
    [visible, groupBy, projects],
  );

  const editingTask = useMemo(
    () => (editingTaskId ? (byId.get(editingTaskId) ?? null) : draftDefaults),
    [editingTaskId, byId, draftDefaults],
  );

  const tags = useMemo(() => collectTags(tasks), [tasks]);

  const taskCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) {
      if (!task.project_id) continue;
      counts.set(task.project_id, (counts.get(task.project_id) ?? 0) + 1);
    }
    return counts;
  }, [tasks]);

  useCreateIntent("task", () => openNew());

  const openNew = (status: TaskStatus = "todo") => {
    setEditingTaskId(null);
    setDraftDefaults({
      status,
      project_id:
        filters.projectId !== "all" && filters.projectId !== "none"
          ? filters.projectId
          : null,
    });
    setIsSheetOpen(true);
  };

  /**
   * A task opens straight into its form. It opened
   * read-only first, so changing a due date took an Edit click before the
   * field; the form shows everything the read view did.
   */
  const openTask = (task: Task) => {
    setEditingTaskId(task.id);
    setDraftDefaults(null);
    setIsSheetOpen(true);
    setTaskParam(task.id);
  };

  // The open task lives in the URL, so a reload or a link reopens it
  //. Replace, not push: Back must not close a sheet mid-edit.
  const [taskParam, setTaskParam] = useUrlParam("task", "replace");
  const linked = taskParam ? byId.get(taskParam) : undefined;
  useEffect(() => {
    if (linked && !isSheetOpen) openTask(linked);
    // Only when the URL names a task that is not already open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked]);
  // Whichever way the sheet closes (dismissed, saved, deleted), the URL follows.
  useEffect(() => {
    if (!isSheetOpen && taskParam) setTaskParam(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSheetOpen]);

  /**
   * Completing a repeating task creates the next instance rather than resetting
   * this one, so what was actually finished stays in the history.
   */
  const setTaskStatus = useSetTaskStatus();
  const applyStatus = (task: Task, status: TaskStatus) =>
    setTaskStatus(task, status, tasks);

  const handleStartTimer = (task: Task) => {
    dispatch(
      startFocus({
        durationMinutes: 25,
        taskTitle: task.title,
        taskId: task.id,
      }),
    );
    toast.success("Focus timer started", { description: task.title });
  };

  const toggleComplete = (task: Task) =>
    applyStatus(task, task.status === "done" ? "todo" : "done");

  /**
   * Persist a column's new running order.
   *
   * No toast on success: reordering is a direct manipulation, and the cards
   * moving *is* the confirmation. A toast for every drag would be noise.
   */
  const handleReorder = async (taskIds: string[]) => {
    try {
      await updateTaskOrder(taskIds).unwrap();
    } catch (err) {
      toast.error("Could not save the new order", {
        description: getErrorMessage(err),
      });
    }
  };

  const handleDeleteTask = (task: Task) => {
    const dependents = depIndex.blocks.get(task.id) ?? [];
    if (editingTaskId === task.id) setIsSheetOpen(false);
    removeTask(
      task,
      `Deleted "${task.title}"`,
      dependents.length > 0
        ? // The edges cascade, so those tasks stop being blocked.
          `With its subtasks. ${dependents.length} task${dependents.length === 1 ? " is" : "s are"} no longer blocked by it.`
        : "With its subtasks.",
    );
  };

  const handleSave = async (values: Partial<Task>) => {
    if (editingTaskId) {
      await updateTask({ id: editingTaskId, ...values }).unwrap();
      toast.success("Task saved.");
    } else {
      await addTask(values).unwrap();
      toast.success("Task created.");
    }
    setIsSheetOpen(false);
  };

  const handleAddBlocker = async (dependsOnId: string) => {
    if (!editingTaskId) return;
    try {
      await addDependency({
        task_id: editingTaskId,
        depends_on_id: dependsOnId,
      }).unwrap();
    } catch (err) {
      // The database rejects cycles too; this is the message if one slips past
      // the client-side filter (a concurrent edit, for instance).
      toast.error("Couldn't add that dependency", {
        description: getErrorMessage(err),
      });
    }
  };

  const handleRemoveBlocker = async (dependsOnId: string) => {
    const edge = dependencies.find(
      (d) => d.task_id === editingTaskId && d.depends_on_id === dependsOnId,
    );
    if (!edge) return;
    try {
      await deleteDependency(edge.id).unwrap();
    } catch (err) {
      toast.error("Couldn't remove that dependency", {
        description: getErrorMessage(err),
      });
    }
  };

  // The optimistic change rolls back on failure; say so rather than let the
  // tick silently reappear.
  const handleToggleSubtask = async (subtask: SubTask) => {
    try {
      await updateSubTask({
        id: subtask.id,
        is_completed: !subtask.is_completed,
      }).unwrap();
    } catch (err) {
      toast.error("Couldn't update the subtask", {
        description: getErrorMessage(err),
      });
    }
  };

  const activeFilterCount =
    (filters.status !== "all" ? 1 : 0) +
    (filters.priority !== "all" ? 1 : 0) +
    (filters.tag !== "all" ? 1 : 0) +
    (filters.blockedOnly ? 1 : 0) +
    (filters.overdueOnly ? 1 : 0);

  if (loadError && tasks.length === 0) {
    return (
      <ManagerWrapper>
        <LoadError what="your tasks" error={loadError} onRetry={refetch} />
      </ManagerWrapper>
    );
  }

  if (isLoading) return <LoadingState label="Loading tasks" />;

  return (
    <ManagerWrapper>
      <PageHeader
        title="Tasks"
        description="Plan, schedule and track what you're working on."
        actions={
          // One primary (G7). Projects are managed from the rail's own
          // control, where they are listed.
          <Button onClick={() => openNew("todo")}>
            <Plus className="mr-2 size-4" aria-hidden /> New task
          </Button>
        }
      />

      <ModuleTabs
        label="Task views"
        tabs={VIEW_TABS}
        current={view}
        onSelect={setView}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <TaskProjectRail
          projects={activeProjects}
          counts={taskCounts}
          totalCount={tasks.length}
          unassignedCount={tasks.filter((t) => !t.project_id).length}
          selected={filters.projectId}
          onSelect={(projectId) => setFilters((f) => ({ ...f, projectId }))}
          onManage={() => setIsProjectsOpen(true)}
        />

        <div className="min-w-0 flex-1">
          <TaskQuickAdd
            projects={activeProjects}
            defaultProjectId={
              filters.projectId !== "all" && filters.projectId !== "none"
                ? filters.projectId
                : null
            }
            onCreate={(values) => addTask(values).unwrap()}
          />

          <TaskToolbar
            view={view}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            filters={filters}
            onFiltersChange={setFilters}
            tags={tags}
          />

          {tasks.length === 0 ? (
            <EmptyState
              icon={ListTodo}
              variant="card"
              title="No tasks yet"
              description="Add the first one. Group them into projects, schedule them, and mark what blocks what."
              action={{
                label: "New task",
                onClick: () => openNew(),
                icon: Plus,
              }}
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={ListTodo}
              variant="card"
              title="Nothing matches"
              description={
                activeFilterCount > 0 || filters.search
                  ? "No task matches the current filters."
                  : "Every task is complete."
              }
              action={{
                label: "Clear filters",
                onClick: () => setFilters(DEFAULT_FILTERS),
              }}
            />
          ) : view === "board" ? (
            <TaskBoard
              tasks={visible}
              projectsById={projectsById}
              blockersFor={blockersFor}
              onOpenTask={openTask}
              onChangeStatus={applyStatus}
              onStartTimer={handleStartTimer}
              onDeleteTask={handleDeleteTask}
              onNewTask={openNew}
              onReorder={handleReorder}
            />
          ) : view === "timeline" ? (
            <TaskTimelineView
              tasks={visible}
              projectsById={projectsById}
              onOpenTask={openTask}
            />
          ) : view === "list" ? (
            <TaskList
              groups={groups}
              projectsById={projectsById}
              blockersFor={blockersFor}
              onOpenTask={openTask}
              onToggleComplete={toggleComplete}
            />
          ) : (
            <TaskTable
              groups={groups}
              projectsById={projectsById}
              blockersFor={blockersFor}
              onOpenTask={openTask}
            />
          )}
        </div>
      </div>

      <FormSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        title={editingTaskId ? "Task" : "New task"}
        description="Details, schedule, subtasks and what blocks it."
      >
        <TaskForm
          key={editingTaskId ?? "new"}
          task={editingTask}
          // The task's own project stays choosable even once archived.
          projects={projects.filter(
            (p) => !p.is_archived || p.id === editingTask?.project_id,
          )}
          blockers={
            editingTaskId
              ? (depIndex.blockedBy.get(editingTaskId) ?? [])
                  .map((id) => byId.get(id))
                  .filter((t): t is Task => !!t)
              : []
          }
          eligibleBlockers={
            editingTaskId
              ? computeEligibleBlockers(editingTaskId, tasks, depIndex)
              : []
          }
          onSave={handleSave}
          onAddSubtask={async (title) => {
            if (!editingTaskId) return;
            await addSubTask({
              task_id: editingTaskId,
              title,
              is_completed: false,
            }).unwrap();
          }}
          onToggleSubtask={handleToggleSubtask}
          onDeleteSubtask={async (id) => {
            const ok = await confirm({
              title: "Delete subtask?",
              description: "This cannot be undone.",
              variant: "destructive",
            });
            if (!ok) return;
            try {
              await deleteSubTask(id).unwrap();
            } catch (err) {
              toast.error("Couldn't delete the subtask", {
                description: getErrorMessage(err),
              });
            }
          }}
          onAddBlocker={handleAddBlocker}
          onRemoveBlocker={handleRemoveBlocker}
          onDelete={
            editingTask && editingTaskId
              ? () => handleDeleteTask(editingTask as Task)
              : undefined
          }
          onCancel={() => setIsSheetOpen(false)}
        />
      </FormSheet>

      <TaskProjectsSheet
        open={isProjectsOpen}
        onOpenChange={setIsProjectsOpen}
        projects={projects}
        taskCounts={taskCounts}
      />
    </ManagerWrapper>
  );
}
