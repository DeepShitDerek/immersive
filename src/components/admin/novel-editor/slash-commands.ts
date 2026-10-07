import type { Editor } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import {
  CheckSquare,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Table2,
  Type,
  type LucideIcon,
} from "lucide-react";

/**
 * The block types the editor offers, in one list shared by the slash menu, the
 * selection toolbar's "Turn into" and the block handle's menu — so the three
 * cannot disagree about what a block can be.
 *
 * Every conversion clears the block's current wrapping first (`clearNodes`),
 * which is what makes "turn this list into a heading" or "this quote into
 * plain text" do what it says rather than nesting one inside the other.
 */
export interface BlockCommand {
  id: string;
  group: "Basic blocks" | "Insert";
  title: string;
  description: string;
  icon: LucideIcon;
  /** Extra words the menu filter matches. */
  keywords: string[];
  /** The markdown shortcut that does the same, shown as a hint. */
  shortcut?: string;
  /** Whether an existing block can be converted to this. */
  turnInto?: boolean;
  isActive?: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

export const BLOCK_COMMANDS: BlockCommand[] = [
  {
    id: "text",
    group: "Basic blocks",
    title: "Text",
    description: "Plain writing.",
    icon: Type,
    keywords: ["paragraph", "plain", "normal"],
    turnInto: true,
    run: (e) => e.chain().focus().clearNodes().run(),
  },
  {
    id: "h1",
    group: "Basic blocks",
    title: "Heading 1",
    description: "Big section heading.",
    icon: Heading1,
    keywords: ["h1", "title", "#"],
    shortcut: "#",
    turnInto: true,
    isActive: (e) => e.isActive("heading", { level: 1 }),
    run: (e) => e.chain().focus().clearNodes().setHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    group: "Basic blocks",
    title: "Heading 2",
    description: "Medium section heading.",
    icon: Heading2,
    keywords: ["h2", "subtitle", "##"],
    shortcut: "##",
    turnInto: true,
    isActive: (e) => e.isActive("heading", { level: 2 }),
    run: (e) => e.chain().focus().clearNodes().setHeading({ level: 2 }).run(),
  },
  {
    id: "h3",
    group: "Basic blocks",
    title: "Heading 3",
    description: "Small section heading.",
    icon: Heading3,
    keywords: ["h3", "###"],
    shortcut: "###",
    turnInto: true,
    isActive: (e) => e.isActive("heading", { level: 3 }),
    run: (e) => e.chain().focus().clearNodes().setHeading({ level: 3 }).run(),
  },
  {
    id: "bullet",
    group: "Basic blocks",
    title: "Bulleted list",
    description: "A simple list.",
    icon: List,
    keywords: ["ul", "unordered", "bullet", "-"],
    shortcut: "-",
    turnInto: true,
    isActive: (e) => e.isActive("bulletList"),
    run: (e) => e.chain().focus().clearNodes().toggleBulletList().run(),
  },
  {
    id: "numbered",
    group: "Basic blocks",
    title: "Numbered list",
    description: "A list in order.",
    icon: ListOrdered,
    keywords: ["ol", "ordered", "number", "1."],
    shortcut: "1.",
    turnInto: true,
    isActive: (e) => e.isActive("orderedList"),
    run: (e) => e.chain().focus().clearNodes().toggleOrderedList().run(),
  },
  {
    id: "todo",
    group: "Basic blocks",
    title: "To-do list",
    description: "Things to tick off.",
    icon: CheckSquare,
    keywords: ["todo", "task", "checkbox", "check", "[]"],
    shortcut: "[]",
    turnInto: true,
    isActive: (e) => e.isActive("taskList"),
    run: (e) => e.chain().focus().clearNodes().toggleTaskList().run(),
  },
  {
    id: "quote",
    group: "Basic blocks",
    title: "Quote",
    description: "Set a passage apart.",
    icon: Quote,
    keywords: ["blockquote", "citation", ">"],
    shortcut: ">",
    turnInto: true,
    isActive: (e) => e.isActive("blockquote"),
    run: (e) => e.chain().focus().clearNodes().toggleBlockquote().run(),
  },
  {
    id: "code",
    group: "Basic blocks",
    title: "Code",
    description: "A block of code.",
    icon: Code,
    keywords: ["codeblock", "snippet", "```"],
    shortcut: "```",
    turnInto: true,
    isActive: (e) => e.isActive("codeBlock"),
    run: (e) => e.chain().focus().clearNodes().toggleCodeBlock().run(),
  },
  {
    id: "divider",
    group: "Insert",
    title: "Divider",
    description: "A line between sections.",
    icon: Minus,
    keywords: ["hr", "rule", "line", "separator", "---"],
    shortcut: "---",
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    id: "table",
    group: "Insert",
    title: "Table",
    description: "Rows and columns.",
    icon: Table2,
    keywords: ["grid", "rows", "columns"],
    run: (e) =>
      e
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    // Handled by the editor itself, which owns the file picker.
    id: "image",
    group: "Insert",
    title: "Image",
    description: "Upload one — or paste or drop it in.",
    icon: ImageIcon,
    keywords: ["picture", "photo", "upload"],
    run: () => undefined,
  },
];

export const TURN_INTO_COMMANDS = BLOCK_COMMANDS.filter((c) => c.turnInto);

/** The block type the selection is in, for the "Turn into" label. */
export function activeBlock(editor: Editor): BlockCommand {
  return (
    TURN_INTO_COMMANDS.find((c) => c.id !== "text" && c.isActive?.(editor)) ??
    TURN_INTO_COMMANDS[0]
  );
}

/**
 * Commands matching what was typed after the slash. A title that starts with
 * the query ranks first, then a keyword that does, then anything containing it.
 */
export function filterCommands(
  commands: BlockCommand[],
  query: string,
): BlockCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;

  const rank = (c: BlockCommand): number => {
    const title = c.title.toLowerCase();
    if (title.startsWith(q)) return 0;
    if (c.keywords.some((k) => k.startsWith(q))) return 1;
    if (title.includes(q) || c.keywords.some((k) => k.includes(q))) return 2;
    return -1;
  };

  return commands
    .map((c) => ({ c, r: rank(c) }))
    .filter(({ r }) => r >= 0)
    .sort((a, b) => a.r - b.r)
    .map(({ c }) => c);
}

export interface SlashMatch {
  /** What has been typed after the slash. */
  query: string;
  /** The slash's position; the menu anchors here. */
  from: number;
  /** The cursor. */
  to: number;
}

/**
 * Whether the cursor sits just after a `/command` being typed.
 *
 * Read from the document rather than counted from keystrokes. The old menu
 * tallied key presses into a filter string, which drifted from the text the
 * moment the cursor moved, a character was pasted, or an IME composed one.
 *
 * The slash must start the block or follow a space, so `a/b` and a URL never
 * open it, and a code block never does.
 */
export function slashQuery(state: EditorState): SlashMatch | null {
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
  const match = /(?:^|\s)\/((?:[\w-]+(?: [\w-]*)?)?)$/.exec(before);
  if (!match) return null;

  const query = match[1];
  return { query, from: $from.pos - query.length - 1, to: $from.pos };
}
