import { Flame } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A habit's current streak, the same everywhere: the
 * number, a flame, and words for screen readers. A live streak is success
 * (going well); none is quiet. It was a hand-rolled 10px chip in the chart
 * palette.
 */
export function StreakBadge({
  streak,
  className,
}: {
  streak: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-full px-2 py-0.5 text-micro font-semibold tabular-nums",
        streak > 0
          ? "bg-success/10 text-success"
          : "bg-muted text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden>{streak}</span>
      <Flame aria-hidden className="size-3.5" />
      <span className="sr-only">
        {streak === 1 ? "1-day streak" : `${streak}-day streak`}
      </span>
    </span>
  );
}
