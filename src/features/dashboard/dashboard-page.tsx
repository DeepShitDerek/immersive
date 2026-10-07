"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowRight,
  Flame,
  Plus,
  Radio,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import type { DashboardData, Habit, Task } from "@/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/admin/shared";
import { useSetTaskStatus } from "@/features/tasks/use-task-status";
import {
  useAddTaskMutation,
  useGetCalendarSettingsQuery,
  useGetDashboardDataQuery,
  useSetHabitLogMutation,
} from "@/store/api/adminApi";
import { useGetMoneySettingsQuery } from "@/features/money/data/money-api";
import { LoadError } from "@/components/admin/shared";
import { HabitToday } from "@/features/habits/habit-today";
import {
  dueToday,
  indexLogs,
  isSatisfiedOn,
} from "@/features/habits/habit-progress";
import { todayIso } from "@/features/habits/habit-schedule";
import { useBelowBreakpoint } from "@/hooks/use-media-query";
import { formatMoney } from "@/lib/money";
import { getErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/cn";
import {
  nextUp,
  nowOffset,
  placeEvents,
  spineHours,
  untilLabel,
  windowHours,
} from "./day-plan";
import { cashflow, habitHeat } from "./metrics";
import { Heatmap, Sparkline } from "./charts";
import { DaySpine } from "./day-spine";
import { SetupChecklist } from "./setup-checklist-card";

/**
 * Home: what today asks of you, and what is next.
 *
 * The Today list is the page. Tasks due today, tasks overdue and today's
 * habits are one list, each ticked or logged where it is. Before, today's
 * tasks sat in a narrow rail under a decorative ring, and habits were chips
 * that could not be logged from here, the most frequent thing done daily.
 *
 * Around it: a line of what needs you now (next event, overdue, unread,
 * reviews), the next hours of the day, the week's money and the habit
 * momentum. On a phone the Today list comes first.
 */
export default function DashboardPage() {
  const {
    data,
    isLoading,
    error: loadError,
    refetch,
  } = useGetDashboardDataQuery();
  const { data: moneySettings } = useGetMoneySettingsQuery();
  const { data: calendarSettings } = useGetCalendarSettingsQuery();
  const narrow = useBelowBreakpoint("lg");
  const [wholeDay, setWholeDay] = useState(false);

  const currency = moneySettings?.baseCurrency ?? "CAD";
  // The day's bounds belong to Calendar.
  const startHour = calendarSettings?.day_start_hour ?? 7;
  const endHour = calendarSettings?.day_end_hour ?? 22;

  // "In 10 min" and the now line move while the page stays open.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const hours = wholeDay
      ? spineHours(now, startHour, endHour)
      : windowHours(now, startHour, endHour, narrow ? 3 : 6);
    return {
      hours,
      events: placeEvents(data.todaysEvents, hours, now),
      now: nowOffset(now, hours),
      next: nextUp(data.todaysEvents, now),
      money: cashflow(data, 7, now),
      heat: habitHeat(data.habits, 12, now),
    };
  }, [data, startHour, endHour, now, wholeDay, narrow]);

  if (loadError && !data) {
    return (
      <div className="space-y-4">
        <Greeting now={now} next={null} />
        <LoadError what="your day" error={loadError} onRetry={refetch} />
      </div>
    );
  }
  if (isLoading && !data) return <DashboardSkeleton now={now} />;
  if (!data || !view) {
    return (
      <div className="mx-auto max-w-prose py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Nothing to show yet: this needs a database connection.
        </p>
      </div>
    );
  }

  const counts = todayCounts(data, todayIso());
  const today = <TodayList data={data} />;
  const spine = (
    <DaySpine
      hours={view.hours}
      events={view.events}
      now={view.now}
      expanded={wholeDay}
      onToggle={() => setWholeDay((v) => !v)}
    />
  );
  const money = <MoneyCard money={view.money} currency={currency} />;
  const momentum = <MomentumCard heat={view.heat} />;
  // First run only, and gone once done. Above the day on a wide screen; on a
  // phone below it, so it never pushes Today off the first screen.
  const setup = <SetupChecklist />;

  return (
    <div className="space-y-5 pb-10">
      <Greeting now={now} next={view.next} />
      {!narrow && setup}

      {/* The day in four numbers; each opens the module it counts. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile href="/admin/tasks" label="Open tasks">
          <StatCard
            size="compact"
            title="Done today"
            value={`${counts.done}/${counts.total}`}
            helpText={counts.total === 0 ? "Nothing due" : "Tasks and habits"}
          />
        </Tile>
        <Tile href="/admin/tasks" label="Open overdue tasks">
          <StatCard
            size="compact"
            title="Overdue"
            value={data.overdueTasks.length}
            helpText={
              data.overdueTasks.length === 0
                ? "Nothing late"
                : "Tasks past their date"
            }
          />
        </Tile>
        <Tile href="/admin/inbox" label="Open the inbox">
          <StatCard
            size="compact"
            title="Unread"
            value={data.unreadMessages}
            helpText="Messages in the inbox"
          />
        </Tile>
        <Tile href="/admin/learning" label="Open Learning">
          <StatCard
            size="compact"
            title="To review"
            value={data.reviewsDue}
            helpText={
              data.reviewsDue === 0 ? "Nothing due" : "Topics due in Learning"
            }
          />
        </Tile>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="min-w-0">{today}</div>
        <div className="min-w-0">{spine}</div>
        <div className="min-w-0 space-y-5">
          {money}
          {momentum}
        </div>
      </div>

      {narrow && setup}
    </div>
  );
}

/** How much of today is done: tasks due today and today's habits. */
export function todayCounts(data: DashboardData, today: string) {
  const habits = dueToday(data.habits, today);
  return {
    total: data.tasksDueToday.length + data.overdueTasks.length + habits.length,
    done:
      data.tasksDueToday.filter((t) => t.status === "done").length +
      habits.filter((h) => isSatisfiedOn(h, indexLogs(h), today)).length,
  };
}

/** A number tile that is also the way into its module. */
function Tile({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="block rounded-surface transition-colors focus-ring [&>*]:h-full [&>*]:transition-colors hover:[&>*]:border-input"
    >
      {children}
    </Link>
  );
}

/* ── Header ──────────────────────────────────────────────────────────────── */

function Greeting({
  now,
  next,
}: {
  now: Date;
  next: ReturnType<typeof nextUp> | null;
}) {
  const hour = now.getHours();
  const part =
    hour < 5
      ? "Still up"
      : hour < 12
        ? "Morning"
        : hour < 18
          ? "Afternoon"
          : "Evening";
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {/* The time of day and date are the reader's, not the build's. */}
        <h1 className="t-heading" suppressHydrationWarning>
          {part}
        </h1>
        <p
          className="mt-0.5 text-sm text-muted-foreground"
          suppressHydrationWarning
        >
          {format(now, "EEEE d MMMM")}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {next && (
          <Link
            href="/admin/calendar"
            className="flex items-center gap-2.5 rounded-control border bg-card px-3 py-2 transition-colors hover:border-input focus-ring"
          >
            {next.happening ? (
              <Radio className="size-4 shrink-0 text-success" aria-hidden />
            ) : (
              <ArrowRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            )}
            <span className="min-w-0">
              <span className="block text-micro text-muted-foreground">
                {next.happening
                  ? "Happening now"
                  : untilLabel(next.minutesAway)}
              </span>
              <span className="block max-w-56 truncate text-sm font-medium text-foreground">
                {next.title}
              </span>
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {next.at}
            </span>
          </Link>
        )}
      </div>
    </header>
  );
}

/* ── Today ───────────────────────────────────────────────────────────────── */

/**
 * One checklist for the day: add a task, then what is overdue, what is due
 * today, and today's habits, each done where it is.
 */
function TodayList({ data }: { data: DashboardData }) {
  const router = useRouter();
  const setTaskStatus = useSetTaskStatus();
  const [addTask, { isLoading: adding }] = useAddTaskMutation();
  const [setHabitLog] = useSetHabitLogMutation();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());
  const today = todayIso();

  const habits = useMemo(
    () => dueToday(data.habits, today),
    [data.habits, today],
  );
  const overdue = data.overdueTasks;
  // Open first, then finished, the query's order within each.
  const dueTasks = useMemo(
    () =>
      [...data.tasksDueToday].sort(
        (a, b) => Number(a.status === "done") - Number(b.status === "done"),
      ),
    [data.tasksDueToday],
  );

  const { total, done } = todayCounts(data, today);

  const toggle = async (task: Task) => {
    setSaving((s) => new Set(s).add(task.id));
    await setTaskStatus(task, task.status === "done" ? "todo" : "done");
    setSaving((s) => {
      const next = new Set(s);
      next.delete(task.id);
      return next;
    });
  };

  const add = async () => {
    const title = draft.trim();
    if (!title) return;
    try {
      await addTask({ title, due_date: today, status: "todo" }).unwrap();
      setDraft("");
    } catch (err) {
      toast.error("Couldn't add the task", {
        description: getErrorMessage(err),
      });
    }
  };

  const logHabit = async (habit: Habit, value: number) => {
    try {
      await setHabitLog({ habit_id: habit.id, date: today, value }).unwrap();
    } catch (err) {
      toast.error("Couldn't record that", {
        description: getErrorMessage(err),
      });
    }
  };

  return (
    <section aria-labelledby="today" className="rounded-surface border bg-card">
      <div className="flex items-end justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
        <h2 id="today" className="text-base font-semibold">
          Today
        </h2>
        {total > 0 && (
          <p className="text-xs tabular-nums text-muted-foreground">
            {done} of {total} done
          </p>
        )}
      </div>
      {total > 0 && (
        <div
          role="progressbar"
          aria-label="Today's progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          className="mx-4 h-1 overflow-hidden rounded-full bg-secondary sm:mx-5"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-base"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      )}

      <form
        className="flex items-center gap-2 px-4 pt-3 sm:px-5"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a task for today…"
          aria-label="Add a task for today"
          maxLength={500}
          className="h-10"
        />
        <Button
          type="submit"
          variant="outline"
          size="icon"
          className="size-10 shrink-0"
          disabled={!draft.trim() || adding}
          aria-label="Add"
        >
          <Plus className="size-4" aria-hidden />
        </Button>
      </form>

      <div className="space-y-4 px-2 pb-4 pt-3 sm:px-3">
        {total === 0 && (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            Clear for today.
          </p>
        )}

        {overdue.length > 0 && (
          <TaskGroup label="Overdue">
            {overdue.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                saving={saving.has(task.id)}
                onToggle={toggle}
                overdue
              />
            ))}
          </TaskGroup>
        )}

        {dueTasks.length > 0 && (
          <TaskGroup label="Due today">
            {dueTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                saving={saving.has(task.id)}
                onToggle={toggle}
              />
            ))}
          </TaskGroup>
        )}

        {habits.length > 0 && (
          <div>
            <h3 className="mb-2 px-2 text-xs font-medium text-muted-foreground">
              Habits
            </h3>
            <div className="px-2">
              <HabitToday
                habits={habits}
                today={today}
                onSetValue={(habit, value) => void logHabit(habit, value)}
                onOpen={() => router.push("/admin/habits")}
              />
            </div>
          </div>
        )}

        <div className="flex gap-4 px-2 text-xs">
          <Link
            href="/admin/tasks"
            className="text-muted-foreground hover:text-foreground"
          >
            All tasks
          </Link>
          <Link
            href="/admin/habits"
            className="text-muted-foreground hover:text-foreground"
          >
            All habits
          </Link>
        </div>
      </div>
    </section>
  );
}

function TaskGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-1 px-2 text-xs font-medium text-muted-foreground">
        {label}
      </h3>
      <ul className="list-none space-y-0.5 p-0">{children}</ul>
    </div>
  );
}

function TaskRow({
  task,
  saving,
  overdue = false,
  onToggle,
}: {
  task: Task;
  saving: boolean;
  overdue?: boolean;
  onToggle: (task: Task) => void;
}) {
  const done = task.status === "done";
  return (
    <li>
      <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-control px-2 text-sm hover:bg-secondary/50">
        <Checkbox
          checked={done}
          disabled={saving}
          onCheckedChange={() => onToggle(task)}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            done ? "text-muted-foreground line-through" : "text-foreground",
          )}
        >
          {task.title}
        </span>
        {overdue && task.due_date && (
          <span className="shrink-0 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-micro text-warning">
            {format(new Date(`${task.due_date}T00:00:00`), "d MMM")}
          </span>
        )}
      </label>
    </li>
  );
}

/* ── Money and momentum ──────────────────────────────────────────────────── */

function MoneyCard({
  money,
  currency,
}: {
  money: ReturnType<typeof cashflow>;
  currency: string;
}) {
  const net = money.totalEarned - money.totalSpent;
  const positive = net >= 0;
  return (
    <Link
      href="/admin/finance"
      className="block overflow-hidden rounded-surface border bg-card p-4 transition-colors hover:border-input focus-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Last 7 days</p>
          {/* The same sign colours as Money: success for in, destructive for out. */}
          <p
            className={cn(
              "mt-0.5 truncate text-xl font-semibold tabular-nums",
              positive ? "text-success" : "text-destructive",
            )}
          >
            {formatMoney({ amount: net, currency }, { signed: true })}
          </p>
        </div>
        {positive ? (
          <TrendingUp className="size-4 shrink-0 text-success" aria-hidden />
        ) : (
          <TrendingDown
            className="size-4 shrink-0 text-destructive"
            aria-hidden
          />
        )}
      </div>
      <div className="relative mt-2" style={{ height: 40 }}>
        <div className="absolute inset-0">
          <Sparkline
            values={money.earned}
            className="text-success"
            height={40}
            label="Money in over the last seven days"
          />
        </div>
        <div className="absolute inset-0">
          <Sparkline
            values={money.spent}
            className="text-destructive"
            height={40}
            label="Money out over the last seven days"
          />
        </div>
      </div>
      <p className="mt-2 flex gap-3 text-micro text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="h-0.5 w-3 rounded-full bg-success" /> In
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="h-0.5 w-3 rounded-full bg-destructive" />{" "}
          Out
        </span>
      </p>
    </Link>
  );
}

function MomentumCard({
  heat,
}: {
  heat: { date: string; intensity: number }[];
}) {
  return (
    <Link
      href="/admin/habits"
      className="block rounded-surface border bg-card p-4 transition-colors hover:border-input focus-ring"
    >
      <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Flame className="size-3.5" aria-hidden />
        Habit momentum, 12 weeks
      </p>
      <Heatmap cells={heat} label="Habit consistency over twelve weeks" />
    </Link>
  );
}

/* ── Loading ─────────────────────────────────────────────────────────────── */

/** Shaped like the page, so it does not jump when the day arrives. */
function DashboardSkeleton({ now }: { now: Date }) {
  return (
    <div className="space-y-5 pb-10" aria-busy aria-label="Loading your day">
      <Greeting now={now} next={null} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-surface" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 rounded-surface border bg-card p-5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-surface" />
        <div className="space-y-5">
          <Skeleton className="h-32 w-full rounded-surface" />
          <Skeleton className="h-40 w-full rounded-surface" />
        </div>
      </div>
    </div>
  );
}
