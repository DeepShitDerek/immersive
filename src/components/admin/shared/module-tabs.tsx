"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ModuleTab<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  /** Tabs with the same group sit together; a gap separates the groups. */
  group?: number;
}

/**
 * A module's own sections, as underlined tabs under its header (workspace
 * contract, design-research/workspace-architecture.md §4).
 *
 * One look for every module's top-level sections. Money's ten areas were a
 * row of filled primary buttons, a second primary colour stacked above each
 * area's own segmented control (G4). Underlined tabs read as navigation, and
 * the segmented control below stays the second level.
 *
 * Groups (by how often they are used) are separated by a gap and a hairline.
 * On a narrow screen the row scrolls sideways; an edge fade shows there is
 * more, and the current tab scrolls into view, so "Transactions" is never
 * the half-word at the edge it was.
 *
 * Buttons, not links: the module owns its URL (`onSelect`), so a module can
 * keep other parameters as it changes section.
 */
export function ModuleTabs<T extends string>({
  label,
  tabs,
  current,
  onSelect,
  className,
}: {
  label: string;
  tabs: ModuleTab<T>[];
  current: T;
  onSelect: (id: T) => void;
  className?: string;
}) {
  const scroller = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft > 1,
      end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
    measure();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [current, measure]);

  return (
    <nav
      aria-label={label}
      className={cn("relative mb-6 border-b border-border", className)}
    >
      <ul
        ref={scroller}
        onScroll={measure}
        className="-mb-px flex items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab, index) => {
          const active = tab.id === current;
          const newGroup =
            index > 0 && (tab.group ?? 0) !== (tabs[index - 1].group ?? 0);
          return (
            <li key={tab.id} className="flex shrink-0 items-stretch">
              {newGroup && (
                <span
                  aria-hidden
                  className="mx-2 my-2.5 w-px self-stretch bg-border"
                />
              )}
              <button
                type="button"
                onClick={() => onSelect(tab.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-fast focus-ring",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {tab.icon && <tab.icon aria-hidden className="size-4" />}
                {tab.label}
              </button>
            </li>
          );
        })}
      </ul>
      {/* Scroll cues: the ground fading over the edge where there is more. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background transition-opacity duration-fast",
          edges.start ? "opacity-100" : "opacity-0",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background transition-opacity duration-fast",
          edges.end ? "opacity-100" : "opacity-0",
        )}
      />
    </nav>
  );
}
