"use client";

import { useEffect, useMemo, useRef } from "react";
import { format, isSameDay, subDays } from "date-fns";
import { CalendarCheck2 } from "lucide-react";
import type { Habit } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/admin/shared";
import { useResponsiveDays } from "@/hooks/use-responsive-days";
import { cn } from "@/lib/utils";
import { HabitRow } from "./habit-row";
import { moveBy } from "@/lib/reorder";

interface HabitGridProps {
  habits: Habit[];
  onToggle: (habitId: string, date: string) => void;
  onEdit: (habit: Habit) => void;
  onArchive: (habit: Habit) => void;
  onViewStats: (habit: Habit) => void;
  /** The list's full new order after a habit was moved. */
  onReorder: (habitIds: string[]) => void;
}

export function HabitGrid({
  habits,
  onToggle,
  onEdit,
  onArchive,
  onViewStats,
  onReorder,
}: HabitGridProps) {
  const daysToShow = useResponsiveDays();

  const move = (habit: Habit, direction: -1 | 1) => {
    const next = moveBy(
      habits.map((entry) => entry.id),
      habit.id,
      direction,
    );
    if (next) onReorder(next);
  };
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const dates = useMemo(() => {
    return Array.from({ length: daysToShow }).map((_, i) =>
      subDays(new Date(), daysToShow - 1 - i),
    );
  }, [daysToShow]);

  // Auto-scroll to today (rightmost column) on load or when days change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollLeft = scrollAreaRef.current.scrollWidth;
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [habits, daysToShow]);

  return (
    <div className="overflow-hidden rounded-surface bg-card shadow-e1">
      <ScrollArea className="w-full whitespace-nowrap">
        <div
          className="inline-block min-w-full align-middle"
          ref={scrollAreaRef}
        >
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-b hover:bg-transparent">
                <TableHead className="sticky left-0 z-sticky h-12 w-[120px] min-w-[120px] border-r bg-card/95 pl-4 backdrop-blur sm:w-[160px] sm:min-w-[160px]">
                  Habit
                </TableHead>
                {dates.map((date) => (
                  <TableHead
                    key={date.toString()}
                    className="h-12 w-11 min-w-[44px] p-0 text-center align-middle font-normal"
                  >
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <span className="text-micro uppercase text-muted-foreground">
                        {format(date, "EEE")}
                      </span>
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                          isSameDay(date, new Date())
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground/80",
                        )}
                      >
                        {format(date, "d")}
                      </span>
                    </div>
                  </TableHead>
                ))}
                <TableHead className="sticky right-0 z-sticky w-[60px] min-w-[60px] border-l bg-card/95 text-center backdrop-blur">
                  Stats
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {habits.map((habit, index) => (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  dates={dates}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onArchive={onArchive}
                  onViewStats={onViewStats}
                  onMove={move}
                  canMoveUp={index > 0}
                  canMoveDown={index < habits.length - 1}
                />
              ))}
              {habits.length === 0 && (
                <TableRow>
                  <TableCell colSpan={daysToShow + 2} className="p-0">
                    <EmptyState
                      icon={CalendarCheck2}
                      title="No habits yet"
                      description="Create a habit to start building streaks."
                      size="compact"
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
