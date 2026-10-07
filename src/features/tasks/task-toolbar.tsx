"use client";

import {
  Columns3,
  GanttChartSquare,
  ListTodo,
  Rows3,
  SlidersHorizontal,
  Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RemovableChip } from "@/components/ui/filter-chip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ModuleTab } from "@/components/admin/shared";
import { cn } from "@/lib/cn";
import type { TaskFilters, TaskGroupBy, TaskSortBy } from "./task-filters";

export type ViewMode = "board" | "list" | "table" | "timeline";

/** The views, as the module's tabs (workspace contract: one header recipe). */
export const VIEW_TABS: ModuleTab<ViewMode>[] = [
  { id: "list", label: "List", icon: ListTodo },
  { id: "board", label: "Board", icon: Columns3 },
  { id: "table", label: "Table", icon: Table2 },
  { id: "timeline", label: "Timeline", icon: GanttChartSquare },
];

const GROUP_OPTIONS: { value: TaskGroupBy; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "project", label: "Project" },
  { value: "due", label: "Due date" },
];

const SORT_OPTIONS: { value: TaskSortBy; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "created", label: "Newest" },
  { value: "title", label: "Title" },
];

export interface TaskToolbarProps {
  view: ViewMode;
  groupBy: TaskGroupBy;
  onGroupByChange: (groupBy: TaskGroupBy) => void;
  sortBy: TaskSortBy;
  onSortByChange: (sortBy: TaskSortBy) => void;
  filters: TaskFilters;
  onFiltersChange: (update: (current: TaskFilters) => TaskFilters) => void;
  tags: string[];
}

const SECTION = "mb-1.5 text-xs font-medium text-muted-foreground";

/**
 * One row: search, **Filters** (what to
 * show) and **Display** (how to show it).
 *
 * Group and Sort were two fixed-width selects that wrapped below `xl`, beside
 * a filter count that was the only trace of a filter once its popover shut.
 * Now the row cannot wrap, and every active filter shows as a chip you can
 * remove, so what you are looking at is always visible. Hiding completed
 * tasks is a display choice, not a filter, and lives under Display.
 */
export function TaskToolbar({
  view,
  groupBy,
  onGroupByChange,
  sortBy,
  onSortByChange,
  filters,
  onFiltersChange,
  tags,
}: TaskToolbarProps) {
  const chips = [
    filters.overdueOnly && {
      key: "overdue",
      label: "Overdue",
      clear: () => onFiltersChange((f) => ({ ...f, overdueOnly: false })),
    },
    filters.blockedOnly && {
      key: "blocked",
      label: "Blocked",
      clear: () => onFiltersChange((f) => ({ ...f, blockedOnly: false })),
    },
    filters.tag !== "all" && {
      key: "tag",
      label: `#${filters.tag}`,
      clear: () => onFiltersChange((f) => ({ ...f, tag: "all" })),
    },
  ].filter((chip): chip is { key: string; label: string; clear: () => void } =>
    Boolean(chip),
  );

  const grouped = view === "list" || view === "table";

  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="search"
          value={filters.search}
          onChange={(e) =>
            onFiltersChange((f) => ({ ...f, search: e.target.value }))
          }
          placeholder="Search tasks…"
          aria-label="Search tasks"
          className="min-w-0 flex-1"
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="shrink-0 gap-2">
              <SlidersHorizontal className="size-4" aria-hidden />
              <span className="max-sm:sr-only">Filters</span>
              {chips.length > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground">
                  {chips.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3">
            <fieldset className="space-y-2">
              <legend className={SECTION}>Show only</legend>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="filter-overdue"
                  checked={filters.overdueOnly}
                  onCheckedChange={() =>
                    onFiltersChange((f) => ({
                      ...f,
                      overdueOnly: !f.overdueOnly,
                    }))
                  }
                />
                <Label htmlFor="filter-overdue" className="text-sm font-normal">
                  Overdue
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="filter-blocked"
                  checked={filters.blockedOnly}
                  onCheckedChange={() =>
                    onFiltersChange((f) => ({
                      ...f,
                      blockedOnly: !f.blockedOnly,
                    }))
                  }
                />
                <Label htmlFor="filter-blocked" className="text-sm font-normal">
                  Blocked
                </Label>
              </div>
            </fieldset>

            {tags.length > 0 && (
              <div className="border-t pt-3">
                <p className={SECTION}>Tag</p>
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={filters.tag === tag}
                      onClick={() =>
                        onFiltersChange((f) => ({
                          ...f,
                          tag: f.tag === tag ? "all" : tag,
                        }))
                      }
                      className={cn(
                        "min-h-6 rounded-full px-2.5 py-0.5 text-sm transition-colors focus-ring",
                        filters.tag === tag
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="shrink-0 gap-2"
              aria-label="Display options"
            >
              <Rows3 className="size-4" aria-hidden />
              <span className="max-sm:sr-only">Display</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3">
            {grouped && (
              <div className="space-y-1">
                <Label htmlFor="task-group" className={SECTION}>
                  Group by
                </Label>
                <Select
                  value={groupBy}
                  onValueChange={(v) => onGroupByChange(v as TaskGroupBy)}
                >
                  <SelectTrigger id="task-group">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="task-sort" className={SECTION}>
                Sort by
              </Label>
              <Select
                value={sortBy}
                onValueChange={(v) => onSortByChange(v as TaskSortBy)}
              >
                <SelectTrigger id="task-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 border-t pt-3">
              <Checkbox
                id="display-show-done"
                checked={filters.showDone}
                onCheckedChange={() =>
                  onFiltersChange((f) => ({ ...f, showDone: !f.showDone }))
                }
              />
              <Label
                htmlFor="display-show-done"
                className="text-sm font-normal"
              >
                Show completed tasks
              </Label>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <RemovableChip
              key={chip.key}
              label={chip.label}
              onRemove={chip.clear}
            />
          ))}
          {chips.length > 1 && (
            <button
              type="button"
              className="rounded-control text-sm text-primary underline-offset-2 hover:underline focus-ring"
              onClick={() =>
                onFiltersChange((f) => ({
                  ...f,
                  overdueOnly: false,
                  blockedOnly: false,
                  tag: "all",
                }))
              }
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
