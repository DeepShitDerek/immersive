import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { FilePlus2, FileText } from "lucide-react";
import type { SlashMatch } from "./slash-commands";
import type { MenuEntry } from "./slash-menu";

/**
 * `[[Links]]` between pages, live inside the editor.
 *
 * The text stays plain `[[Title]]` — that is what Notes stores and resolves —
 * but it is decorated where it sits, so a link is visibly a link and a click
 * follows it while you write. Notes used to need a separate reading mode for
 * exactly this, because a link typed in the editor was inert text.
 *
 * Generic on purpose: the editor knows nothing about notes, only a list of
 * titles it may link to and what to do when one is followed.
 */

export interface LinkTarget {
  id: string;
  title: string;
}

export interface WikiLinkOptions {
  /** Off unless the page supplies link targets. */
  enabled: () => boolean;
  isResolved: (target: string) => boolean;
  onOpen: (target: string) => void;
}

export const wikiLinksKey = new PluginKey("wikiLinks");

const WIKILINK = /\[\[([^[\]|\n]+?)(?:\|([^[\]\n]*))?\]\]/g;

export interface FoundLink {
  from: number;
  to: number;
  target: string;
}

/** Every `[[link]]` in the document, outside code blocks. */
function findWikiLinks(doc: PMNode): FoundLink[] {
  const found: FoundLink[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (node.type.spec.code) return false;
    const text = node.textBetween(0, node.content.size, undefined, "￼");
    WIKILINK.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = WIKILINK.exec(text)) !== null) {
      const target = match[1].trim();
      if (!target) continue;
      const from = pos + 1 + match.index;
      found.push({ from, to: from + match[0].length, target });
    }
    return false;
  });
  return found;
}

/** Whether the cursor sits just after an open `[[` being typed. */
export function wikiLinkQuery(state: EditorState): SlashMatch | null {
  const { selection } = state;
  if (!selection.empty) return null;
  const { $from } = selection;
  if (!$from.parent.isTextblock || $from.parent.type.spec.code) return null;
  const before = $from.parent.textBetween(
    0,
    $from.parentOffset,
    undefined,
    "￼",
  );
  const match = /\[\[([^[\]|\n]{0,60})$/.exec(before);
  if (!match) return null;
  return {
    query: match[1],
    from: $from.pos - match[1].length - 2,
    to: $from.pos,
  };
}

export const NEW_LINK_PREFIX = "new:";

/**
 * The `[[` menu: titles containing the query, the ones that start with it
 * first — and, when nothing matches exactly, an entry to link a page that
 * does not exist yet.
 */
export function linkEntries(
  targets: LinkTarget[],
  query: string,
  limit = 8,
): MenuEntry[] {
  const q = query.trim().toLowerCase();
  const entries: MenuEntry[] = targets
    .filter((t) => t.title.trim() && (!q || t.title.toLowerCase().includes(q)))
    .sort((a, b) => {
      const rank = (t: LinkTarget) =>
        t.title.toLowerCase().startsWith(q) ? 0 : 1;
      return rank(a) - rank(b) || a.title.localeCompare(b.title);
    })
    .slice(0, limit)
    .map((t) => ({
      id: t.id,
      group: "Link to a note",
      title: t.title,
      icon: FileText,
    }));

  const exact = targets.some((t) => t.title.trim().toLowerCase() === q);
  if (q && !exact) {
    entries.push({
      id: `${NEW_LINK_PREFIX}${query.trim()}`,
      group: "Link to a note",
      title: `New note “${query.trim()}”`,
      description: "Link it now, write it later.",
      icon: FilePlus2,
    });
  }
  return entries;
}

export const WikiLinks = Extension.create<WikiLinkOptions>({
  name: "wikiLinks",

  addOptions() {
    return {
      enabled: () => false,
      isResolved: () => false,
      onOpen: () => undefined,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin({
        key: wikiLinksKey,
        props: {
          // Recomputed on every state, so a changed list of titles shows up on
          // the next transaction — the editor dispatches an empty one for it.
          decorations: (state) => {
            if (!options.enabled()) return DecorationSet.empty;
            return DecorationSet.create(
              state.doc,
              findWikiLinks(state.doc).map((link) => {
                const resolved = options.isResolved(link.target);
                return Decoration.inline(link.from, link.to, {
                  class: resolved ? "wikilink" : "wikilink wikilink-missing",
                  "data-wikilink": link.target,
                  title: resolved
                    ? `Open “${link.target}”`
                    : `Create “${link.target}”`,
                });
              }),
            );
          },
          handleClick: (_view, _pos, event) => {
            if (!options.enabled() || event.button !== 0) return false;
            const el = (event.target as HTMLElement | null)?.closest?.(
              "[data-wikilink]",
            );
            const target = el?.getAttribute("data-wikilink");
            if (!target) return false;
            options.onOpen(target);
            return true;
          },
        },
      }),
    ];
  },
});
