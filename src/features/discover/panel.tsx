import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PanelState = "loading" | "done" | "failed";

/**
 * One panel for every Discover source:
 * a title, an optional note or action on the right, the body, and the same
 * words for loading, a silent source and an empty answer. Discover had two
 * local Panel components with different padding and headers, and several
 * panels with their own.
 *
 * `flush` is for a list of rows that runs edge to edge under the header.
 * A hairline border, not a shadow: a panel holds things, it is not one.
 */
export function Panel({
  title,
  note,
  action,
  state = "done",
  empty = false,
  emptyText = "Nothing cleared the bar in this window.",
  flush = false,
  className,
  children,
}: {
  title: string;
  note?: ReactNode;
  action?: ReactNode;
  state?: PanelState;
  empty?: boolean;
  emptyText?: string;
  flush?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const pad = "px-4";
  return (
    <section
      className={cn(
        "overflow-hidden rounded-surface border bg-card",
        className,
      )}
    >
      <header
        className={cn(
          "flex items-baseline justify-between gap-3 pb-2 pt-3.5",
          pad,
        )}
      >
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>

      {state === "loading" && (
        <p className={cn("pb-4 text-sm text-muted-foreground", pad)}>
          Reading…
        </p>
      )}
      {state === "failed" && (
        <p className={cn("pb-4 text-sm text-muted-foreground", pad)}>
          {/* Named, so you know whether to wait or to investigate. */}
          {title} did not answer. The service may be down, or the request may
          have been blocked.
        </p>
      )}
      {state === "done" && empty && (
        <p className={cn("pb-4 text-sm text-muted-foreground", pad)}>
          {emptyText}
        </p>
      )}
      {state === "done" && !empty && (
        <div className={cn(!flush && "px-4 pb-4")}>{children}</div>
      )}
    </section>
  );
}
