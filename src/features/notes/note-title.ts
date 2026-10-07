import type { Note } from "@/types";
import { firstMeaningfulLine } from "@/lib/text-preview";

/**
 * What to call a note that has no title.
 *
 * A note's title is genuinely optional — you open one to write, and a heading
 * is often the last thing you add, if ever. Writing "Untitled" over the top of
 * it is the app telling you off for that: a whole board of notes reading
 * "Untitled / Untitled / Untitled" says nothing, when the note's own first
 * line usually says exactly what it is.
 *
 * So an untitled note is titled by its opening line. "New note" is reserved
 * for the one case where there is genuinely nothing to show — an empty note,
 * which is the moment just after you created it.
 *
 * `derived` tells the caller which of the two it got, so a real title can be
 * set solid and a borrowed one muted. Without that a derived line would look
 * like a title the author wrote.
 */
export interface NoteLabel {
  text: string;
  /** True when the text came from the body rather than the title column. */
  derived: boolean;
}

export function noteLabel(
  note: Pick<Note, "title" | "content">,
  emptyLabel = "New note",
): NoteLabel {
  const title = note.title?.trim();
  if (title) return { text: title, derived: false };

  const line = firstMeaningfulLine(note.content ?? "");
  if (line) return { text: line, derived: true };

  return { text: emptyLabel, derived: true };
}
