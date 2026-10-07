"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/** One row of a suggestion menu — a block type, or a page to link. */
export interface MenuEntry {
  id: string;
  group: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  shortcut?: string;
}

/**
 * The menu that opens at the cursor: block types for `/`, pages for `[[`.
 * Filtered as you type after the trigger. Keyboard handling lives in the
 * editor (arrows, Enter, Escape), so the text never loses focus.
 */
export function SuggestionMenu({
  editor,
  at,
  label,
  items,
  index,
  onHover,
  onPick,
}: {
  editor: Editor;
  /** Document position of the trigger; the menu anchors here. */
  at: number;
  label: string;
  items: MenuEntry[];
  index: number;
  onHover: (index: number) => void;
  onPick: (entry: MenuEntry) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);

  // Fixed to the viewport, so it has to follow the page when it scrolls.
  useEffect(() => {
    const reposition = () => setTick((t) => t + 1);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, []);

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);

  let coords: { left: number; top: number; bottom: number };
  try {
    coords = editor.view.coordsAtPos(at);
  } catch {
    return null;
  }

  // Opens upwards when there is not room below.
  const below = window.innerHeight - coords.bottom;
  const up = below < 320 && coords.top > below;
  const style = {
    left: Math.max(8, Math.min(coords.left, window.innerWidth - 296)),
    ...(up
      ? { bottom: window.innerHeight - coords.top + 6 }
      : { top: coords.bottom + 6 }),
  };

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={label}
      style={style}
      // Keeps the editor focused while the menu is clicked.
      onMouseDown={(event) => event.preventDefault()}
      className="fixed z-overlay max-h-80 w-72 overflow-y-auto rounded-surface bg-popover p-1.5 text-popover-foreground shadow-e3"
    >
      {items.map((item, i) => {
        const Icon = item.icon;
        const heading = i === 0 || items[i - 1].group !== item.group;
        return (
          <div key={item.id}>
            {heading && (
              <p className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">
                {item.group}
              </p>
            )}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- the editor owns the keyboard */}
            <div
              role="option"
              aria-selected={i === index}
              data-active={i === index}
              tabIndex={-1}
              onMouseEnter={() => onHover(i)}
              onClick={() => onPick(item)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-control px-2 py-1.5",
                i === index && "bg-secondary",
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-background shadow-e1">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {item.title}
                </span>
                {item.description && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.description}
                  </span>
                )}
              </span>
              {item.shortcut && (
                <kbd className="shrink-0 text-xs text-muted-foreground">
                  {item.shortcut}
                </kbd>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
