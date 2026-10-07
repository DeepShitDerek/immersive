import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The one busy indicator for admin surfaces.
 *
 * Every module used to hand-roll this, and they had drifted: spinners appeared
 * at `size-6`, `size-8`, `size-10`, `h-8 w-8` and `h-12 w-12`, in
 * `text-muted-foreground` and `text-muted-foreground/30`, inside containers
 * ranging from a bare flex row to `h-[calc(100vh-20rem)]`. Same state, five
 * different appearances depending on which page you were on.
 *
 * Button-level spinners are deliberately out of scope — a `<Loader2>` inside a
 * submit button is a different thing and stays inline at the call site.
 */

type LoadingVariant = "page" | "section" | "inline";

const VARIANTS: Record<LoadingVariant, { wrapper: string; icon: string }> = {
  /** A module's main body while its first query resolves. */
  page: { wrapper: "min-h-[24rem]", icon: "size-8" },
  /** A panel or card inside an already-rendered page. */
  section: { wrapper: "min-h-[12rem]", icon: "size-6" },
  /** Flows with surrounding content; adds no vertical space of its own. */
  inline: { wrapper: "py-6", icon: "size-5" },
};

export interface LoadingStateProps {
  variant?: LoadingVariant;
  /** Announced to screen readers and shown beneath the spinner when set. */
  label?: string;
  className?: string;
}

export default function LoadingState({
  variant = "page",
  label,
  className,
}: LoadingStateProps) {
  const { wrapper, icon } = VARIANTS[variant];

  return (
    <div
      // `status` + `aria-busy` means assistive tech announces the wait instead
      // of reporting an empty region.
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "flex w-full flex-col items-center justify-center gap-3",
        wrapper,
        className,
      )}
    >
      <Loader2 className={cn("animate-spin text-muted-foreground", icon)} />
      {label ? (
        <p className="text-sm text-muted-foreground">{label}</p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}
