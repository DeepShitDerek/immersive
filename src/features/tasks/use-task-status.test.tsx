import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/types";

const updateTask = vi.fn();
const addTask = vi.fn();
const loadTasks = vi.fn();
const ok = (value: unknown) => ({ unwrap: () => Promise.resolve(value) });
vi.mock("@/store/api/admin/tasksApi", () => ({
  useUpdateTaskMutation: () => [updateTask],
  useAddTaskMutation: () => [addTask],
  useLazyGetTasksQuery: () => [loadTasks],
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { useSetTaskStatus } = await import("./use-task-status");

const weekly = {
  id: "t1",
  title: "Water plants",
  status: "todo",
  due_date: "2026-09-25",
  recurrence: "weekly",
} as Task;

beforeEach(() => {
  vi.clearAllMocks();
  updateTask.mockReturnValue(ok(null));
  addTask.mockReturnValue(ok(null));
});

describe("completing a task from the dashboard", () => {
  it("schedules the next repeat, reading the task list it was not given", async () => {
    loadTasks.mockReturnValue(ok([weekly]));
    const { result } = renderHook(() => useSetTaskStatus());
    await act(async () => {
      expect(await result.current(weekly, "done")).toBe(true);
    });
    expect(updateTask).toHaveBeenCalledWith({ id: "t1", status: "done" });
    expect(addTask).toHaveBeenCalledWith(
      expect.objectContaining({
        due_date: "2026-10-02",
        recurrence_parent_id: "t1",
      }),
    );
  });

  it("does not schedule it twice", async () => {
    const already = {
      ...weekly,
      id: "t2",
      due_date: "2026-10-02",
      recurrence_parent_id: "t1",
    } as Task;
    const { result } = renderHook(() => useSetTaskStatus());
    await act(async () => {
      await result.current(weekly, "done", [weekly, already]);
    });
    expect(loadTasks).not.toHaveBeenCalled();
    expect(addTask).not.toHaveBeenCalled();
  });

  it("reports a failed save instead of throwing", async () => {
    updateTask.mockReturnValue({
      unwrap: () => Promise.reject(new Error("offline")),
    });
    const { result } = renderHook(() => useSetTaskStatus());
    await act(async () => {
      expect(await result.current(weekly, "done")).toBe(false);
    });
  });
});
