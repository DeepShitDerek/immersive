import type { Note } from "@/types";

/**
 * `[[Wikilinks]]` between notes.
 *
 * The defining feature of every note tool worth using — Obsidian, Roam,
 * Logseq — and the reason a collection of notes becomes more useful than the
 * sum of its parts. Without it, a note you wrote six months ago is only
 * findable if you remember it exists.
 *
 * Links live in the markdown body rather than in a join table. The text is the
 * source of truth, so a link cannot survive the sentence that created it being
 * deleted, and there is nothing to keep in sync on every save.
 */

/**
 * `[[Target]]` or `[[Target|shown text]]`.
 *
 * The brackets may arrive backslash-escaped. `tiptap-markdown` serializes
 * through prosemirror-markdown, which escapes `[` and `]` in text nodes — so a
 * link typed in the editor is stored as `\[\[Target\]\]` and a pattern that
 * only matched bare brackets silently found nothing. Every wikilink written in
 * the app went through that path, which is why none of them resolved.
 */
const WIKILINK = /\\?\[\\?\[([^\]|\\]+?)(?:\\?\|([^\]\\]*))?\\?\]\\?\]/g;

interface ParsedLink {
  /** The note title being referenced. */
  target: string;
  /** What to render, when the link supplies an alias. */
  label: string;
}

/**
 * Every wikilink in a note body, in order, deduplicated by target.
 *
 * Fenced code blocks are skipped: `[[` inside a snippet is code, not a link,
 * and turning it into one would silently rewrite what the note says.
 */
function extractLinks(content: string | null | undefined): ParsedLink[] {
  if (!content) return [];

  const withoutCode = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*`/g, "");

  const seen = new Set<string>();
  const links: ParsedLink[] = [];

  // `replace` as a scanner rather than `matchAll`: the build targets an older
  // lib where the iterator is not enumerable without downlevelIteration.
  withoutCode.replace(WIKILINK, (_whole, rawTarget: string, alias?: string) => {
    const target = rawTarget.trim();
    if (target) {
      const key = target.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        links.push({ target, label: (alias ?? target).trim() || target });
      }
    }
    return "";
  });

  return links;
}

/** Titles are matched case-insensitively and whitespace-trimmed. */
export function normalizeTitle(title: string | null | undefined): string {
  return (title ?? "").trim().toLowerCase();
}

/**
 * Note lookup by title.
 *
 * Titles are not unique in the database, so a collision has to resolve to
 * something predictable: the oldest note wins, because that is the one the
 * link was most likely written against.
 */
export function indexByTitle(notes: Note[]): Map<string, Note> {
  const index = new Map<string, Note>();
  const sorted = [...notes].sort((a, b) =>
    (a.created_at ?? "").localeCompare(b.created_at ?? ""),
  );
  for (const note of sorted) {
    const key = normalizeTitle(note.title);
    if (!key || index.has(key)) continue;
    index.set(key, note);
  }
  return index;
}

export interface LinkGraph {
  /** note id → notes it links to. */
  outgoing: Map<string, Note[]>;
  /** note id → notes that link to it. */
  backlinks: Map<string, Note[]>;
  /** note id → link targets with no matching note. */
  unresolved: Map<string, string[]>;
}

export function buildLinkGraph(notes: Note[]): LinkGraph {
  const byTitle = indexByTitle(notes);
  const outgoing = new Map<string, Note[]>();
  const backlinks = new Map<string, Note[]>();
  const unresolved = new Map<string, string[]>();

  for (const note of notes) {
    const targets: Note[] = [];
    const missing: string[] = [];

    for (const link of extractLinks(note.content)) {
      const found = byTitle.get(normalizeTitle(link.target));
      // A note linking to itself is a typo, not a relationship, and showing it
      // in its own backlinks panel is just confusing.
      if (found && found.id !== note.id) {
        targets.push(found);
        backlinks.set(found.id, [...(backlinks.get(found.id) ?? []), note]);
      } else if (!found) {
        missing.push(link.target);
      }
    }

    if (targets.length > 0) outgoing.set(note.id, targets);
    if (missing.length > 0) unresolved.set(note.id, missing);
  }

  return { outgoing, backlinks, unresolved };
}

/**
 * Wikilink syntax reduced to its label, for previews.
 *
 * A card shows the note as it reads, and `\\[\\[Postgres\\]\\]` is markup rather
 * than something anyone wrote to be read. Everything else stays markdown so
 * the preview renders rather than printing its own source.
 */
export function stripWikiLinkSyntax(
  content: string | null | undefined,
): string {
  if (!content) return "";
  return content.replace(
    WIKILINK,
    (_whole, target: string, alias?: string) =>
      (alias ?? target).trim() || target.trim(),
  );
}
