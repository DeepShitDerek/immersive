"use client";

import React, { useMemo } from "react";
import { format } from "date-fns";
import confetti from "canvas-confetti";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  BarChart2,
  Edit2,
  MoreVertical,
} from "lucide-react";
import type { Habit } from "@/types";
import { habitColor } from "./habit-color";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  currentStreak,
  completionRate,
  indexLogs,
  progressOn,
  isSatisfiedOn,
} from "./habit-progress";
import { isDueOn } from "./habit-schedule";
import { HabitCell } from "./habit-cell";
import { StreakBadge } from "./habit-streak";

interface HabitRowProps {
  habit: Habit;
  dates: Date[];
  onToggle: (habitId: string, date: string) => void;
  onEdit: (habit: Habit) => void;
  onArchive: (habit: Habit) => void;
  onViewStats: (habit: Habit) => void;
  /**
   * Move this habit one place up or down the list.
   *
   * Buttons rather than dragging: a table row is an awkward drag target, and
   * drag as the only way to reorder cannot be done from a keyboard at all.
   */
  onMove: (habit: Habit, direction: -1 | 1) => void;
  /** Disables the direction that would run off the end of the list. */
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export const HabitRow = React.memo(
  ({
    habit,
    dates,
    onToggle,
    onEdit,
    onArchive,
    onViewStats,
    onMove,
    canMoveUp,
    canMoveDown,
  }: HabitRowProps) => {
    // Computed against the schedule: the old helper counted calendar days, so
    // anything but a daily habit reported a broken streak and a depressed rate.
    const streak = useMemo(() => currentStreak(habit), [habit]);
    const rate = useMemo(() => completionRate(habit), [habit]);
    const logIndex = useMemo(() => indexLogs(habit), [habit]);

    /** A count habit's progress on a day it is short of its target. */
    const partialOn = (dateStr: string) => {
      if ((habit.kind ?? "build") === "quit") return null;
      const day = progressOn(habit, logIndex, dateStr);
      return day.value > 0 && !day.satisfied
        ? { ratio: day.ratio, label: `${day.value} of ${day.target}` }
        : null;
    };
    const isSatisfied = (dateStr: string) =>
      isSatisfiedOn(habit, logIndex, dateStr);

    const handleCheck = (dateStr: string) => {
      const isAlreadyDone = isSatisfied(dateStr);
      if (!isAlreadyDone) {
        confetti({
          particleCount: 50,
          spread: 80,
          origin: { y: 0.6 },
          colors: [habitColor(habit), "#ffffff"],
          disableForReducedMotion: true,
        });
      }
      onToggle(habit.id, dateStr);
    };

    return (
      <TableRow className="hover:bg-muted/20">
        {/* Sticky habit-name column */}
        <TableCell
          className="sticky left-0 z-raised w-[120px] min-w-[120px] border-r bg-card/95 p-3 backdrop-blur sm:w-[160px] sm:min-w-[160px]"
          onClick={() => onViewStats(habit)}
        >
          <div className="flex h-full cursor-pointer flex-col justify-center gap-0.5">
            <p className="truncate text-sm font-semibold text-foreground">
              {habit.title}
            </p>
            <p className="text-micro tabular-nums text-muted-foreground">
              {/* Nullable column — without a fallback this read as "/wk". */}
              {habit.target_per_week ?? 7}/wk • {rate}%
            </p>
          </div>
        </TableCell>

        {dates.map((date) => {
          const dateStr = format(date, "yyyy-MM-dd");
          return (
            <TableCell
              key={dateStr}
              className="w-11 min-w-[44px] p-0 text-center"
            >
              <HabitCell
                dateStr={dateStr}
                isCompleted={isSatisfied(dateStr)}
                partial={partialOn(dateStr)}
                // A day the habit was never due is not a miss, and shading it
                // like one is what made every non-daily habit look neglected.
                isScheduled={isDueOn(habit, dateStr)}
                color={habitColor(habit)}
                onToggle={() => handleCheck(dateStr)}
                isToday={date.toDateString() === new Date().toDateString()}
              />
            </TableCell>
          );
        })}

        {/* Sticky stats column */}
        <TableCell className="sticky right-0 z-raised w-[60px] min-w-[60px] border-l bg-card/95 px-1 backdrop-blur">
          <div className="flex items-center justify-center gap-1">
            <StreakBadge streak={streak} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Habit actions"
                  className="h-6 w-6 rounded-full text-muted-foreground"
                >
                  <MoreVertical className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onViewStats(habit)}>
                  <BarChart2 className="mr-2 size-3.5" /> Analytics
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(habit)}>
                  <Edit2 className="mr-2 size-3.5" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canMoveUp}
                  onClick={() => onMove(habit, -1)}
                >
                  <ArrowUp className="mr-2 size-3.5" /> Move up
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canMoveDown}
                  onClick={() => onMove(habit, 1)}
                >
                  <ArrowDown className="mr-2 size-3.5" /> Move down
                </DropdownMenuItem>
                {/* Archive, not delete: deleting destroys every log the
                    habit ever had. Deletion lives in the archived view. */}
                <DropdownMenuItem onClick={() => onArchive(habit)}>
                  <Archive className="mr-2 size-3.5" /> Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>
    );
  },
);

HabitRow.displayName = "HabitRow";
