import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { TaskQuickAdd } from "./task-quick-add";
import { todayIso } from "./task-filters";

const projects = [{ id: "p-work", name: "Work" }];

describe("TaskQuickAdd", () => {
  it("creates from one line on Enter, reads back what it understood, and clears", async () => {
    const onCreate = vi.fn(async () => {});
    render(
      <TaskQuickAdd
        projects={projects}
        defaultProjectId={null}
        onCreate={onCreate}
      />,
    );
    const field = screen.getByLabelText("Add a task");

    fireEvent.change(field, { target: { value: "Review the PR #work !high" } });
    expect(screen.getByText(/Project: Work · High priority/)).toBeTruthy();

    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect((field as HTMLInputElement).value).toBe(""));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Review the PR",
        project_id: "p-work",
        priority: "high",
        status: "todo",
      }),
    );
  });

  it("files into the project chosen in the rail when the line names none", async () => {
    const onCreate = vi.fn(async () => {});
    render(
      <TaskQuickAdd
        projects={projects}
        defaultProjectId="p-work"
        onCreate={onCreate}
      />,
    );
    const field = screen.getByLabelText("Add a task");
    fireEvent.change(field, { target: { value: "Plan the week today" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Plan the week",
          project_id: "p-work",
          due_date: todayIso(),
        }),
      ),
    );
  });

  it("does nothing with an empty line", () => {
    const onCreate = vi.fn(async () => {});
    render(
      <TaskQuickAdd
        projects={projects}
        defaultProjectId={null}
        onCreate={onCreate}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText("Add a task"), { key: "Enter" });
    expect(onCreate).not.toHaveBeenCalled();
  });
});
