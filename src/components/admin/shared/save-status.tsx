import { AlertCircle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const DEFAULT_TEXT: Record<SaveState, string> = {
  idle: "",
  dirty: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
  error: "Not saved",
};

/**
 * Whether your work is safe, in one look for every editor (workspace
 * contract: one status language, P-save-status). An icon and words, never
 * colour alone; announced politely as it changes. `idle` shows `text` only,
 * for a quiet "Edited 3 minutes ago".
 *
 * Notes and Maps each drew their own, in different places and words; this is
 * the one both converge on.
 */
export function SaveStatus({
  state,
  text,
  className,
}: {
  state: SaveState;
  /** Overrides the default words (an "Edited …" line when idle, say). */
  text?: string;
  className?: string;
}) {
  const words = text ?? DEFAULT_TEXT[state];
  if (!words) return null;
  return (
    <p
      aria-live="polite"
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 text-xs",
        state === "error" ? "text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      {state === "saving" && (
        <Loader2
          aria-hidden
          className="size-3 shrink-0 animate-spin motion-reduce:animate-none"
        />
      )}
      {state === "saved" && (
        <Check aria-hidden className="size-3 shrink-0 text-success" />
      )}
      {state === "dirty" && (
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full bg-warning"
        />
      )}
      {state === "error" && (
        <AlertCircle aria-hidden className="size-3 shrink-0" />
      )}
      <span className="truncate">{words}</span>
    </p>
  );
}
