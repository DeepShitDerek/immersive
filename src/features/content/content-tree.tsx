"use client";

import { ReorderButtons } from "@/components/admin/shared";
import { useState, type DragEvent } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Home,
  LayoutTemplate,
  Plus,
} from "lucide-react";
import type { PortfolioSection } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface TreePage {
  path: string;
  label: string;
  sections: PortfolioSection[];
}

/**
 * The content tree — pages, each expanding to its ordered sections.
 *
 * This is the module's navigation, and it stays on screen: selecting a section
 * swaps the editor beside it rather than replacing the screen, so there is no
 * back step and no loss of place. Which is why sections live *under* their page
 * here — the hierarchy is the thing you navigate by.
 *
 * Drag reorders a section within its page, or moves it to another page by
 * dropping on that page's header. Dragging is pointer-only, so the same two
 * operations are also on every row's menu — see `SectionTreeRow`.
 */
export function ContentTree({
  pages,
  selectedSectionId,
  onSelectSection,
  onNewSection,
  onReorder,
  onMoveToPage,
  onPreviewPage,
}: {
  pages: TreePage[];
  selectedSectionId: string | null;
  onSelectSection: (id: string) => void;
  onNewSection: (path: string) => void;
  /** Show the whole page as the site draws it. */
  onPreviewPage: (path: string) => void;
  onReorder: (sectionId: string, targetSectionId: string) => void;
  onMoveToPage: (sectionId: string, path: string) => void;
}) {
  const selectedPath = pages.find((p) =>
    p.sections.some((s) => s.id === selectedSectionId),
  )?.path;

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });

  const endDrag = () => {
    setDraggedId(null);
    setDropTarget(null);
  };

  return (
    <nav aria-label="Pages and sections" className="space-y-1">
      {pages.map((page) => {
        const isCollapsed =
          collapsed.has(page.path) && page.path !== selectedPath;
        const PageIcon = page.path === "/" ? Home : LayoutTemplate;
        const emptyCount = page.sections.filter(
          (s) =>
            s.type !== "markdown" && (s.portfolio_items?.length ?? 0) === 0,
        ).length;

        return (
          <div key={page.path}>
            <div
              onDragOver={(e) => {
                if (!draggedId) return;
                e.preventDefault();
                setDropTarget(page.path);
              }}
              onDragLeave={() =>
                setDropTarget((t) => (t === page.path ? null : t))
              }
              onDrop={() => {
                if (draggedId) onMoveToPage(draggedId, page.path);
                endDrag();
              }}
              className={cn(
                "flex items-center gap-1 rounded-control pr-1",
                dropTarget === page.path && "bg-primary/10 ring-1 ring-primary",
              )}
            >
              <button
                type="button"
                onClick={() => toggle(page.path)}
                aria-expanded={!isCollapsed}
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded-control px-2 py-1.5 text-left text-sm font-medium transition-colors hover:bg-secondary focus-ring"
              >
                {isCollapsed ? (
                  <ChevronRight
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                ) : (
                  <ChevronDown
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                )}
                <PageIcon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="truncate">{page.label}</span>
                <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                  {page.sections.length}
                </span>
                {emptyCount > 0 && (
                  <AlertTriangle
                    className="size-3 shrink-0 text-warning"
                    aria-label={`${emptyCount} empty section${emptyCount === 1 ? "" : "s"}`}
                  />
                )}
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={() => onPreviewPage(page.path)}
                aria-label={`Preview ${page.label}`}
                title="Preview the whole page"
              >
                <Eye className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={() => onNewSection(page.path)}
                aria-label={`New section on ${page.label}`}
                title="New section on this page"
              >
                <Plus className="size-3.5" />
              </Button>
            </div>

            {!isCollapsed && (
              <ul className="ml-3 mt-0.5 space-y-0.5 border-l pl-2">
                {page.sections.length === 0 ? (
                  <li className="px-2 py-1.5 text-xs text-muted-foreground">
                    No sections yet
                  </li>
                ) : (
                  page.sections.map((section, index) => (
                    <SectionTreeRow
                      key={section.id}
                      section={section}
                      // Moving without dragging (WCAG 2.5.7).
                      onMoveUp={
                        index > 0
                          ? () =>
                              onReorder(section.id, page.sections[index - 1].id)
                          : undefined
                      }
                      onMoveDown={
                        index < page.sections.length - 1
                          ? () =>
                              onReorder(section.id, page.sections[index + 1].id)
                          : undefined
                      }
                      selected={section.id === selectedSectionId}
                      isDragging={draggedId === section.id}
                      isDropTarget={dropTarget === section.id}
                      onSelect={() => onSelectSection(section.id)}
                      onDragStart={() => setDraggedId(section.id)}
                      onDragEnd={endDrag}
                      onDragOver={(e: DragEvent) => {
                        if (!draggedId || draggedId === section.id) return;
                        e.preventDefault();
                        setDropTarget(section.id);
                      }}
                      onDrop={() => {
                        if (draggedId) onReorder(draggedId, section.id);
                        endDrag();
                      }}
                    />
                  ))
                )}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function SectionTreeRow({
  section,
  selected,
  isDragging,
  isDropTarget,
  onSelect,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onMoveUp,
  onMoveDown,
}: {
  section: PortfolioSection;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  selected: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: () => void;
}) {
  const hidden = section.is_visible === false;
  const empty =
    section.type !== "markdown" && (section.portfolio_items?.length ?? 0) === 0;

  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "group flex items-center rounded-control",
        isDragging && "opacity-40",
        isDropTarget && "ring-1 ring-primary",
      )}
    >
      <GripVertical
        className="size-3.5 shrink-0 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 rounded-control px-2 py-1.5 text-left text-sm transition-colors",
          "focus-ring",
          selected
            ? "bg-primary/10 font-medium text-primary"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        <span className="truncate">{section.title}</span>
        {hidden && (
          <EyeOff
            className="size-3 shrink-0"
            aria-label="Hidden on the public site"
          />
        )}
        {empty && (
          <AlertTriangle
            className="size-3 shrink-0 text-warning"
            aria-label="Empty — skipped on the public site"
          />
        )}
      </button>
      <ReorderButtons
        name={section.title}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
    </li>
  );
}
