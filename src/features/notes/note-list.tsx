"use client";

import { useMemo, useState } from "react";
import { Pin, Plus, Search, X } from "lucide-react";
import type { Note } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { groupNotes, matchesNote, notePreview, rowDate } from "./note-groups";
import { noteLabel } from "./note-title";
import {
  type FolderCounts,
  type NoteFolder,
  NoteFolderList,
  NoteFolderMenu,
} from "./note-folders";

/**
 * The notebook's index: every note as one line — its name, when it was last
 * written in, and the start of what it says — grouped by recency.
 *
 * It replaces a masonry wall of cards. A wall shows a few notes well and the
 * rest not at all; a list shows forty at once, and a note is found by its name
 * and its date far more often than by its shape. Where it looks is chosen
 * Apple Notes style (note-folders.tsx): a folder column on wide screens, the
 * same list from the heading on narrow ones. Two rows of pills before that.
 */
export function NoteList({
  notes,
  selectedId,
  onSelect,
  onNew,
  isCreating,
  connectedIds,
  className,
}: {
  notes: Note[];
  selectedId: string | null;
  onSelect: (note: Note) => void;
  onNew: () => void;
  isCreating?: boolean;
  /** Notes that link to, or are linked from, another note. */
  connectedIds: Set<string>;
  className?: string;
}) {
  const [folder, setFolder] = useState<NoteFolder>({
    kind: "scope",
    scope: "notes",
  });
  const [search, setSearch] = useState("");

  const live = useMemo(() => notes.filter((n) => !n.archived_at), [notes]);
  const archived = useMemo(() => notes.filter((n) => !!n.archived_at), [notes]);

  const counts: FolderCounts = useMemo(() => {
    const tags = new Map<string, number>();
    for (const note of live)
      for (const t of note.tags ?? []) tags.set(t, (tags.get(t) ?? 0) + 1);
    return {
      notes: live.length,
      pinned: live.filter((n) => n.is_pinned).length,
      linked: live.filter((n) => connectedIds.has(n.id)).length,
      archive: archived.length,
      tags: [...tags.entries()].sort(([a], [b]) => a.localeCompare(b)),
    };
  }, [live, archived, connectedIds]);

  // A tag is a smart folder over every active note.
  const inFolder = useMemo(() => {
    if (folder.kind === "tag")
      return live.filter((n) => (n.tags ?? []).includes(folder.tag));
    if (folder.scope === "archive") return archived;
    if (folder.scope === "pinned") return live.filter((n) => n.is_pinned);
    if (folder.scope === "linked")
      return live.filter((n) => connectedIds.has(n.id));
    return live;
  }, [folder, live, archived, connectedIds]);

  const shown = inFolder.filter((note) => matchesNote(note, search));
  const groups = groupNotes(shown);
  const filtering = !!search.trim();
  const allNotes = () => setFolder({ kind: "scope", scope: "notes" });

  return (
    <aside
      aria-label="All notes"
      className={cn(
        // Pinned beside the note from md, so it needs a *definite* height,
        // not a max-height, and at xl a grid row that may shrink
        // (minmax(0,1fr)): with an auto row the grid grew to fit every note,
        // the list's own scroll never engaged, and the pinned column ran off
        // the bottom of the window where page scrolling could not reach it.
        // Below lg the workspace tab bar covers the bottom, so it is
        // subtracted there.
        "min-w-0 gap-3 md:sticky md:top-20 md:h-[calc(100dvh-7rem-var(--tabbar-h))] lg:h-[calc(100dvh-7rem)] xl:grid xl:grid-cols-[11rem_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)] xl:gap-5",
        className,
      )}
    >
      <div className="hidden min-h-0 overflow-y-auto pt-12 xl:block">
        <NoteFolderList current={folder} counts={counts} onPick={setFolder} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="t-heading">Notes</h1>
            <div className="-ml-1.5 xl:hidden">
              <NoteFolderMenu
                current={folder}
                counts={counts}
                onPick={setFolder}
              />
            </div>
          </div>
          <Button size="sm" onClick={onNew} disabled={isCreating}>
            <Plus className="mr-1.5 size-4" aria-hidden />
            New note
          </Button>
        </div>

        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search notes…"
            aria-label="Search notes"
            className="h-9 pl-8"
          />
        </div>

        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2">
          {groups.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {filtering ? (
                <>
                  <p>No notes match.</p>
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="mt-2 inline-flex items-center gap-1 rounded-control px-2 py-1 font-medium text-primary hover:underline focus-ring"
                  >
                    <X className="size-3.5" aria-hidden />
                    Clear search
                  </button>
                </>
              ) : folder.kind === "scope" && folder.scope === "archive" ? (
                <p>
                  Nothing archived. Archiving keeps a note and takes it out of
                  the way.
                </p>
              ) : folder.kind === "tag" || folder.scope !== "notes" ? (
                <>
                  <p>Nothing in this folder.</p>
                  <button
                    type="button"
                    onClick={allNotes}
                    className="mt-2 inline-flex items-center gap-1 rounded-control px-2 py-1 font-medium text-primary hover:underline focus-ring"
                  >
                    Show all notes
                  </button>
                </>
              ) : (
                <p>Nothing here yet.</p>
              )}
            </div>
          ) : (
            groups.map((group) => (
              <section
                key={group.label}
                aria-label={group.label}
                className="mb-4"
              >
                <h2 className="mb-1 px-3 text-xs font-medium text-muted-foreground">
                  {group.label}
                </h2>
                <ul className="list-none space-y-0.5 p-0">
                  {group.notes.map((note) => (
                    <li key={note.id}>
                      <NoteRow
                        note={note}
                        selected={note.id === selectedId}
                        onSelect={() => onSelect(note)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

function NoteRow({
  note,
  selected,
  onSelect,
}: {
  note: Note;
  selected: boolean;
  onSelect: () => void;
}) {
  const label = noteLabel(note);
  const preview = notePreview(note);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Open ${label.text}`}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-control px-3 py-2.5 text-left transition-colors",
        "focus-ring",
        selected ? "bg-secondary" : "hover:bg-secondary/50",
      )}
    >
      <span
        aria-hidden
        className="mt-1.5 size-2 shrink-0 rounded-full"
        // Per-note user data, not a theme token, so it cannot be a class.
        style={{ background: note.color ?? "transparent" }}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              label.derived
                ? "text-muted-foreground"
                : "font-medium text-foreground",
            )}
          >
            {label.text}
          </span>
          {note.is_pinned && (
            <Pin className="size-3 shrink-0 text-primary" aria-hidden />
          )}
        </span>
        <span className="mt-0.5 flex gap-2 text-xs text-muted-foreground">
          <span className="shrink-0 tabular-nums">
            {rowDate(note.updated_at ?? note.created_at)}
          </span>
          <span className="min-w-0 truncate">
            {preview ||
              (note.tags?.length
                ? note.tags.map((t) => `#${t}`).join(" ")
                : "")}
          </span>
        </span>
      </span>
    </button>
  );
}
