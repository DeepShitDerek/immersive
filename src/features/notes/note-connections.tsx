"use client";

import { useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import type { Note } from "@/types";
import { buildLinkGraph } from "./note-links";
import { notePreview } from "./note-groups";
import { noteLabel } from "./note-title";

/**
 * What a note is connected to, under the note rather than in a side rail: the
 * rail took a fifth of the width from the thing being read to show, most of
 * the time, nothing. Here it takes space only when there is something to show.
 *
 * Built from the draft the owner is typing, so a `[[link]]` appears here as it
 * is written rather than after the next save.
 */
export function NoteConnections({
  note,
  notes,
  onOpen,
  onCreate,
}: {
  note: Note;
  notes: Note[];
  onOpen: (note: Note) => void;
  /** Write the note a link points at but that does not exist yet. */
  onCreate: (title: string) => void;
}) {
  const graph = useMemo(() => buildLinkGraph(notes), [notes]);
  const outgoing = graph.outgoing.get(note.id) ?? [];
  const backlinks = graph.backlinks.get(note.id) ?? [];
  const unresolved = graph.unresolved.get(note.id) ?? [];

  if (!outgoing.length && !backlinks.length && !unresolved.length) {
    return (
      <p className="mt-5 px-1 text-sm text-muted-foreground">
        Not connected to anything yet. Type{" "}
        <code className="rounded-control bg-secondary px-1.5 py-0.5 text-xs">
          [[another note]]
        </code>{" "}
        anywhere in it to link one.
      </p>
    );
  }

  return (
    <section
      aria-label="Connections"
      className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3"
    >
      <LinkedNotes
        title="Links to"
        icon={ArrowUpRight}
        notes={outgoing}
        onOpen={onOpen}
      />
      <LinkedNotes
        title="Linked from"
        icon={ArrowDownLeft}
        notes={backlinks}
        onOpen={onOpen}
      />
      {unresolved.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Not written yet
          </h2>
          {/* A prompt, not an error: a link to a note that does not exist is
              a note you have decided to write. */}
          <ul className="list-none space-y-1.5 p-0">
            {unresolved.map((title) => (
              <li key={title}>
                <button
                  type="button"
                  onClick={() => onCreate(title)}
                  aria-label={`Create ${title}`}
                  className="flex w-full items-center gap-2 rounded-control bg-secondary/50 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-ring"
                >
                  <Plus className="size-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate">{title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function LinkedNotes({
  title,
  icon: Icon,
  notes,
  onOpen,
}: {
  title: string;
  icon: typeof Plus;
  notes: Note[];
  onOpen: (note: Note) => void;
}) {
  if (notes.length === 0) return null;
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-foreground">
        {title}{" "}
        <span className="font-normal tabular-nums text-muted-foreground">
          {notes.length}
        </span>
      </h2>
      <ul className="list-none space-y-1.5 p-0">
        {notes.map((linked) => (
          <li key={linked.id}>
            <button
              type="button"
              onClick={() => onOpen(linked)}
              className="flex w-full items-start gap-2 rounded-control bg-card px-3 py-2 text-left text-sm shadow-e1 transition-shadow hover:shadow-e2 focus-ring"
            >
              <Icon
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {noteLabel(linked).text}
                </span>
                {notePreview(linked) && (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {notePreview(linked)}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
