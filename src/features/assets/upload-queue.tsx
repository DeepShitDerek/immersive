"use client";

import { AlertCircle, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  batchProgress,
  describeProgress,
  type UploadTask,
} from "./upload-progress";

/**
 * What is uploading, per file.
 *
 * A single global spinner said "something is happening" and nothing else —
 * not which file, not how far through, and not which of five had failed. On a
 * 40 MB video that is several minutes of no information at all.
 *
 * The batch bar is weighted by **bytes, not by file count**: three photos and
 * a video are not four equal quarters, and a bar that jumps to 75% and then
 * sits there for two minutes is worse than no bar.
 */
export function UploadQueue({
  tasks,
  onDismiss,
}: {
  tasks: UploadTask[];
  onDismiss: () => void;
}) {
  if (tasks.length === 0) return null;

  const failed = tasks.filter((task) => task.stage === "failed").length;
  const settled = tasks.every(
    (task) => task.stage === "done" || task.stage === "failed",
  );
  const progress = batchProgress(tasks);

  return (
    <section
      aria-label="Uploads"
      aria-live="polite"
      className="mb-4 overflow-hidden rounded-surface border bg-card"
    >
      <header className="flex items-center gap-3 px-4 pb-2 pt-3">
        <h3 className="flex-1 text-sm font-medium">
          {settled
            ? failed > 0
              ? `${failed} of ${tasks.length} failed`
              : "Uploaded"
            : `Uploading ${tasks.length} file${tasks.length === 1 ? "" : "s"}`}
        </h3>
        {!settled && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {Math.round(progress * 100)}%
          </span>
        )}
        {settled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Dismiss uploads"
            onClick={onDismiss}
          >
            <X className="size-4" aria-hidden />
          </Button>
        )}
      </header>

      {!settled && (
        <div className="mx-4 mb-2 h-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-base ease-enter"
            style={{ width: `${Math.max(progress * 100, 2)}%` }}
          />
        </div>
      )}

      <ul className="max-h-48 overflow-y-auto">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex items-center gap-3 border-t border-border/60 px-4 py-2"
          >
            <StageIcon stage={task.stage} />

            <div className="min-w-0 flex-1">
              {/* break-words: a filename is often one long unbroken token. */}
              <p className="truncate text-sm">{task.name}</p>
              <p
                className={cn(
                  "text-micro tabular-nums",
                  task.stage === "failed"
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {describeProgress(task)}
              </p>
            </div>

            {task.stage === "uploading" && task.size > 0 && (
              <span
                aria-hidden
                className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-secondary"
              >
                <span
                  className="block h-full rounded-full bg-primary transition-[width] duration-base ease-enter"
                  style={{
                    width: `${Math.min((task.loaded / task.size) * 100, 100)}%`,
                  }}
                />
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StageIcon({ stage }: { stage: UploadTask["stage"] }) {
  if (stage === "failed") {
    return (
      <AlertCircle
        className="size-4 shrink-0 text-destructive"
        aria-label="Failed"
      />
    );
  }
  if (stage === "done") {
    // The success token: every preset sets it, check:themes holds it to 4.5:1.
    return <Check className="size-4 shrink-0 text-success" aria-label="Done" />;
  }
  return (
    <Loader2
      className="size-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
      aria-label={stage === "saving" ? "Saving" : "Uploading"}
    />
  );
}
