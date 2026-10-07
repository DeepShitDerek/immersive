"use client";

import { eachDayOfInterval, endOfYear, format, startOfYear } from "date-fns";
import type { Habit } from "@/types";
import { habitColor } from "./habit-color";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { describeSchedule, isDueOn } from "./habit-schedule";
import {
  bestStreak,
  completionRate,
  currentStreak,
  indexLogs,
  isSatisfiedOn,
} from "./habit-progress";

interface HabitHeatmapModalProps {
  habit: Habit | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (habit: Habit) => void;
  onArchive: (habit: Habit) => void;
}

export function HabitHeatmapModal({
  habit,
  isOpen,
  onClose,
  onEdit,
  onArchive,
}: HabitHeatmapModalProps) {
  if (!habit) return null;

  const today = new Date();
  const days = eachDayOfInterval({
    start: startOfYear(today),
    end: endOfYear(today),
  });

  const logIndex = indexLogs(habit);
  const streak = currentStreak(habit);
  const best = bestStreak(habit);
  const rate = completionRate(habit);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="size-3 rounded-full"
              style={{ backgroundColor: habitColor(habit) }}
            />
            {habit.title}
          </DialogTitle>
          <DialogDescription>
            {describeSchedule(habit)} · {streak} day streak · best {best} ·{" "}
            {rate}% over 30 days
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <div className="flex flex-wrap justify-center gap-1">
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const isDone = isSatisfiedOn(habit, logIndex, dateStr);
              const isFuture = day > today;

              return (
                <TooltipProvider key={dateStr} delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "size-3 rounded-[2px] transition-colors",
                          isFuture
                            ? "bg-muted/20"
                            : isDone
                              ? "opacity-100"
                              : "bg-muted",
                        )}
                        style={{
                          backgroundColor: isDone
                            ? habitColor(habit)
                            : undefined,
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      {format(day, "MMM do")}:{" "}
                      {isDone
                        ? "Done"
                        : isDueOn(habit, dateStr)
                          ? "Missed"
                          : "Not scheduled"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t pt-4">
          <Button variant="ghost" onClick={() => onArchive(habit)}>
            Archive
          </Button>
          <Button variant="outline" onClick={() => onEdit(habit)}>
            Edit habit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
