"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  CalendarCheck2,
  ListChecks,
  MoreHorizontal,
  Plus,
  Table2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Habit } from "@/types";
import {
  useArchiveHabitMutation,
  useDeleteHabitMutation,
  useGetHabitsQuery,
  useSetHabitLogMutation,
  useUpdateHabitOrderMutation,
} from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUndoableDelete } from "@/hooks/use-undoable-delete";
import {
  EmptyState,
  FormSheet,
  LoadingState,
  ManagerWrapper,
  ModuleTabs,
  PageHeader,
  LoadError,
  type ModuleTab,
} from "@/components/admin/shared";
import { getErrorMessage } from "@/lib/utils";
import { HabitGrid } from "./habit-grid";
import { HabitForm } from "./habit-form";
import { HabitToday } from "./habit-today";
import { HabitHeatmapModal } from "./habit-heatmap-modal";
import { HabitStanding } from "./habit-standing";
import { todayIso } from "./habit-schedule";
import { dueToday, indexLogs, toggledValue } from "./habit-progress";

type HabitView = "today" | "week" | "archived";

const VIEW_TABS: ModuleTab<"today" | "week">[] = [
  { id: "today", label: "Today", icon: ListChecks },
  { id: "week", label: "History", icon: Table2 },
];

function BackToHistory({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 inline-flex items-center gap-1.5 rounded-control text-sm text-muted-foreground hover:text-foreground focus-ring"
    >
      <ArrowLeft aria-hidden className="size-4" />
      History
    </button>
  );
}

export default function HabitsPage() {
  const [view, setView] = useState<HabitView>("today");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [detailHabit, setDetailHabit] = useState<Habit | null>(null);

  const today = todayIso();

  // History needs the archived ones too, to offer "Show archived (n)".
  const {
    data: habits = [],
    isLoading,
    error: loadError,
    refetch,
  } = useGetHabitsQuery(
    view === "today" ? undefined : { includeArchived: true },
  );
  const [setHabitLog] = useSetHabitLogMutation();
  const [archiveHabit] = useArchiveHabitMutation();
  const [deleteHabit] = useDeleteHabitMutation();
  const [updateHabitOrder] = useUpdateHabitOrderMutation();

  /**
   * Persist the list's new order.
   *
   * No toast: the row moving is the confirmation, and one per click would be
   * noise on a list you might reorder several times in a row.
   */
  const handleReorder = async (habitIds: string[]) => {
    try {
      await updateHabitOrder(habitIds).unwrap();
    } catch (err) {
      toast.error("Could not save the new order", {
        description: getErrorMessage(err),
      });
    }
  };

  // Delete offers Undo instead of asking first. The delete runs when
  // the toast closes, so Undo restores the habit and every logged day.
  const { pending: deleting, remove: removeHabit } = useUndoableDelete<Habit>(
    async (habit) => {
      try {
        await deleteHabit(habit.id).unwrap();
      } catch (err) {
        toast.error("Couldn't delete the habit", {
          description: getErrorMessage(err),
        });
      }
    },
  );
  const active = useMemo(
    () =>
      habits.filter((habit) => !habit.archived_at && !deleting.has(habit.id)),
    [habits, deleting],
  );
  const archived = useMemo(
    () =>
      habits.filter((habit) => habit.archived_at && !deleting.has(habit.id)),
    [habits, deleting],
  );

  const todaysHabits = useMemo(() => dueToday(active, today), [active, today]);

  const handleSetValue = async (habit: Habit, value: number) => {
    try {
      await setHabitLog({
        habit_id: habit.id,
        date: today,
        value,
      }).unwrap();
    } catch (err) {
      toast.error("Couldn't record that", {
        description: getErrorMessage(err),
      });
    }
  };

  const handleToggleDate = async (habitId: string, date: string) => {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;
    try {
      await setHabitLog({
        habit_id: habitId,
        date,
        value: toggledValue(habit, indexLogs(habit), date),
      }).unwrap();
    } catch (err) {
      toast.error("Couldn't record that", {
        description: getErrorMessage(err),
      });
    }
  };

  /**
   * Archiving is the default retirement path. Deleting a habit destroys every
   * log it ever had, which is the one thing a tracker exists to keep.
   */
  const handleArchive = async (habit: Habit, archived: boolean) => {
    try {
      await archiveHabit({ id: habit.id, archived }).unwrap();
      toast.success(archived ? "Habit archived." : "Habit restored.");
    } catch (err) {
      toast.error("Couldn't update the habit", {
        description: getErrorMessage(err),
      });
    }
  };

  const handleDelete = (habit: Habit) => {
    const count = habit.habit_logs?.length ?? 0;
    removeHabit(
      habit,
      `Deleted "${habit.title}"`,
      count > 0
        ? `With its ${count} recorded day${count === 1 ? "" : "s"}.`
        : undefined,
    );
  };

  const openCreate = () => {
    setEditingHabit(null);
    setIsSheetOpen(true);
  };

  const openEdit = (habit: Habit) => {
    setEditingHabit(habit);
    setIsSheetOpen(true);
  };

  return (
    <ManagerWrapper>
      <PageHeader
        title="Habits"
        description="What you're keeping up, and how it's going."
        actions={
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="mr-2 size-4" aria-hidden /> New habit
          </Button>
        }
      />

      {/*
        The two views as the module's tabs: they
        were a small right-aligned toggle under the summary and read as a
        filter. Archived is not a third view of the same habits; it opens
        from the foot of History.
      */}
      <ModuleTabs
        label="Habit views"
        tabs={VIEW_TABS}
        current={view === "archived" ? "week" : view}
        onSelect={setView}
      />

      {!isLoading && active.length > 0 && view === "today" && (
        <HabitStanding habits={active} today={today} />
      )}

      {isLoading ? (
        <LoadingState variant="section" label="Loading habits" />
      ) : loadError && habits.length === 0 ? (
        <LoadError what="your habits" error={loadError} onRetry={refetch} />
      ) : view === "archived" ? (
        archived.length === 0 ? (
          <>
            <BackToHistory onClick={() => setView("week")} />
            <EmptyState
              icon={Archive}
              variant="bordered"
              title="Nothing archived"
              description="Archiving retires a habit without losing its history."
            />
          </>
        ) : (
          <>
            <BackToHistory onClick={() => setView("week")} />
            <h2 className="t-heading mb-3">Archived</h2>
            <ul className="divide-y rounded-surface border bg-card">
              {archived.map((habit) => (
                <li
                  key={habit.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <span className="min-w-0 flex-1 break-words text-sm font-medium">
                    {habit.title}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {habit.habit_logs?.length ?? 0} days recorded
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleArchive(habit, false)}
                  >
                    Restore
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Actions: ${habit.title}`}
                      >
                        <MoreHorizontal aria-hidden className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => handleDelete(habit)}
                      >
                        <Trash2 aria-hidden className="mr-2 size-4" />
                        Delete for good
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          </>
        )
      ) : active.length === 0 ? (
        <EmptyState
          icon={CalendarCheck2}
          variant="card"
          title="No habits yet"
          description="Add one to start. A habit can be a simple check-in, a count like eight glasses of water, or something you're trying to avoid."
          action={{ label: "New habit", onClick: openCreate, icon: Plus }}
        />
      ) : view === "today" ? (
        todaysHabits.length === 0 ? (
          <EmptyState
            icon={CalendarCheck2}
            variant="card"
            title="Nothing due today"
            description="None of your habits are scheduled for today. Check the history view to see how the week is going."
          />
        ) : (
          <HabitToday
            habits={todaysHabits}
            today={today}
            onSetValue={handleSetValue}
            onOpen={setDetailHabit}
          />
        )
      ) : (
        <>
          <HabitGrid
            habits={active}
            onToggle={handleToggleDate}
            onEdit={openEdit}
            onArchive={(habit) => handleArchive(habit, true)}
            onViewStats={setDetailHabit}
            onReorder={handleReorder}
          />
          {archived.length > 0 && (
            <button
              type="button"
              onClick={() => setView("archived")}
              className="mt-4 inline-flex items-center gap-1.5 rounded-control text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-ring"
            >
              <Archive aria-hidden className="size-4" />
              Show archived ({archived.length})
            </button>
          )}
        </>
      )}

      <FormSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        title={editingHabit ? "Edit habit" : "New habit"}
        description="How often it repeats, and what counts as done."
      >
        <HabitForm
          key={editingHabit?.id ?? "new"}
          habit={editingHabit}
          onSuccess={() => setIsSheetOpen(false)}
          onCancel={() => setIsSheetOpen(false)}
        />
      </FormSheet>

      <HabitHeatmapModal
        habit={detailHabit}
        isOpen={!!detailHabit}
        onClose={() => setDetailHabit(null)}
        onEdit={(habit) => {
          setDetailHabit(null);
          openEdit(habit);
        }}
        onArchive={(habit) => {
          setDetailHabit(null);
          handleArchive(habit, true);
        }}
      />
    </ManagerWrapper>
  );
}
