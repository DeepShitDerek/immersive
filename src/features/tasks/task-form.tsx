"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleSlash, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { SubTask, Task, TaskProject } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TASK_PRIORITY_OPTIONS,
  TASK_RECURRENCE_OPTIONS,
  TASK_STATUS_OPTIONS,
} from "@/lib/constants";
import { taskSchema, type TaskFormValues } from "@/lib/schemas";
import { getErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/cn";

/** Sentinel for "no project" — Radix Select cannot hold an empty string value. */
const NO_PROJECT = "__none__";
const NO_REPEAT = "__never__";

export interface TaskFormProps {
  task: Partial<Task> | null;
  projects: TaskProject[];
  /** Tasks that may block this one without closing a dependency loop. */
  eligibleBlockers: Task[];
  /** Blockers already attached, resolved to tasks. */
  blockers: Task[];
  onSave: (values: Partial<Task>) => Promise<void>;
  onAddSubtask: (title: string) => Promise<void>;
  onToggleSubtask: (subtask: SubTask) => void;
  onDeleteSubtask: (id: string) => void;
  onAddBlocker: (dependsOnId: string) => Promise<void>;
  onRemoveBlocker: (dependsOnId: string) => void;
  /** Absent for a task that does not exist yet. */
  onDelete?: () => void;
  onCancel: () => void;
}

export function TaskForm({
  task,
  projects,
  eligibleBlockers,
  blockers,
  onSave,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onAddBlocker,
  onRemoveBlocker,
  onDelete,
  onCancel,
}: TaskFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [blockerChoice, setBlockerChoice] = useState("");

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    // Seeded from the prop rather than an effect: the sheet keys this component
    // per task, so an effect would only repeat the first render with the right
    // values one commit later.
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      project_id: task?.project_id ?? null,
      status: task?.status ?? "todo",
      priority: task?.priority ?? "medium",
      start_date: task?.start_date ?? "",
      due_date: task?.due_date ?? "",
      tags: task?.tags ?? [],
      estimate_minutes: task?.estimate_minutes ?? null,
      recurrence: task?.recurrence ?? null,
      recurrence_interval: task?.recurrence_interval ?? null,
    },
  });

  const tags = form.watch("tags") ?? [];
  const recurrence = form.watch("recurrence");
  const subtasks = useMemo(() => task?.sub_tasks ?? [], [task?.sub_tasks]);

  const handleSubmit = async (values: TaskFormValues) => {
    setIsSaving(true);
    try {
      await onSave({
        ...values,
        // Empty date inputs give "", which Postgres rejects for a DATE column.
        start_date: values.start_date || null,
        due_date: values.due_date || null,
        description: values.description || null,
      });
    } catch (err) {
      toast.error("Couldn't save the task", {
        description: getErrorMessage(err),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const submitSubtask = async () => {
    const title = subtaskTitle.trim();
    if (!title) return;
    await onAddSubtask(title);
    setSubtaskTitle("");
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-5 pt-2"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input {...field} autoFocus placeholder="What needs doing?" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={3}
                  placeholder="Any detail worth keeping"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="project_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project</FormLabel>
                <Select
                  value={field.value ?? NO_PROJECT}
                  onValueChange={(v) =>
                    field.onChange(v === NO_PROJECT ? null : v)
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT}>No project</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TASK_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TASK_PRIORITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="estimate_minutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estimate (minutes)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    type="number"
                    min={0}
                    placeholder="60"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start date</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} type="date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="due_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due date</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} type="date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Tags — comma separated in, array out. */}
        <FormItem>
          <FormLabel htmlFor="task-tags">Tags</FormLabel>
          <Input
            id="task-tags"
            value={tags.join(", ")}
            onChange={(e) =>
              form.setValue(
                "tags",
                e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
                { shouldValidate: true },
              )
            }
            placeholder="errands, admin"
          />
          <FormDescription>Comma separated.</FormDescription>
        </FormItem>

        {/* Repeat */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="recurrence"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Repeats</FormLabel>
                <Select
                  value={field.value ?? NO_REPEAT}
                  onValueChange={(v) =>
                    field.onChange(v === NO_REPEAT ? null : v)
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NO_REPEAT}>Never</SelectItem>
                    {TASK_RECURRENCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {recurrence && (
            <FormField
              control={form.control}
              name="recurrence_interval"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Every</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      type="number"
                      min={1}
                      placeholder="1"
                    />
                  </FormControl>
                  <FormDescription>
                    Completing it creates the next one.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Subtasks and dependencies only exist once the task does. */}
        {task?.id && (
          <>
            <section className="space-y-2 border-t pt-4">
              <Label>Subtasks</Label>
              {subtasks.length > 0 && (
                <ul className="space-y-1">
                  {subtasks.map((subtask) => (
                    <li key={subtask.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={subtask.is_completed}
                        onCheckedChange={() => onToggleSubtask(subtask)}
                        aria-label={subtask.title}
                      />
                      <span
                        className={cn(
                          "min-w-0 flex-1 break-words text-sm",
                          subtask.is_completed &&
                            "text-muted-foreground line-through",
                        )}
                      >
                        {subtask.title}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        aria-label={`Delete subtask ${subtask.title}`}
                        onClick={() => onDeleteSubtask(subtask.id)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Input
                  value={subtaskTitle}
                  onChange={(e) => setSubtaskTitle(e.target.value)}
                  placeholder="Add a subtask"
                  aria-label="New subtask"
                  onKeyDown={(e) => {
                    // Enter inside a nested field would submit the whole task.
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void submitSubtask();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Add subtask"
                  onClick={() => void submitSubtask()}
                >
                  <Plus className="size-4" aria-hidden />
                </Button>
              </div>
            </section>

            <section className="space-y-2 border-t pt-4">
              <Label>Blocked by</Label>
              {blockers.length > 0 ? (
                <ul className="space-y-1">
                  {blockers.map((blocker) => (
                    <li
                      key={blocker.id}
                      className="flex items-center gap-2 rounded-control bg-secondary/50 px-2 py-1.5 text-sm"
                    >
                      <CircleSlash
                        aria-hidden
                        className={cn(
                          "size-3.5 shrink-0",
                          blocker.status === "done"
                            ? "text-muted-foreground"
                            : "text-destructive",
                        )}
                      />
                      <span className="min-w-0 flex-1 break-words">
                        {blocker.title}
                      </span>
                      {blocker.status === "done" && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          done
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        aria-label={`Remove blocker ${blocker.title}`}
                        onClick={() => onRemoveBlocker(blocker.id)}
                      >
                        <X className="size-3.5" aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nothing is holding this task up.
                </p>
              )}

              {eligibleBlockers.length > 0 && (
                <div className="flex gap-2">
                  <Select
                    value={blockerChoice}
                    onValueChange={async (value) => {
                      setBlockerChoice("");
                      await onAddBlocker(value);
                    }}
                  >
                    <SelectTrigger aria-label="Add a blocking task">
                      <SelectValue placeholder="Add a blocking task…" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Only tasks that cannot close a loop are offered, so
                          the database's cycle check is never the first time
                          the owner hears "no". */}
                      {eligibleBlockers.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {candidate.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </section>
          </>
        )}

        <div className="flex items-center gap-2 border-t pt-4">
          {onDelete && (
            <Button
              type="button"
              variant="ghost"
              onClick={onDelete}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="mr-2 size-4" aria-hidden /> Delete
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="ml-auto"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving && (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            )}
            Save task
          </Button>
        </div>
      </form>
    </Form>
  );
}
