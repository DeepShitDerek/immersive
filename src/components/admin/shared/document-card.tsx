"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, MoreHorizontal, Pencil, Pin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";

/**
 * One document in a gallery: Whiteboard boards and Maps. One card for
 * both, with pin, rename and delete always visible: buttons that appear on
 * hover never appear on a touch screen.
 *
 * - A 16:10 thumbnail on the page ground, so a dark board reads as dark.
 * - Title, then a muted line of whatever the module knows (when, how big).
 * - A pinned document says so with a mark beside the title.
 * - Every action is in one ⋯ menu that is always visible. Rename edits the
 *   title in place; the rest are the module's.
 */
export function DocumentCard({
  title,
  untitled = "Untitled",
  thumbnail,
  meta,
  pinned = false,
  onOpen,
  onRename,
  menuItems,
}: {
  title: string | null | undefined;
  untitled?: string;
  thumbnail: ReactNode;
  meta?: ReactNode;
  pinned?: boolean;
  onOpen: () => void;
  /** Commits a new title. Not called when it is unchanged or empty. */
  onRename?: (title: string) => void;
  /** The module's own menu items (pin, export, delete…). */
  menuItems?: ReactNode;
}) {
  const name = title?.trim() || untitled;
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  const commit = () => {
    const next = draft.trim();
    setRenaming(false);
    // Clearing a name is far more likely a slip than an intent: a cancel.
    if (!next || next === (title ?? "")) {
      setDraft(title ?? "");
      return;
    }
    onRename?.(next);
  };

  return (
    <article className="group relative overflow-hidden rounded-surface border bg-card transition-colors hover:border-input">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${name}`}
        className="block w-full rounded-surface text-left focus-ring"
      >
        <span className="m-2 mb-0 block aspect-[16/10] overflow-hidden rounded-control border bg-background">
          {thumbnail}
        </span>
        <span className="block px-3 pb-3 pt-2.5 pr-12">
          <span className="flex min-w-0 items-center gap-1.5">
            {pinned && (
              <Pin
                aria-hidden
                className="size-3.5 shrink-0 fill-current text-primary"
              />
            )}
            <span className="truncate text-sm font-medium">
              {renaming ? " " : name}
            </span>
            {pinned && <span className="sr-only">, pinned</span>}
          </span>
          {meta && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {meta}
            </span>
          )}
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`More actions for ${name}`}
            className="absolute bottom-2 right-2 size-8"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {onRename && (
            <DropdownMenuItem
              onSelect={() => {
                setDraft(title ?? "");
                setRenaming(true);
              }}
            >
              <Pencil className="mr-2 size-4" aria-hidden /> Rename
            </DropdownMenuItem>
          )}
          {menuItems}
        </DropdownMenuContent>
      </DropdownMenu>

      {/*
        Laid over the title row rather than inside the card's button: an
        input nested in a button would send Enter and clicks to the wrong
        handler.
      */}
      {renaming && (
        <div className="absolute inset-x-2 bottom-2 flex items-center gap-1 bg-card">
          <Input
            ref={inputRef}
            value={draft}
            aria-label={`Rename ${name}`}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
              if (event.key === "Escape") {
                setDraft(title ?? "");
                setRenaming(false);
              }
            }}
            onBlur={commit}
            className="h-8 text-sm"
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Save name"
            className="size-8 shrink-0"
            // Mousedown, not click: the input's blur would close the field
            // before a click arrived.
            onMouseDown={(event) => {
              event.preventDefault();
              commit();
            }}
          >
            <Check className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </article>
  );
}

/** The first tile of a gallery: start a new document from where you look. */
export function NewDocumentCard({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-full min-h-40 flex-col items-center justify-center gap-2 rounded-surface border border-dashed bg-card/50 p-4 text-sm font-medium text-muted-foreground transition-colors focus-ring",
        "hover:border-primary/50 hover:text-foreground disabled:opacity-50",
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full border bg-card">
        <Plus className="size-5" aria-hidden />
      </span>
      {label}
    </button>
  );
}
