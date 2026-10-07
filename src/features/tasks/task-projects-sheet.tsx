"use client";

import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { TaskProject } from "@/types";
import {
  useAddTaskProjectMutation,
  useDeleteTaskProjectMutation,
  useUpdateTaskProjectMutation,
} from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";
import { FormSheet } from "@/components/admin/shared";
import { taskProjectSchema } from "@/lib/schemas";
import { getErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/cn";

/**
 * Preset swatches rather than a free colour picker.
 *
 * The column stores a hex string, so these are fixed values — a small set that
 * stays distinguishable from one another beats a picker that lets a project be
 * given a colour nobody can tell from the next one.
 *
 * (An earlier comment here claimed these were read off the active theme's
 * chart tokens. They are not, and never were; the list below is literal.)
 */
const SWATCHES = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#14b8a6",
  "#64748b",
];

interface ProjectRowProps {
  project: TaskProject;
  taskCount: number;
  onRename: (name: string) => void;
  onRecolour: (color: string) => void;
  onArchive: () => void;
  onDelete: () => void;
}

/**
 * A project, read first.
 *
 * Every row used to be a live `<Input>` with eight colour swatches under it
 * permanently on show, so the list of projects was a page of forms — a name
 * was one stray keystroke from being changed, and it was impossible to simply
 * *look* at the projects. Renaming and recolouring are behind an explicit
 * Edit now; the row itself just states the colour, the name and how many
 * tasks are in it.
 *
 * Delete stays visible. It is guarded by a confirm that names what it affects,
 * and burying an ordinary list action two clicks deep is the opposite kind of
 * mistake.
 */
function ProjectRow({
  project,
  taskCount,
  onRename,
  onRecolour,
  onArchive,
  onDelete,
}: ProjectRowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);

  const commit = () => {
    const trimmed = name.trim();
    setEditing(false);
    if (!trimmed || trimmed === project.name) {
      setName(project.name);
      return;
    }
    onRename(trimmed);
  };

  const cancel = () => {
    setName(project.name);
    setEditing(false);
  };

  return (
    <li className="rounded-surface bg-card p-3 shadow-e1">
      <div className="flex items-center gap-2">
        {editing ? (
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") cancel();
            }}
            aria-label={`Rename ${project.name}`}
            className="h-8 flex-1"
          />
        ) : (
          <>
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: project.color ?? "#64748b" }}
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {project.name}
            </span>
          </>
        )}

        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {taskCount}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label={
            editing ? `Done editing ${project.name}` : `Edit ${project.name}`
          }
          // `mousedown`: the input's own blur commits first otherwise, and the
          // button would be gone before the click landed.
          onMouseDown={(event) => {
            event.preventDefault();
            if (editing) commit();
            else setEditing(true);
          }}
        >
          {editing ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Pencil className="size-4" aria-hidden />
          )}
        </Button>

        {/* Archive before delete: a finished project keeps its history
. The column existed; nothing could set it. */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label={
            project.is_archived
              ? `Restore ${project.name}`
              : `Archive ${project.name}`
          }
          onClick={onArchive}
        >
          {project.is_archived ? (
            <ArchiveRestore className="size-4" aria-hidden />
          ) : (
            <Archive className="size-4" aria-hidden />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Delete ${project.name}`}
          onClick={onDelete}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      {editing && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`Set ${project.name} colour to ${swatch}`}
              aria-pressed={project.color === swatch}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onRecolour(swatch)}
              style={{ backgroundColor: swatch }}
              className={cn(
                "flex size-5 items-center justify-center rounded-full transition-transform hover:scale-110 focus-ring",
                project.color === swatch && "ring-2 ring-ring ring-offset-1",
              )}
            >
              {project.color === swatch && (
                <Check className="size-3 text-white" aria-hidden />
              )}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

export interface TaskProjectsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: TaskProject[];
  /** Task count per project id, so deleting says what it affects. */
  taskCounts: Map<string, number>;
}

export function TaskProjectsSheet({
  open,
  onOpenChange,
  projects,
  taskCounts,
}: TaskProjectsSheetProps) {
  const confirm = useConfirm();
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [addProject] = useAddTaskProjectMutation();
  const [updateProject] = useUpdateTaskProjectMutation();
  const [deleteProject] = useDeleteTaskProjectMutation();

  const handleCreate = async () => {
    const parsed = taskProjectSchema.safeParse({
      name: newName,
      color: SWATCHES[projects.length % SWATCHES.length],
    });
    if (!parsed.success) {
      toast.error("Can't create that project", {
        description: parsed.error.issues[0]?.message,
      });
      return;
    }

    setIsCreating(true);
    try {
      await addProject(parsed.data).unwrap();
      setNewName("");
      toast.success("Project created.");
    } catch (err) {
      toast.error("Couldn't create the project", {
        description: getErrorMessage(err),
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRename = async (project: TaskProject, name: string) => {
    const parsed = taskProjectSchema.shape.name.safeParse(name);
    if (!parsed.success) {
      toast.error("Can't rename", {
        description: parsed.error.issues[0]?.message,
      });
      return;
    }
    try {
      await updateProject({ id: project.id, name: parsed.data }).unwrap();
    } catch (err) {
      toast.error("Couldn't rename the project", {
        description: getErrorMessage(err),
      });
    }
  };

  const handleArchive = async (project: TaskProject) => {
    const archiving = !project.is_archived;
    try {
      await updateProject({ id: project.id, is_archived: archiving }).unwrap();
      toast.success(archiving ? "Project archived." : "Project restored.");
    } catch (err) {
      toast.error("Couldn't update the project", {
        description: getErrorMessage(err),
      });
    }
  };

  const active = projects.filter((p) => !p.is_archived);
  const archived = projects.filter((p) => p.is_archived);
  const row = (project: TaskProject) => (
    <ProjectRow
      key={project.id}
      project={project}
      taskCount={taskCounts.get(project.id) ?? 0}
      onRename={(name) => void handleRename(project, name)}
      onRecolour={(color) => void updateProject({ id: project.id, color })}
      onArchive={() => void handleArchive(project)}
      onDelete={() => void handleDelete(project)}
    />
  );

  const handleDelete = async (project: TaskProject) => {
    const count = taskCounts.get(project.id) ?? 0;
    const ok = await confirm({
      title: `Delete "${project.name}"?`,
      description:
        count > 0
          ? // ON DELETE SET NULL — worth saying, because "delete the project"
            // reads like it might take the work with it.
            `Its ${count} task${count === 1 ? "" : "s"} are kept and moved to "No project". This cannot be undone.`
          : "This cannot be undone.",
      variant: "destructive",
      confirmText: "Delete",
    });
    if (!ok) return;

    try {
      await deleteProject(project.id).unwrap();
      toast.success("Project deleted.");
    } catch (err) {
      toast.error("Couldn't delete the project", {
        description: getErrorMessage(err),
      });
    }
  };

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Projects"
      description="Group tasks into projects. Archiving or deleting one keeps its tasks."
      // Renames and colours save as they happen; only an unsent new name is
      // at risk when the sheet closes.
      dirty={newName.trim() !== ""}
    >
      <div className="space-y-4 pt-2">
        <div className="space-y-2">
          <Label htmlFor="new-project">New project</Label>
          <div className="flex gap-2">
            <Input
              id="new-project"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="House renovation"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
            />
            <Button
              type="button"
              onClick={() => void handleCreate()}
              disabled={isCreating || !newName.trim()}
            >
              {isCreating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              <span className="sr-only">Add project</span>
            </Button>
          </div>
        </div>

        {projects.length === 0 ? (
          <p className="rounded-surface bg-secondary/40 p-4 text-center text-sm text-muted-foreground">
            No projects yet. Tasks without one show under &ldquo;No
            project&rdquo;.
          </p>
        ) : (
          <>
            <ul className="space-y-2">{active.map(row)}</ul>
            {archived.length > 0 && (
              <section
                aria-labelledby="archived-projects"
                className="space-y-2"
              >
                <h3
                  id="archived-projects"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Archived
                </h3>
                <ul className="space-y-2 opacity-80">{archived.map(row)}</ul>
              </section>
            )}
          </>
        )}
      </div>
    </FormSheet>
  );
}
