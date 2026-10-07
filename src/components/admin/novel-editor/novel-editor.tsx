"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { getExtensions } from "./extensions";
import {
  BLOCK_COMMANDS,
  TURN_INTO_COMMANDS,
  filterCommands,
  slashQuery,
  type SlashMatch,
} from "./slash-commands";
import { SuggestionMenu, type MenuEntry } from "./slash-menu";
import { BubbleToolbar } from "./bubble-toolbar";
import { BlockHandle } from "./block-handle";
import { blockOfSelection, moveBlock } from "./block-actions";
import {
  NEW_LINK_PREFIX,
  linkEntries,
  wikiLinkQuery,
  wikiLinksKey,
  type LinkTarget,
} from "./wiki-links";

/** What a page can do to the editor from outside it. */
export interface NovelEditorHandle {
  focus: (at?: "start" | "end") => void;
}

export interface NovelEditorProps {
  /** Markdown in, markdown out. */
  value: string;
  onChange: (value: string) => void;
  /** Enables the Image block, and pasting or dropping an image. */
  onImageUpload?: (file: File) => Promise<string>;
  /** Shown while the whole editor is empty. */
  placeholder?: string;
  /** The writable area's minimum height; beyond it the editor grows with its content. */
  minHeight?: string;
  /** `prose` holds long-form writing to a reading measure, a little larger. */
  measure?: "full" | "prose";
  /** `page` is part of the surface it sits on; `field` is framed like an input, for forms. */
  variant?: "page" | "field";
  /**
   * Pages `[[Title]]` may link to. When given, links are live in the text —
   * decorated, and followed on click — and typing `[[` offers the titles.
   */
  links?: { targets: LinkTarget[]; onOpen: (title: string) => void };
  /** Filled in once the editor exists, for focusing it from outside. */
  handleRef?: MutableRefObject<NovelEditorHandle | null>;
  editable?: boolean;
  className?: string;
}

type Suggest = { kind: "slash" | "link"; match: SlashMatch };

function getMarkdown(editor: Editor): string {
  return (
    editor.storage as unknown as Record<string, MarkdownStorage>
  ).markdown.getMarkdown();
}

/**
 * The block editor, in the manner of Notion.
 *
 * No toolbar and no frame: the text is the interface. Type `/` for any block
 * type, `[[` to link a page (where the caller supplies pages), select text for
 * formatting, and use the handle in the margin to add, convert, move or drag
 * a block. Markdown shortcuts (`#`, `-`, `[]`, `>`, ` ``` `, `---`) work as
 * you type.
 *
 * It grows with what is written — the page scrolls, never the editor.
 */
export default function NovelEditor({
  value,
  onChange,
  onImageUpload,
  placeholder = "Write something, or press '/' for commands…",
  minHeight = "12rem",
  measure = "full",
  variant = "page",
  links,
  handleRef,
  editable = true,
  className,
}: NovelEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);

  const [suggest, setSuggest] = useState<Suggest | null>(null);
  const [suggestIndex, setSuggestIndex] = useState(0);
  const suggestRef = useRef(suggest);
  suggestRef.current = suggest;
  /** The trigger the user dismissed with Escape, so it does not reopen. */
  const dismissedAt = useRef<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const uploadRef = useRef(onImageUpload);
  uploadRef.current = onImageUpload;
  const linksRef = useRef(links);
  linksRef.current = links;

  const titleSet = useMemo(
    () =>
      new Set((links?.targets ?? []).map((t) => t.title.trim().toLowerCase())),
    [links?.targets],
  );
  const titleSetRef = useRef(titleSet);
  titleSetRef.current = titleSet;

  const commands = onImageUpload
    ? BLOCK_COMMANDS
    : BLOCK_COMMANDS.filter((c) => c.id !== "image");
  const items: MenuEntry[] = !suggest
    ? []
    : suggest.kind === "slash"
      ? filterCommands(commands, suggest.match.query)
      : linkEntries(links?.targets ?? [], suggest.match.query);
  const activeIndex = Math.min(suggestIndex, Math.max(items.length - 1, 0));

  // The editor's key handler is created once; it reads the menu from here.
  const menu = useRef({ open: false, items: [] as MenuEntry[], index: 0 });
  menu.current = {
    open: !!suggest && items.length > 0,
    items,
    index: activeIndex,
  };

  const insertImage = useCallback(async (file: File, at?: number) => {
    const upload = uploadRef.current;
    const editor = editorRef.current;
    if (!upload || !editor) return;
    setIsUploading(true);
    try {
      const src = await upload(file);
      if (src) {
        const chain = editor.chain().focus();
        (at === undefined
          ? chain.setImage({ src })
          : chain.insertContentAt(at, { type: "image", attrs: { src } })
        ).run();
      }
    } catch {
      toast.error("Couldn't upload that image.");
    } finally {
      setIsUploading(false);
    }
  }, []);
  const insertImageRef = useRef(insertImage);
  insertImageRef.current = insertImage;

  const pick = (entry: MenuEntry) => {
    const editor = editorRef.current;
    const current = suggestRef.current;
    if (!editor || !current) return;
    const { from, to } = current.match;
    setSuggest(null);

    if (current.kind === "link") {
      const title = entry.id.startsWith(NEW_LINK_PREFIX)
        ? entry.id.slice(NEW_LINK_PREFIX.length)
        : entry.title;
      editor
        .chain()
        .focus()
        .insertContentAt({ from, to }, { type: "text", text: `[[${title}]]` })
        .run();
      return;
    }

    editor.chain().focus().deleteRange({ from, to }).run();
    if (entry.id === "image") {
      fileInputRef.current?.click();
      return;
    }
    BLOCK_COMMANDS.find((c) => c.id === entry.id)?.run(editor);
  };
  const pickRef = useRef(pick);
  pickRef.current = pick;

  const syncSuggest = (editor: Editor) => {
    const link =
      editor.isEditable && linksRef.current
        ? wikiLinkQuery(editor.state)
        : null;
    const slash = !link && editor.isEditable ? slashQuery(editor.state) : null;
    const match = link ?? slash;
    if (!match) {
      dismissedAt.current = null;
      setSuggest(null);
      return;
    }
    if (dismissedAt.current === match.from) {
      setSuggest(null);
      return;
    }
    setSuggest({ kind: link ? "link" : "slash", match });
    setSuggestIndex(0);
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      ...getExtensions(placeholder, {
        enabled: () => !!linksRef.current,
        isResolved: (target) =>
          titleSetRef.current.has(target.trim().toLowerCase()),
        onOpen: (target) => linksRef.current?.onOpen(target),
      }),
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: value,
    editable,
    editorProps: {
      attributes: { style: `min-height: ${minHeight}` },
      handleKeyDown: (_view, event) => {
        const m = menu.current;
        if (m.open) {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : -1;
            setSuggestIndex((m.index + step + m.items.length) % m.items.length);
            return true;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            const entry = m.items[m.index];
            if (entry) pickRef.current(entry);
            return true;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            dismissedAt.current = suggestRef.current?.match.from ?? null;
            setSuggest(null);
            return true;
          }
        }

        if (
          event.altKey &&
          event.shiftKey &&
          (event.key === "ArrowUp" || event.key === "ArrowDown")
        ) {
          const current = editorRef.current;
          const block = current && blockOfSelection(current.state);
          if (!current || !block) return false;
          event.preventDefault();
          moveBlock(current, block.pos, event.key === "ArrowUp" ? -1 : 1);
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const file = Array.from(event.clipboardData?.files ?? []).find((f) =>
          f.type.startsWith("image/"),
        );
        if (!file || !uploadRef.current) return false;
        event.preventDefault();
        void insertImageRef.current(file);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const file = Array.from(event.dataTransfer?.files ?? []).find((f) =>
          f.type.startsWith("image/"),
        );
        if (!file || !uploadRef.current) return false;
        event.preventDefault();
        const at = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });
        void insertImageRef.current(file, at?.pos);
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      onChangeRef.current(getMarkdown(current));
      syncSuggest(current);
    },
    onSelectionUpdate: ({ editor: current }) => syncSuggest(current),
    onBlur: () => setSuggest(null),
  });
  editorRef.current = editor;

  // Content replaced from outside — another note opened, a revision restored.
  useEffect(() => {
    if (editor && value !== getMarkdown(editor)) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  // A page added or renamed elsewhere: redraw which links resolve.
  const titlesKey = (links?.targets ?? []).map((t) => t.title).join("\n");
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(wikiLinksKey, titlesKey));
  }, [editor, titlesKey]);

  useEffect(() => {
    if (!handleRef || !editor) return;
    handleRef.current = { focus: (at = "start") => editor.commands.focus(at) };
    return () => {
      handleRef.current = null;
    };
  }, [editor, handleRef]);

  if (!editor) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight }}>
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- a click in the padding focuses the text
    <div
      ref={rootRef}
      data-measure={measure}
      onMouseDown={(event) => {
        // A click in the padding, or in the empty space below the last block,
        // goes to the end — with a fresh line to write on if the document ends
        // in a heading, list, table or code block, as Notion does.
        const target = event.target as HTMLElement;
        const prose = editor.view.dom;
        if (target !== event.currentTarget && target !== prose) return;
        const lastDom = prose.lastElementChild;
        if (
          target === prose &&
          lastDom &&
          event.clientY < lastDom.getBoundingClientRect().bottom
        ) {
          return;
        }
        event.preventDefault();
        const last = editor.state.doc.lastChild;
        const endsOnEmptyLine =
          last?.type.name === "paragraph" && last.content.size === 0;
        if (editor.isEditable && last && !endsOnEmptyLine) {
          editor
            .chain()
            .insertContentAt(editor.state.doc.content.size, {
              type: "paragraph",
            })
            .focus("end")
            .run();
        } else {
          editor.commands.focus("end");
        }
      }}
      className={cn(
        // Never clipped: the block handle hangs in the margin to the left.
        "novel-editor relative",
        // The measure is set here rather than on the text, so the handle in
        // the margin stays beside the column instead of at the page edge.
        measure === "prose" && "mx-auto w-full max-w-[46rem]",
        variant === "field" &&
          "rounded-control border border-input bg-background px-3 py-2 transition-shadow focus-within:ring-2 focus-within:ring-ring",
        className,
      )}
    >
      {editable && variant === "page" && (
        <BlockHandle
          editor={editor}
          containerRef={rootRef}
          blocks={TURN_INTO_COMMANDS}
        />
      )}
      {editable && (
        <BubbleToolbar editor={editor} blocks={TURN_INTO_COMMANDS} />
      )}

      <EditorContent editor={editor} />

      {suggest && items.length > 0 && (
        <SuggestionMenu
          editor={editor}
          at={suggest.match.from}
          label={suggest.kind === "link" ? "Link to a note" : "Insert a block"}
          items={items}
          index={activeIndex}
          onHover={setSuggestIndex}
          onPick={(entry) => pickRef.current(entry)}
        />
      )}

      {onImageUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void insertImage(file);
            event.target.value = "";
          }}
        />
      )}

      {isUploading && (
        <div
          role="status"
          className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-2 rounded-full bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-e2"
        >
          <Loader2 className="size-3 animate-spin" aria-hidden />
          Uploading image…
        </div>
      )}
    </div>
  );
}
