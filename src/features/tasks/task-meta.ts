import {
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  SignalHigh,
  SignalLow,
  SignalMedium,
  type LucideIcon,
} from "lucide-react";
import type { Task } from "@/types";

export type TaskStatus = NonNullable<Task["status"]>;
export type TaskPriority = NonNullable<Task["priority"]>;

export const TASK_STATUSES: TaskStatus[] = [
  "todo",
  "inprogress",
  "review",
  "done",
];

interface StatusMeta {
  label: string;
  icon: LucideIcon;
  /** Status dot — token-based so every theme preset keeps semantic color. */
  dot: string;
  /** Interactive pill surface (status dropdown trigger). */
  pill: string;
}

export const TASK_STATUS_META: Record<TaskStatus, StatusMeta> = {
  todo: {
    label: "To Do",
    icon: Circle,
    dot: "bg-muted-foreground/40",
    pill: "bg-secondary text-muted-foreground hover:bg-secondary/80",
  },
  inprogress: {
    label: "In Progress",
    icon: Clock,
    dot: "bg-primary",
    pill: "bg-primary/15 text-primary hover:bg-primary/25",
  },
  review: {
    label: "In Review",
    icon: Eye,
    dot: "bg-chart-4",
    pill: "bg-chart-4/15 text-chart-4 hover:bg-chart-4/25",
  },
  done: {
    label: "Done",
    icon: CheckCircle2,
    dot: "bg-chart-2",
    pill: "bg-chart-2/15 text-chart-2 hover:bg-chart-2/25",
  },
};

interface PriorityMeta {
  label: string;
  icon: LucideIcon;
  /** Interactive pill surface (priority dropdown trigger). */
  pill: string;
  /** Left-edge accent on board cards. */
  edge: string;
}

export const TASK_PRIORITY_META: Record<TaskPriority, PriorityMeta> = {
  low: {
    label: "Low",
    icon: SignalLow,
    pill: "bg-secondary text-muted-foreground",
    edge: "border-l-muted-foreground/30",
  },
  medium: {
    label: "Medium",
    icon: SignalMedium,
    pill: "bg-chart-3/15 text-chart-3",
    edge: "border-l-chart-3",
  },
  high: {
    label: "High",
    icon: SignalHigh,
    pill: "bg-destructive/15 text-destructive",
    edge: "border-l-destructive",
  },
};
