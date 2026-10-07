"use client";

import {
  Archive,
  Check,
  ChevronDown,
  Hash,
  Link2,
  NotebookText,
  Pin,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";

/**
 * Where the note list looks, Apple Notes style: folders, then tags, as rows
 * with a count. It replaced two rows of filter pills.
 *
 * A folder is a scope; a tag is a smart folder over every active note. One
 * is current at a time, so "what am I looking at" is always one name.
 */
export type NoteScope = "notes" | "pinned" | "linked" | "archive";
export type NoteFolder =
  | { kind: "scope"; scope: NoteScope }
  | { kind: "tag"; tag: string };

export interface FolderCounts {
  notes: number;
  pinned: number;
  linked: number;
  archive: number;
  tags: [tag: string, count: number][];
}

const SCOPES: { scope: NoteScope; label: string; Icon: LucideIcon }[] = [
  { scope: "notes", label: "All Notes", Icon: NotebookText },
  { scope: "pinned", label: "Pinned", Icon: Pin },
  { scope: "linked", label: "Linked", Icon: Link2 },
  { scope: "archive", label: "Archive", Icon: Archive },
];

/** Scopes worth showing: All Notes always, the others once they hold notes. */
function visibleScopes(counts: FolderCounts, current: NoteFolder) {
  return SCOPES.filter(
    ({ scope }) =>
      scope === "notes" ||
      counts[scope] > 0 ||
      (current.kind === "scope" && current.scope === scope),
  );
}

function folderLabel(folder: NoteFolder): string {
  return folder.kind === "tag"
    ? `#${folder.tag}`
    : SCOPES.find((s) => s.scope === folder.scope)!.label;
}

const same = (a: NoteFolder, b: NoteFolder) =>
  a.kind === b.kind &&
  (a.kind === "tag"
    ? a.tag === (b as { tag: string }).tag
    : a.scope === (b as { scope: NoteScope }).scope);

/** The sidebar: wide screens. */
export function NoteFolderList({
  current,
  counts,
  onPick,
}: {
  current: NoteFolder;
  counts: FolderCounts;
  onPick: (folder: NoteFolder) => void;
}) {
  const row = (
    folder: NoteFolder,
    label: string,
    Icon: LucideIcon,
    count: number,
  ) => {
    const active = same(folder, current);
    return (
      <li key={label}>
        <button
          type="button"
          onClick={() => onPick(folder)}
          aria-current={active ? "true" : undefined}
          className={cn(
            "flex w-full items-center gap-2 rounded-control px-2.5 py-1.5 text-left text-sm transition-colors",
            "focus-ring",
            active
              ? "bg-secondary font-medium text-foreground"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
          )}
        >
          <Icon
            className={cn("size-4 shrink-0", active && "text-primary")}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {count}
          </span>
        </button>
      </li>
    );
  };

  return (
    <nav aria-label="Note folders" className="space-y-4">
      <ul className="list-none space-y-0.5 p-0">
        {visibleScopes(counts, current).map(({ scope, label, Icon }) =>
          row({ kind: "scope", scope }, label, Icon, counts[scope]),
        )}
      </ul>
      {counts.tags.length > 0 && (
        <div>
          <h2 className="mb-1 px-2.5 text-xs font-medium text-muted-foreground">
            Tags
          </h2>
          <ul className="list-none space-y-0.5 p-0">
            {counts.tags.map(([tag, count]) =>
              row({ kind: "tag", tag }, tag, Hash, count),
            )}
          </ul>
        </div>
      )}
    </nav>
  );
}

/** The same choice from the list heading: narrow screens. */
export function NoteFolderMenu({
  current,
  counts,
  onPick,
}: {
  current: NoteFolder;
  counts: FolderCounts;
  onPick: (folder: NoteFolder) => void;
}) {
  const item = (
    folder: NoteFolder,
    label: string,
    Icon: LucideIcon,
    count: number,
  ) => (
    <DropdownMenuItem
      key={label}
      onSelect={() => onPick(folder)}
      className="gap-2"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-xs tabular-nums text-muted-foreground">
        {count}
      </span>
      <Check
        className={cn(
          "size-4 shrink-0",
          same(folder, current) ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      />
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Folder: ${folderLabel(current)}. Change folder`}
          className="inline-flex max-w-full items-center gap-1 rounded-control px-1.5 py-1 text-sm font-medium text-foreground hover:bg-secondary/60 focus-ring"
        >
          <span className="truncate">{folderLabel(current)}</span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {visibleScopes(counts, current).map(({ scope, label, Icon }) =>
          item({ kind: "scope", scope }, label, Icon, counts[scope]),
        )}
        {counts.tags.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
              Tags
            </DropdownMenuLabel>
            {counts.tags.map(([tag, count]) =>
              item({ kind: "tag", tag }, tag, Hash, count),
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
