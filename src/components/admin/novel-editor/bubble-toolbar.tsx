"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { NodeSelection } from "@tiptap/pm/state";
import {
  Bold,
  Check,
  ChevronDown,
  Code,
  Highlighter,
  Italic,
  Link as LinkIcon,
  Strikethrough,
  Underline,
  Unlink,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { linkFromInput } from "./link-url";
import { activeBlock, type BlockCommand } from "./slash-commands";

const MARKS = [
  {
    mark: "bold",
    label: "Bold",
    keys: "Ctrl+B",
    icon: Bold,
    toggle: (e: Editor) => e.chain().focus().toggleBold().run(),
  },
  {
    mark: "italic",
    label: "Italic",
    keys: "Ctrl+I",
    icon: Italic,
    toggle: (e: Editor) => e.chain().focus().toggleItalic().run(),
  },
  {
    mark: "underline",
    label: "Underline",
    keys: "Ctrl+U",
    icon: Underline,
    toggle: (e: Editor) => e.chain().focus().toggleUnderline().run(),
  },
  {
    mark: "strike",
    label: "Strikethrough",
    keys: "Ctrl+Shift+S",
    icon: Strikethrough,
    toggle: (e: Editor) => e.chain().focus().toggleStrike().run(),
  },
  {
    mark: "code",
    label: "Inline code",
    keys: "Ctrl+E",
    icon: Code,
    toggle: (e: Editor) => e.chain().focus().toggleCode().run(),
  },
  {
    mark: "highlight",
    label: "Highlight",
    keys: "Ctrl+Shift+H",
    icon: Highlighter,
    toggle: (e: Editor) => e.chain().focus().toggleHighlight().run(),
  },
] as const;

/**
 * Formatting appears where the selection is, only when there is one.
 *
 * This replaces a permanent toolbar of thirty-odd buttons that sat on top of
 * every editor — the "attachment" look — and cost a row of screen on a phone
 * whether or not anything was being formatted.
 */
export function BubbleToolbar({
  editor,
  blocks,
}: {
  editor: Editor;
  blocks: BlockCommand[];
}) {
  const [panel, setPanel] = useState<null | "turn" | "link">(null);
  const panelRef = useRef(panel);
  panelRef.current = panel;
  const [href, setHref] = useState("");
  const [badLink, setBadLink] = useState(false);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      marks: MARKS.map((m) => e.isActive(m.mark)),
      link: (e.getAttributes("link").href as string | undefined) ?? null,
      block: activeBlock(e).id,
      empty: e.state.selection.empty,
    }),
  });

  useEffect(() => {
    if (state.empty && panelRef.current === "turn") setPanel(null);
  }, [state.empty]);

  const current = blocks.find((b) => b.id === state.block) ?? blocks[0];

  const applyLink = () => {
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setPanel(null);
      return;
    }
    const url = linkFromInput(href);
    if (!url) {
      setBadLink(true);
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setPanel(null);
  };

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor: e, state: s }) => {
        if (!e.isEditable) return false;
        // The link field takes focus from the text; keep the bar up for it.
        if (panelRef.current === "link") return true;
        const { selection } = s;
        if (selection.empty || selection instanceof NodeSelection) return false;
        if (e.isActive("codeBlock")) return false;
        return e.view.hasFocus();
      }}
      className="z-overlay"
    >
      <div className="rounded-control bg-popover p-1 text-popover-foreground shadow-e3">
        {panel === "link" ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              applyLink();
            }}
          >
            <input
              aria-label="Link address"
              aria-invalid={badLink}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- opened on purpose by the Link button
              autoFocus
              value={href}
              onChange={(event) => {
                setHref(event.target.value);
                setBadLink(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setPanel(null);
                  editor.commands.focus();
                }
              }}
              placeholder="Paste or type a link"
              className={cn(
                "h-8 w-56 rounded-control bg-background px-2 text-sm focus-ring",
                badLink && "ring-2 ring-destructive",
              )}
            />
            <ToolButton label="Apply link" onClick={applyLink}>
              <Check />
            </ToolButton>
            {state.link && (
              <ToolButton
                label="Remove link"
                onClick={() => {
                  editor
                    .chain()
                    .focus()
                    .extendMarkRange("link")
                    .unsetLink()
                    .run();
                  setPanel(null);
                }}
              >
                <Unlink />
              </ToolButton>
            )}
          </form>
        ) : (
          <>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-expanded={panel === "turn"}
                aria-label={`Turn into — now ${current.title}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setPanel((p) => (p === "turn" ? null : "turn"))}
                className="flex h-8 items-center gap-1 whitespace-nowrap rounded-control px-2 text-sm font-medium transition-colors hover:bg-secondary focus-ring"
              >
                {current.title}
                <ChevronDown
                  className="size-3.5 text-muted-foreground"
                  aria-hidden
                />
              </button>
              <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
              {MARKS.map((m, i) => {
                const Icon = m.icon;
                return (
                  <ToolButton
                    key={m.mark}
                    label={m.label}
                    title={`${m.label} (${m.keys})`}
                    active={state.marks[i]}
                    onClick={() => m.toggle(editor)}
                  >
                    <Icon />
                  </ToolButton>
                );
              })}
              <ToolButton
                label="Link"
                active={!!state.link}
                onClick={() => {
                  setHref(state.link ?? "");
                  setBadLink(false);
                  setPanel("link");
                }}
              >
                <LinkIcon />
              </ToolButton>
            </div>

            {panel === "turn" && (
              <div
                role="menu"
                aria-label="Turn into"
                className="mt-1 max-h-64 overflow-y-auto border-t border-border pt-1"
              >
                {blocks.map((b) => {
                  const Icon = b.icon;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      role="menuitem"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        b.run(editor);
                        setPanel(null);
                      }}
                      className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary focus-ring"
                    >
                      <Icon
                        className="size-4 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="flex-1">{b.title}</span>
                      {b.id === current.id && (
                        <Check className="size-3.5" aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </BubbleMenu>
  );
}

function ToolButton({
  label,
  title,
  active,
  onClick,
  children,
}: {
  label: string;
  title?: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      aria-pressed={active}
      // Keeps the text selection while the button is pressed.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-control transition-colors [&_svg]:size-4",
        "focus-ring",
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
