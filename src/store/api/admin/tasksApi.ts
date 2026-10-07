import { supabase } from "@/supabase/client";
import type { SubTask, Task, TaskDependency, TaskProject } from "@/types";
import { adminApi } from "./baseApi";
import {
  NO_DB_ERROR,
  deleteQueryFn,
  getAllQueryFn,
  insertQueryFn,
  updateQueryFn,
} from "./query-helpers";

/**
 * Tasks + subtasks. These endpoints keep the task list responsive with
 * optimistic cache updates against `getTasks` instead of tag invalidation
 * (which would refetch the whole joined list on every keystroke-level change).
 */
export const tasksApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    getTasks: builder.query<Task[], void>({
      queryFn: async () => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { data, error } = await supabase
          .from("tasks")
          .select("*, sub_tasks(*)")
          // Manual rank first so drag-to-reorder sticks; creation date only
          // breaks ties between rows that have never been dragged.
          .order("display_order", { ascending: true })
          .order("created_at", { ascending: false });
        if (error) return { error };
        return { data };
      },
      providesTags: ["Tasks"],
    }),
    addTask: builder.mutation<Task, Partial<Task>>({
      queryFn: async (task) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { data, error } = await supabase
          .from("tasks")
          .insert(task)
          .select("*, sub_tasks(*)")
          .single();
        if (error) return { error };
        return { data };
      },
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data: newTask } = await queryFulfilled;
          dispatch(
            tasksApi.util.updateQueryData("getTasks", undefined, (draft) => {
              draft.unshift(newTask);
            }),
          );
        } catch {
          // Task creation failed, no cache update needed
        }
      },
      invalidatesTags: ["Calendar"],
    }),
    updateTask: builder.mutation<Task, Partial<Task>>({
      queryFn: async (task) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { id, ...updateData } = task;
        const { data, error } = await supabase
          .from("tasks")
          .update(updateData)
          .eq("id", id!)
          .select("*, sub_tasks(*)")
          .single();
        if (error) return { error };
        return { data };
      },
      async onQueryStarted(task, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          tasksApi.util.updateQueryData("getTasks", undefined, (draft) => {
            const existingTask = draft.find((t) => t.id === task.id);
            if (existingTask) {
              Object.assign(existingTask, task);
            }
          }),
        );
        try {
          const { data: updatedTask } = await queryFulfilled;
          dispatch(
            tasksApi.util.updateQueryData("getTasks", undefined, (draft) => {
              const index = draft.findIndex((t) => t.id === updatedTask.id);
              if (index !== -1) {
                draft[index] = updatedTask;
              }
            }),
          );
        } catch {
          patchResult.undo();
        }
      },
      invalidatesTags: ["Calendar"],
    }),
    deleteTask: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("tasks"),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          tasksApi.util.updateQueryData("getTasks", undefined, (draft) => {
            const index = draft.findIndex((t) => t.id === id);
            if (index !== -1) {
              draft.splice(index, 1);
            }
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
      invalidatesTags: ["Calendar"],
    }),
    addSubTask: builder.mutation<SubTask, Partial<SubTask>>({
      queryFn: async (subTask) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { data, error } = await supabase
          .from("sub_tasks")
          .insert(subTask)
          .select()
          .single();
        if (error) return { error };
        return { data };
      },
      async onQueryStarted(subTask, { dispatch, queryFulfilled }) {
        try {
          const { data: newSubTask } = await queryFulfilled;
          dispatch(
            tasksApi.util.updateQueryData("getTasks", undefined, (draft) => {
              const task = draft.find((t) => t.id === subTask.task_id);
              if (task) {
                if (!task.sub_tasks) task.sub_tasks = [];
                task.sub_tasks.push(newSubTask);
              }
            }),
          );
        } catch {
          // Subtask creation failed
        }
      },
    }),
    updateSubTask: builder.mutation<SubTask, Partial<SubTask>>({
      queryFn: async (subTask) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { id, ...updateData } = subTask;
        const { data, error } = await supabase
          .from("sub_tasks")
          .update(updateData)
          .eq("id", id!)
          .select()
          .single();
        if (error) return { error };
        return { data };
      },
      async onQueryStarted(subTask, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          tasksApi.util.updateQueryData("getTasks", undefined, (draft) => {
            for (const task of draft) {
              const st = task.sub_tasks?.find((s) => s.id === subTask.id);
              if (st) {
                Object.assign(st, subTask);
                break;
              }
            }
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),
    deleteSubTask: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("sub_tasks"),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          tasksApi.util.updateQueryData("getTasks", undefined, (draft) => {
            for (const task of draft) {
              if (task.sub_tasks) {
                const index = task.sub_tasks.findIndex((s) => s.id === id);
                if (index !== -1) {
                  task.sub_tasks.splice(index, 1);
                  break;
                }
              }
            }
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),
    /* ── Projects ─────────────────────────────────────────────────────── */
    getTaskProjects: builder.query<TaskProject[], void>({
      queryFn: getAllQueryFn<TaskProject>("task_projects", [
        { column: "display_order" },
        { column: "created_at" },
      ]),
      providesTags: ["TaskProjects"],
    }),
    addTaskProject: builder.mutation<TaskProject, Partial<TaskProject>>({
      queryFn: insertQueryFn<TaskProject>("task_projects"),
      invalidatesTags: ["TaskProjects"],
    }),
    updateTaskProject: builder.mutation<TaskProject, Partial<TaskProject>>({
      queryFn: updateQueryFn<TaskProject>("task_projects"),
      invalidatesTags: ["TaskProjects"],
    }),
    deleteTaskProject: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("task_projects"),
      // `tasks.project_id` is ON DELETE SET NULL, so the tasks survive and
      // move to "No project" — the task list has to be refetched to show it.
      invalidatesTags: ["TaskProjects", "Tasks"],
    }),

    /* ── Dependencies ─────────────────────────────────────────────────── */
    getTaskDependencies: builder.query<TaskDependency[], void>({
      queryFn: getAllQueryFn<TaskDependency>("task_dependencies"),
      providesTags: ["TaskDependencies"],
    }),
    addTaskDependency: builder.mutation<
      TaskDependency,
      { task_id: string; depends_on_id: string }
    >({
      queryFn: insertQueryFn<TaskDependency>("task_dependencies"),
      invalidatesTags: ["TaskDependencies"],
    }),
    deleteTaskDependency: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("task_dependencies"),
      invalidatesTags: ["TaskDependencies"],
    }),

    /* ── Time tracking ────────────────────────────────────────────────── */
    addTaskTime: builder.mutation<null, { taskId: string; minutes: number }>({
      queryFn: async ({ taskId, minutes }) => {
        if (!supabase) return { error: NO_DB_ERROR };
        // Incremented in the database. A client-side read-modify-write would
        // lose a session whenever two finish against the same stale row.
        const { error } = await supabase.rpc("add_task_time", {
          target_task_id: taskId,
          minutes,
        });
        if (error) return { error };
        return { data: null };
      },
      invalidatesTags: ["Tasks"],
    }),

    /* ── Manual ordering ──────────────────────────────────────────────── */
    updateTaskOrder: builder.mutation<null, string[]>({
      queryFn: async (taskIds) => {
        if (!supabase) return { error: NO_DB_ERROR };
        // One transaction in the database rather than N round trips, so a
        // half-applied order is not possible.
        const { error } = await supabase.rpc("update_task_order", {
          task_ids: taskIds,
        });
        if (error) return { error };
        return { data: null };
      },
      invalidatesTags: ["Tasks"],
    }),
  }),
});

export const {
  useGetTasksQuery,
  useLazyGetTasksQuery,
  useAddTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useAddSubTaskMutation,
  useUpdateSubTaskMutation,
  useDeleteSubTaskMutation,
  useGetTaskProjectsQuery,
  useAddTaskProjectMutation,
  useUpdateTaskProjectMutation,
  useDeleteTaskProjectMutation,
  useGetTaskDependenciesQuery,
  useAddTaskDependencyMutation,
  useDeleteTaskDependencyMutation,
  useUpdateTaskOrderMutation,
  useAddTaskTimeMutation,
} = tasksApi;
