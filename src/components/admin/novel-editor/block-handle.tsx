"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import {
  deleteBlock,
  duplicateBlock,
  moveBlock,
  turnInto,
} from "./block-actions";
import type { BlockCommand } from "./slash-commands";

const CONVERTIBLE = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "taskList",
  "blockquote",
  "codeBlock",
]);

/** Only where there is a pointer that can hover and room in the margin. */
function useCanHover(): boolean {
  const [can, setCan] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(hover: hover) and (min-width: 768px)");
    const update = () => setCan(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return can;
}

/**
 * The handle beside whichever block the pointer is over: `+` adds a block
 * below and opens the slash menu in it; the grip drags the block somewhere
 * else, or — clicked — offers Turn into, Duplicate, Move and Delete.
 *
 * It hangs in the margin to the left of the text (`left: -3rem`), so the text
 * column lines up with whatever sits above the editor. The strip is 3rem wide
 * and touches the editor's edge, so moving the pointer from the text to the
 * handle never crosses a gap that would hide it.
 */
export function BlockHandle({
  editor,
  containerRef,
  blocks,
}: {
  editor: Editor;
  containerRef: RefObject<HTMLDivElement | null>;
  blocks: BlockCommand[];
}) {
  const canHover = useCanHover();
  const [block, setBlock] = useState<{ pos: number; top: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !canHover) return;

    const onMove = (event: MouseEvent) => {
      if (menuOpen) return;
      if ((event.target as HTMLElement).closest("[data-block-handle]")) return;
      const view = editor.view;
      const rootTop = root.getBoundingClientRect().top;
      let found: { pos: number; top: number } | null = null;

      view.state.doc.forEach((node, offset) => {
        if (found) return;
        const dom = view.nodeDOM(offset);
        if (!(dom instanceof HTMLElement)) return;
        const rect = dom.getBoundingClientRect();
        if (event.clientY < rect.top - 6 || event.clientY > rect.bottom + 6) {
          return;
        }
        // Centred on the block's first line, whatever its size.
        const style = getComputedStyle(dom);
        const line = parseFloat(style.lineHeight) || 24;
        const padTop = parseFloat(style.paddingTop) || 0;
        found = {
          pos: offset,
          top:
            rect.top -
            rootTop +
            padTop +
            (Math.min(line, rect.height) - 24) / 2,
        };
      });
      setBlock(found);
    };
    const onLeave = () => {
      if (!menuOpen) setBlock(null);
    };

    root.addEventListener("mousemove", onMove);
    root.addEventListener("mouseleave", onLeave);
    return () => {
      root.removeEventListener("mousemove", onMove);
      root.removeEventListener("mouseleave", onLeave);
    };
  }, [editor, containerRef, canHover, menuOpen]);

  // Out of the way while typing, as Notion does.
  useEffect(() => {
    const hide = () => {
      if (!menuOpen) setBlock(null);
    };
    editor.on("update", hide);
    return () => {
      editor.off("update", hide);
    };
  }, [editor, menuOpen]);

  if (!canHover || !block) return null;
  const node = editor.state.doc.nodeAt(block.pos);
  if (!node) return null;
  const pos = block.pos;

  const close = () => {
    setMenuOpen(false);
    setBlock(null);
  };

  const addBelow = () => {
    // An empty line is reused rather than followed by another.
    if (node.type.name === "paragraph" && node.content.size === 0) {
      editor
        .chain()
        .focus(pos + 1)
        .insertContent("/")
        .run();
    } else {
      const end = pos + node.nodeSize;
      editor
        .chain()
        .insertContentAt(end, { type: "paragraph" })
        .focus(end + 1)
        .insertContent("/")
        .run();
    }
    setBlock(null);
  };

  /**
   * ProseMirror's own drop handling does the move: select the block, hand the
   * view the slice it is dragging, and let the drop cursor and the drop
   * handler put it where it lands.
   */
  const onDragStart = (event: React.DragEvent) => {
    const view = editor.view;
    const selection = NodeSelection.create(view.state.doc, pos);
    view.dispatch(view.state.tr.setSelection(selection));
    view.dragging = { slice: selection.content(), move: true };
    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData("text/plain", node.textContent);
    const dom = view.nodeDOM(pos);
    if (dom instanceof HTMLElement) event.dataTransfer.setDragImage(dom, 0, 0);
  };

  return (
    <div
      data-block-handle
      className="absolute z-raised flex h-6 items-center justify-end gap-0.5 pr-1"
      style={{ top: block.top, left: "-3rem", width: "3rem" }}
    >
      <button
        type="button"
        aria-label="Add a block below"
        title="Add below"
        onClick={addBelow}
        className="flex size-6 items-center justify-center rounded-control text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Plus className="size-4" aria-hidden />
      </button>
      <Popover
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open);
          if (!open) setBlock(null);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            draggable
            aria-label="Drag to move, or click for options"
            title="Drag to move · Click for options"
            onDragStart={onDragStart}
            onDragEnd={() => {
              editor.view.dragging = null;
              setBlock(null);
            }}
            className="flex h-6 w-5 cursor-grab items-center justify-center rounded-control text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="left"
          align="start"
          className="w-56 p-1"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {CONVERTIBLE.has(node.type.name) && (
            <>
              <p className="px-2 pb-1 pt-1.5 text-xs font-medium text-muted-foreground">
                Turn into
              </p>
              {blocks.map((b) => (
                <MenuItem
                  key={b.id}
                  icon={b.icon}
                  onClick={() => {
                    turnInto(editor, pos, b);
                    close();
                  }}
                >
                  {b.title}
                </MenuItem>
              ))}
              <div className="my-1 h-px bg-border" aria-hidden />
            </>
          )}
          <MenuItem
            icon={Copy}
            onClick={() => {
              duplicateBlock(editor, pos);
              close();
            }}
          >
            Duplicate
          </MenuItem>
          <MenuItem
            icon={ArrowUp}
            hint="Alt+Shift+↑"
            onClick={() => {
              moveBlock(editor, pos, -1);
              close();
            }}
          >
            Move up
          </MenuItem>
          <MenuItem
            icon={ArrowDown}
            hint="Alt+Shift+↓"
            onClick={() => {
              moveBlock(editor, pos, 1);
              close();
            }}
          >
            Move down
          </MenuItem>
          <MenuItem
            icon={Trash2}
            destructive
            onClick={() => {
              deleteBlock(editor, pos);
              close();
            }}
          >
            Delete
          </MenuItem>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  hint,
  destructive,
  onClick,
  children,
}: {
  icon: LucideIcon;
  hint?: string;
  destructive?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm transition-colors",
        "focus-ring",
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "hover:bg-secondary",
      )}
    >
      <Icon className="size-4 shrink-0 opacity-70" aria-hidden />
      <span className="flex-1">{children}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </button>
  );
}
