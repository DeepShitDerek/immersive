import { describe, expect, it } from "vitest";
import type { Task } from "@/types";
import { hasNextOccurrence, nextOccurrence } from "./task-recurrence";

const task = (t: Partial<Task>): Task =>
  ({ id: "t1", title: "Water plants", status: "done", ...t }) as Task;

describe("repeating tasks", () => {
  const first = task({
    id: "t1",
    due_date: "2026-09-25",
    recurrence: "weekly",
  });
  const next = nextOccurrence(first)!;

  it("creates the next one when none exists yet", () => {
    expect(next).toMatchObject({
      due_date: "2026-10-02",
      recurrence_parent_id: "t1",
    });
    expect(hasNextOccurrence([first], first, next)).toBe(false);
  });

  it("does not create it twice when the task is completed again", () => {
    const spawned = task({
      id: "t2",
      status: "todo",
      due_date: "2026-10-02",
      recurrence: "weekly",
      recurrence_parent_id: "t1",
    });
    expect(hasNextOccurrence([first, spawned], first, next)).toBe(true);
  });

  it("follows the series from a later instance", () => {
    const second = task({
      id: "t2",
      due_date: "2026-10-02",
      recurrence: "weekly",
      recurrence_parent_id: "t1",
    });
    const third = nextOccurrence(second)!;
    expect(third.recurrence_parent_id).toBe("t1");
    const existing = task({
      id: "t3",
      status: "todo",
      due_date: "2026-10-09",
      recurrence_parent_id: "t1",
    });
    expect(hasNextOccurrence([second, existing], second, third)).toBe(true);
    // Another series due the same day does not count.
    const other = task({
      id: "x",
      status: "todo",
      due_date: "2026-10-09",
      recurrence_parent_id: "other",
    });
    expect(hasNextOccurrence([second, other], second, third)).toBe(false);
  });
});
