"use client";

import { CheckSquare, ChevronDown, Coins, Flame, Layers } from "lucide-react";
import type { CalendarSettings } from "@/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";

/**
 * Which of the three overlays the grid is drawing.
 *
 * The calendar shows four kinds of thing: events, tasks due, habits done and
 * money. Only events come from the calendars themselves. The other three were
 * a row of filled chips in the header, which wrapped the header onto a second
 * line on a laptop and said nothing about which colour on the grid was which.
 *
 * Now one "Overlays" menu: a checkbox each, and beside each the swatch the
 * grid draws it in, so the menu is also the legend. The trigger says how
 * many are on, so the off state stays legible without opening it.
 *
 * Events are not in it: they are toggled per calendar, in the panel.
 */
export const OVERLAYS = [
  {
    key: "show_tasks" as const,
    label: "Tasks",
    icon: CheckSquare,
    hint: "on the day they are due",
    // Matches entry-color.ts: the grid draws tasks in chart-4.
    swatch: "bg-chart-4",
  },
  {
    key: "show_habits" as const,
    label: "Habits",
    icon: Flame,
    hint: "what you completed each day",
    swatch: "bg-chart-2",
  },
  {
    key: "show_finance" as const,
    label: "Money",
    icon: Coins,
    hint: "in and out, and what is due",
    swatch: "bg-chart-3",
  },
];

export function OverlaysMenu({
  settings,
  onChange,
}: {
  settings: CalendarSettings | undefined;
  onChange: (patch: Partial<CalendarSettings>) => void;
}) {
  const isOn = (key: (typeof OVERLAYS)[number]["key"]) =>
    settings ? Boolean(settings[key]) : key === "show_tasks";
  const count = OVERLAYS.filter((o) => isOn(o.key)).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          disabled={!settings}
          aria-label={`Overlays, ${count} of ${OVERLAYS.length} on`}
        >
          <Layers className="size-4 sm:mr-1.5" aria-hidden />
          <span className="hidden sm:inline">Overlays</span>
          <span className="ml-1 tabular-nums text-muted-foreground">
            {count}
          </span>
          <ChevronDown className="ml-1 hidden size-3.5 sm:block" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Show on the calendar
        </DropdownMenuLabel>
        {OVERLAYS.map((overlay) => {
          const Icon = overlay.icon;
          return (
            <DropdownMenuCheckboxItem
              key={overlay.key}
              checked={isOn(overlay.key)}
              // Keep the menu open: trying two overlays is one gesture.
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(on) => onChange({ [overlay.key]: on })}
            >
              <span
                aria-hidden
                className={cn(
                  "mr-2 size-2.5 shrink-0 rounded-full",
                  overlay.swatch,
                )}
              />
              <Icon
                className="mr-1.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0">
                {overlay.label}
                <span className="block text-xs text-muted-foreground">
                  {overlay.hint}
                </span>
              </span>
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
