"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { Task, TaskProject } from "@/types";
import { getErrorMessage } from "@/lib/utils";
import { parseQuickAdd } from "./quick-add";
import { todayIso } from "./task-filters";

/**
 * "Add a task…" at the head of the list.
 *
 * Every task used to cost a sheet, a form and a save. Here it is one line and
 * Enter; focus stays in the field for the next one. A line can carry its
 * due date, project and priority (`tomorrow #work !high`, see quick-add.ts),
 * and what was understood is read back under the field as you type, so a
 * word is never silently eaten. The full form is still a click away for
 * anything more.
 */
export function TaskQuickAdd({
  projects,
  defaultProjectId,
  onCreate,
}: {
  projects: Pick<TaskProject, "id" | "name">[];
  /** The project selected in the rail, used when the line names none. */
  defaultProjectId: string | null;
  onCreate: (values: Partial<Task>) => Promise<unknown>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(
    () => parseQuickAdd(text, projects, todayIso()),
    [text, projects],
  );
  const hintId = "task-quick-add-hint";

  const submit = async () => {
    if (!parsed.title || busy) return;
    setBusy(true);
    try {
      await onCreate({
        title: parsed.title,
        status: "todo",
        due_date: parsed.dueDate,
        project_id: parsed.projectId ?? defaultProjectId,
        priority: parsed.priority ?? undefined,
        tags: parsed.tags.length ? parsed.tags : undefined,
      });
      setText("");
    } catch (err) {
      toast.error("Couldn't add the task", {
        description: getErrorMessage(err),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 rounded-control border border-input bg-card px-3 focus-within:outline focus-within:outline-[length:var(--focus-width)] focus-within:outline-offset-2 focus-within:outline-ring">
        <Plus aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit();
            }
            if (event.key === "Escape") setText("");
          }}
          disabled={busy}
          placeholder="Add a task…  try “tomorrow #project !high”"
          aria-label="Add a task"
          aria-describedby={hintId}
          className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <p
        id={hintId}
        aria-live="polite"
        className="mt-1.5 min-h-5 px-1 font-mono text-micro text-muted-foreground"
      >
        {text.trim() && parsed.understood.length > 0
          ? parsed.understood.join(" · ")
          : text.trim()
            ? "Enter to add"
            : ""}
      </p>
    </div>
  );
}
