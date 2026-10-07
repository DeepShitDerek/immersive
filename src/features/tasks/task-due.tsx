import { AlertCircle, CalendarDays, Clock } from "lucide-react";
import type { Task } from "@/types";
import { cn } from "@/lib/cn";
import { isDueToday, isOverdue } from "./task-filters";

/** `2026-06-15` → `15 Jun`, without constructing a zone-shifted Date. */
export function formatDueDate(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  if (!month || !day) return iso;
  return `${day} ${months[month - 1]}`;
}

/**
 * A task's due date with its state (workspace contract: one status
 * language): overdue in the danger colour with an alert icon and the word
 * for screen readers, due today as "Today" in the warning colour, otherwise
 * the plain date. Every view draws it from here, so a list, a card and a
 * table cannot disagree, and none says "late" with colour alone (1.4.1).
 */
export function TaskDue({
  task,
  icon = true,
  className,
}: {
  task: Pick<Task, "due_date" | "status">;
  icon?: boolean;
  className?: string;
}) {
  if (!task.due_date) return null;
  const overdue = isOverdue(task as Task);
  const today = !overdue && isDueToday(task as Task);
  const Icon = overdue ? AlertCircle : today ? Clock : CalendarDays;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap",
        overdue && "font-medium text-destructive",
        today && "font-medium text-warning",
        className,
      )}
    >
      {icon && <Icon aria-hidden className="size-3.5 shrink-0" />}
      {today ? "Today" : formatDueDate(task.due_date)}
      {overdue && <span className="sr-only"> (overdue)</span>}
    </span>
  );
}
