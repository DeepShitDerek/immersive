"use client";

import type { Note } from "@/types";
import { ManagerWrapper } from "@/components/admin/shared";
import { NoteList } from "./note-list";
import { NOTES_GRID } from "./notes-page";

/**
 * Dev-only harness for the Notes layout (/dev/notes): the real list and the
 * real grid with sixty fixed notes and a long open document, so the list's
 * scrolling can be checked in a browser without an admin login. It exists
 * because the list once ran off the bottom of the window, unreachable, and
 * nothing outside the sign-in could show it.
 */
const TAGS = ["work", "home", "reading", "ideas", "travel"];
const NOTES: Note[] = Array.from({ length: 60 }, (_, i) => {
  const day = String((i % 28) + 1).padStart(2, "0");
  return {
    id: `n${i}`,
    title: `Note ${i + 1}`,
    content: `Line one of note ${i + 1}.`,
    tags: [TAGS[i % TAGS.length]],
    is_pinned: i < 2,
    archived_at: null,
    color: null,
    created_at: `2026-09-${day}T10:00:00Z`,
    updated_at: `2026-09-${day}T10:00:00Z`,
  } as unknown as Note;
});

export function NotesHarness() {
  return (
    <ManagerWrapper>
      <div className={NOTES_GRID}>
        <NoteList
          // As the page passes it with a note open.
          className="hidden md:flex"
          notes={NOTES}
          selectedId="n5"
          onSelect={() => {}}
          onNew={() => {}}
          connectedIds={new Set()}
        />
        <article aria-label="Note 6" className="min-w-0 space-y-4">
          {Array.from({ length: 80 }, (_, i) => (
            <p key={i}>
              Paragraph {i + 1} of a long note, so the page itself scrolls.
            </p>
          ))}
        </article>
      </div>
    </ManagerWrapper>
  );
}
