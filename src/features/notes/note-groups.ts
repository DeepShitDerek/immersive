import { differenceInCalendarDays, format, isSameYear } from "date-fns";
import type { Note } from "@/types";
import { stripWikiLinkSyntax } from "./note-links";

/**
 * How the notes list is arranged: pinned first, then by when each note was
 * last written in — Today, Yesterday, the previous week, the previous month,
 * then month by month. The way a notebook app groups them, because "when did I
 * last touch this" is how people actually look for a note.
 */

export interface NoteGroup {
  label: string;
  notes: Note[];
}

function editedAt(note: Note): number {
  const time = new Date(note.updated_at ?? note.created_at ?? 0).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortByEdited(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => editedAt(b) - editedAt(a));
}

function bucket(note: Note, now: Date): string {
  const time = editedAt(note);
  if (!time) return "Undated";
  const date = new Date(time);
  const days = differenceInCalendarDays(now, date);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Previous 7 days";
  if (days < 30) return "Previous 30 days";
  return format(date, isSameYear(date, now) ? "MMMM" : "MMMM yyyy");
}

export function groupNotes(notes: Note[], now: Date = new Date()): NoteGroup[] {
  const sorted = sortByEdited(notes);
  const pinned = sorted.filter((note) => note.is_pinned);
  const groups: NoteGroup[] =
    pinned.length > 0 ? [{ label: "Pinned", notes: pinned }] : [];

  for (const note of sorted) {
    if (note.is_pinned) continue;
    const label = bucket(note, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label && last.label !== "Pinned") {
      last.notes.push(note);
    } else {
      groups.push({ label, notes: [note] });
    }
  }
  return groups;
}

/** A time today, a weekday this week, a date beyond. */
export function rowDate(iso?: string | null, now: Date = new Date()): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const days = differenceInCalendarDays(now, date);
  if (days <= 0) return format(date, "h:mm a");
  if (days < 7) return format(date, "EEE");
  return format(date, isSameYear(date, now) ? "MMM d" : "MMM d, yyyy");
}

function cleanLine(raw: string): string {
  return raw
    .replace(/\\([\\`*_{}[\]()#+\-.!|])/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*#{1,6}\s+/, "")
    .replace(/^\s*>\s?/, "")
    .replace(/^\s*[-*+]\s+(\[[ xX]\]\s*)?/, "")
    .replace(/^\s*\d+[.)]\s+/, "")
    .replace(/[*_`~]/g, "")
    .trim();
}

/**
 * The line under a note's name in the list: its text with the markup taken
 * off. When the note has no title its first line is already the name, so the
 * preview starts after it rather than repeating it.
 */
export function notePreview(
  note: Pick<Note, "title" | "content">,
  max = 120,
): string {
  const lines = stripWikiLinkSyntax(note.content)
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line && !/^([-*_])\1{2,}$/.test(line.replace(/\s/g, "")));
  const body = note.title?.trim() ? lines : lines.slice(1);
  const text = body.join(" ").replace(/\s+/g, " ").trim();
  return text.length > max
    ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…`
    : text;
}

/** Title, body and tags, for a plain substring search. */
export function matchesNote(note: Note, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  return [note.title, note.content, ...(note.tags ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(needle);
}
