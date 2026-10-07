import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/utils";

/**
 * A module's data failed to load.
 *
 * Lists default to `[]`, so without this a failed read showed "No notes yet"
 * (the module telling you your data is empty when it only failed to arrive),
 * and Settings showed its skeleton forever. The same shape Money has always
 * used: what failed, the reason, and a retry.
 */
export default function LoadError({
  what,
  error,
  onRetry,
  hint,
}: {
  /** "your notes", "the inbox". Completes "Couldn't load …". */
  what: string;
  error: unknown;
  onRetry: () => void;
  /** What usually causes it, when the module knows (a missing migration…). */
  hint?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-surface border border-destructive/40 bg-destructive/5 p-5 text-sm"
    >
      <p className="font-medium text-destructive">Couldn&apos;t load {what}.</p>
      <p className="mt-1 text-muted-foreground">{getErrorMessage(error)}</p>
      {hint && <p className="mt-1 text-muted-foreground">{hint}</p>}
      <Button variant="outline" className="mt-3" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
