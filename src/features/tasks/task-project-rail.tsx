"use client";

import { Plus, Settings2 } from "lucide-react";
import type { TaskProject } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type ProjectSelection = string | "all" | "none";

export interface TaskProjectRailProps {
  projects: TaskProject[];
  /** Task count per project id. */
  counts: Map<string, number>;
  totalCount: number;
  unassignedCount: number;
  selected: ProjectSelection;
  onSelect: (selection: ProjectSelection) => void;
  onManage: () => void;
}

interface RailItemProps {
  label: string;
  count: number;
  color?: string | null;
  active: boolean;
  onClick: () => void;
}

function RailItem({ label, count, color, active, onClick }: RailItemProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex w-full min-w-0 items-center gap-2 whitespace-nowrap rounded-control px-2.5 py-1.5 text-left text-sm transition-colors focus-ring",
          active
            ? "bg-secondary font-medium text-foreground"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-full",
            !color && "border border-current opacity-40",
          )}
          style={color ? { backgroundColor: color } : undefined}
        />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="shrink-0 text-xs tabular-nums opacity-70">
          {count}
        </span>
      </button>
    </li>
  );
}

/**
 * Projects as navigation rather than as one more filter chip.
 *
 * Three stacked chip rows made projects, the refine toggles and the group-by
 * control all look like the same kind of thing. Projects are the structural
 * axis — the thing a task belongs to — so they get a persistent rail, which is
 * also how the tools this was modelled on present them.
 *
 * One component at every width: a column beside the content on large screens,
 * a horizontal scroller above it on small ones. It reflows rather than being
 * swapped for a different control behind a breakpoint.
 */
export function TaskProjectRail({
  projects,
  counts,
  totalCount,
  unassignedCount,
  selected,
  onSelect,
  onManage,
}: TaskProjectRailProps) {
  return (
    <nav aria-label="Projects" className="shrink-0 lg:w-52 lg:border-r lg:pr-4">
      <div className="mb-2 hidden items-center justify-between lg:flex">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Projects
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={onManage}
          aria-label="Manage projects"
        >
          <Settings2 className="size-3.5" aria-hidden />
        </Button>
      </div>

      <ul className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col lg:overflow-x-visible">
        <RailItem
          label="All tasks"
          count={totalCount}
          active={selected === "all"}
          onClick={() => onSelect("all")}
        />
        {projects.map((project) => (
          <RailItem
            key={project.id}
            label={project.name}
            count={counts.get(project.id) ?? 0}
            color={project.color}
            active={selected === project.id}
            onClick={() => onSelect(project.id)}
          />
        ))}
        <RailItem
          label="No project"
          count={unassignedCount}
          active={selected === "none"}
          onClick={() => onSelect("none")}
        />

        {/* Reachable at every width: on small screens the header row above is
            hidden, so this is the only way in. */}
        <li className="shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onManage}
            className="w-full justify-start whitespace-nowrap px-2.5 text-muted-foreground"
          >
            <Plus className="mr-2 size-3.5" aria-hidden />
            New project
          </Button>
        </li>
      </ul>
    </nav>
  );
}
