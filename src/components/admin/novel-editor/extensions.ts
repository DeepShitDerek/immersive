import { StarterKit } from "@tiptap/starter-kit";
import { Highlight } from "@tiptap/extension-highlight";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Image } from "@tiptap/extension-image";
import { Typography } from "@tiptap/extension-typography";
import { CharacterCount } from "@tiptap/extension-character-count";
import { TextAlign } from "@tiptap/extension-text-align";
import { WikiLinks, type WikiLinkOptions } from "./wiki-links";

/**
 * The editor's schema. Styling lives in `globals.css` under `.novel-editor`,
 * in theme tokens, rather than as class lists here — the old ones carried
 * literal palette colours (`bg-yellow-200`) that ignored the theme.
 *
 * StarterKit 3 already bundles Link and Underline; they are configured here
 * rather than registered a second time.
 */
export const getExtensions = (
  placeholder: string = "Start writing…",
  wikiLinks: Partial<WikiLinkOptions> = {},
) => [
  WikiLinks.configure(wikiLinks),
  StarterKit.configure({
    // Six levels are kept so existing posts with an h4–h6 still load intact;
    // the menus offer three, as Notion does.
    heading: { levels: [1, 2, 3, 4, 5, 6] },
    link: {
      openOnClick: false,
      autolink: true,
      HTMLAttributes: { rel: "noopener noreferrer" },
    },
    dropcursor: { color: "hsl(var(--primary))", width: 2 },
    // Off: it appends a blank line after a closing heading or list the moment
    // a document loads, which is an edit nobody made — and in an autosaving
    // note, a write on open. Clicking below the last block adds the line
    // instead (see the editor root).
    trailingNode: false,
  }),
  Placeholder.configure({
    emptyEditorClass: "is-editor-empty",
    emptyNodeClass: "is-empty",
    placeholder: ({ editor, node }) => {
      if (node.type.name === "heading") return `Heading ${node.attrs.level}`;
      if (editor.isEmpty) return placeholder;
      return "Type '/' for commands";
    },
  }),
  Highlight,
  TaskList,
  TaskItem.configure({ nested: true }),
  Table.configure({ resizable: true }),
  TableRow,
  TableCell,
  TableHeader,
  Image.configure({ allowBase64: false }),
  Typography,
  CharacterCount,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
];
