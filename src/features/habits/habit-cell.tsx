"use client";

import React from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HabitCellProps {
  dateStr: string;
  isCompleted: boolean;
  /** False on days the habit is not due, which are not misses. */
  isScheduled: boolean;
  color: string;
  onToggle: () => void;
  isToday: boolean;
  /**
   * For a count habit short of its target: how far, and the words for it
   * ("3 of 8"). A partial day was drawn exactly like an untouched one.
   */
  partial?: { ratio: number; label: string } | null;
}

// Strict equality check so toggling one cell doesn't re-render the whole grid
const arePropsEqual = (prev: HabitCellProps, next: HabitCellProps) => {
  return (
    prev.isCompleted === next.isCompleted &&
    prev.isScheduled === next.isScheduled &&
    prev.color === next.color &&
    prev.dateStr === next.dateStr &&
    prev.isToday === next.isToday &&
    prev.partial?.ratio === next.partial?.ratio
  );
};

export const HabitCell = React.memo(
  ({
    dateStr,
    isCompleted,
    isScheduled,
    color,
    onToggle,
    isToday,
    partial,
  }: HabitCellProps) => {
    // The local day. `new Date("2026-10-01")` is UTC midnight, which west of
    // UTC is the evening before: every label and tooltip named the wrong day.
    const day = new Date(`${dateStr}T00:00:00`);
    const dateLabel = format(day, "MMM do");

    return (
      <div className="relative flex h-14 w-full items-center justify-center">
        {isToday && (
          <div className="absolute inset-x-0.5 inset-y-1 -z-10 rounded-md bg-primary/5" />
        )}

        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                whileTap={{ scale: 0.8 }}
                onClick={onToggle}
                aria-label={`Mark ${dateLabel} as ${isCompleted ? "incomplete" : "complete"}${partial ? ` (${partial.label} so far)` : ""}`}
                className={cn(
                  "flex size-8 items-center justify-center rounded-[8px] border transition-all duration-base focus-ring",
                  isCompleted
                    ? "border-transparent text-white shadow-e1"
                    : "border-border/40 bg-transparent hover:border-primary/30 hover:bg-secondary/50",
                )}
                style={{
                  // habit.color is per-habit user data from the DB, not a theme token.
                  // A partial day is the colour at its share of the target,
                  // over the ground, so "nearly there" is visibly not "nothing".
                  backgroundColor: isCompleted
                    ? color
                    : partial
                      ? `color-mix(in srgb, ${color} ${Math.round(15 + partial.ratio * 45)}%, transparent)`
                      : undefined,
                  boxShadow: isCompleted
                    ? `0 2px 8px -2px ${color}60`
                    : undefined,
                }}
              >
                <motion.div
                  initial={false}
                  animate={{
                    scale: isCompleted ? 1 : 0,
                    opacity: isCompleted ? 1 : 0,
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  <Check className="size-4 stroke-[3.5px]" />
                </motion.div>
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px] p-3">
              <div className="space-y-1">
                <p className="text-sm font-bold">{dateLabel}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div
                    className={cn(
                      "size-2 rounded-full",
                      // Not done yet is not an alarm: quiet, not red.
                      isCompleted ? "bg-success" : "bg-muted-foreground/50",
                    )}
                  />
                  {isCompleted
                    ? "Completed"
                    : partial
                      ? `${partial.label} so far`
                      : "Not done"}
                </div>
                {isCompleted && (
                  <p className="mt-1 border-t border-border/50 pt-1 text-micro opacity-70">
                    Marked done {formatDistanceToNow(day)} ago
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  },
  arePropsEqual,
);

HabitCell.displayName = "HabitCell";
