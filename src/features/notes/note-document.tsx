"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  MoreHorizontal,
  Pin,
  PinOff,
  Tag,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Note } from "@/types";
import { useUpdateNoteMutation } from "@/store/api/adminApi";
import NovelEditor from "@/components/admin/novel-editor";
import type { NovelEditorHandle } from "@/components/admin/novel-editor/novel-editor";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TagInput } from "@/components/ui/tag-input";
import { NOTE_COLORS } from "@/lib/constants";
import { noteSchema } from "@/lib/schemas";
import { getErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/cn";
import {
  SaveStatus,
  type SaveState as StatusState,
} from "@/components/admin/shared";
import { NoteConnections } from "./note-connections";
import { indexByTitle, normalizeTitle } from "./note-links";
import { noteLabel } from "./note-title";

/** Long enough to stay out of the way while typing, short enough to trust. */
const AUTOSAVE_DELAY = 800;

type SaveState = "saved" | "pending" | "saving" | "error";

interface Draft {
  title: string;
  content: string;
  tags: string[];
  color: string | null;
}

function isDraftEmpty(draft: Draft): boolean {
  return (
    !draft.title.trim() && !draft.content.trim() && draft.tags.length === 0
  );
}

/**
 * One note, open — as a page rather than a card.
 *
 * The first version put the note in a tinted box with a row of seven buttons
 * across its top and a Read/Edit switch, which made it a form you operated
 * rather than a page you wrote on. Now:
 *
 * - The note is on the page ground, at a reading width. A thin bar above it
 *   says where you are and whether it saved; pin is the one action worth a
 *   button, and colour, archive and delete are in the "More" menu.
 * - The colour is a cover band across the top, the way Notion shows a cover.
 * - Title, then properties (tags, edited, created), then the body.
 * - There is no reading mode. `[[links]]` are live inside the editor itself —
 *   decorated and followed on click — and typing `[[` offers every other note,
 *   so the reason a reading mode existed is gone.
 *
 * It saves itself a moment after you stop typing (Ctrl + S at once), flushes
 * on the way out, and every write still goes through `noteSchema`.
 */
export function NoteDocument({
  note,
  notes,
  onBack,
  onOpenNote,
  onCreateLinked,
  onTogglePin,
  onArchive,
  onDelete,
  onEmptyChange,
}: {
  note: Note;
  /** Every note, so links resolve against titles. */
  notes: Note[];
  onBack: () => void;
  onOpenNote: (note: Note) => void;
  onCreateLinked: (title: string) => void;
  onTogglePin: () => void;
  onArchive: () => void;
  onDelete: () => void;
  /** Reports whether the note is still blank — a new note left blank is discarded. */
  onEmptyChange?: (empty: boolean) => void;
}) {
  // Seeded at mount; the page keys this component by note id, so a refetch
  // after an autosave never overwrites what is being typed.
  const [draft, setDraft] = useState<Draft>(() => ({
    title: note.title ?? "",
    content: note.content ?? "",
    tags: note.tags ?? [],
    color: note.color ?? null,
  }));
  const [tagDraft, setTagDraft] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [savedThisVisit, setSavedThisVisit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const editorHandle = useRef<NovelEditorHandle | null>(null);

  const [updateNote] = useUpdateNoteMutation();
  const latest = useRef(draft);
  latest.current = draft;
  const dirty = useRef(false);

  const persist = useCallback(async () => {
    if (!dirty.current) return;
    const current = latest.current;
    const data: Partial<Note> = {
      title: current.title.trim() || null,
      content: current.content.trim() ? current.content : null,
      tags: current.tags.length > 0 ? current.tags : null,
      color: current.color,
    };

    const parsed = noteSchema.safeParse(data);
    if (!parsed.success) {
      setSaveState("error");
      setError(parsed.error.issues[0]?.message ?? "This note can't be saved.");
      return;
    }

    dirty.current = false;
    setSaveState("saving");
    try {
      await updateNote({ id: note.id, ...data }).unwrap();
      setError(null);
      setSavedThisVisit(true);
      setSaveState(dirty.current ? "pending" : "saved");
    } catch (err: unknown) {
      dirty.current = true;
      setSaveState("error");
      setError(getErrorMessage(err));
    }
  }, [note.id, updateNote]);

  const persistRef = useRef(persist);
  persistRef.current = persist;

  const change = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    dirty.current = true;
    setSaveState("pending");
  };

  // Save once typing pauses.
  useEffect(() => {
    if (saveState !== "pending") return;
    const timer = setTimeout(() => void persistRef.current(), AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [draft, saveState]);

  // Leaving the note saves what is still waiting rather than dropping it.
  useEffect(
    () => () => {
      if (dirty.current) void persistRef.current();
    },
    [],
  );

  // A closed tab or a reload runs no cleanup, so ask while anything is unsaved.
  useEffect(() => {
    if (saveState === "saved") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  useEffect(() => {
    onEmptyChange?.(isDraftEmpty(draft));
  }, [draft, onEmptyChange]);

  /** The notes as they will be once this draft is saved. */
  const liveNotes = useMemo(
    () =>
      notes.some((n) => n.id === note.id)
        ? notes.map((n) =>
            n.id === note.id
              ? { ...n, title: draft.title, content: draft.content }
              : n,
          )
        : [...notes, { ...note, title: draft.title, content: draft.content }],
    [notes, note, draft.title, draft.content],
  );

  /** Every other note with a title, as something `[[` can link to. */
  const targets = useMemo(
    () =>
      notes
        .filter((n) => n.id !== note.id && n.title?.trim())
        .map((n) => ({ id: n.id, title: (n.title ?? "").trim() })),
    [notes, note.id],
  );

  const openLink = (title: string) => {
    const found = indexByTitle(liveNotes).get(normalizeTitle(title));
    if (!found) onCreateLinked(title);
    else if (found.id !== note.id) onOpenNote(found);
  };
  const openLinkRef = useRef(openLink);
  openLinkRef.current = openLink;
  const links = useMemo(
    () => ({ targets, onOpen: (title: string) => openLinkRef.current(title) }),
    [targets],
  );

  const label = noteLabel({ title: draft.title, content: draft.content });

  const status: { state: StatusState; text?: string } | null =
    saveState === "error"
      ? null
      : saveState === "pending" || saveState === "saving"
        ? { state: "saving" }
        : savedThisVisit
          ? { state: "saved" }
          : note.updated_at
            ? {
                state: "idle",
                text: `Edited ${formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}`,
              }
            : null;

  const edited = savedThisVisit
    ? "Just now"
    : note.updated_at
      ? formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })
      : "—";

  return (
    <div
      className="min-w-0"
      onKeyDown={(event) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "s"
        ) {
          event.preventDefault();
          void persist();
        }
      }}
    >
      {/* Where you are, whether it saved, and the few actions a note has. */}
      <div className="flex h-10 items-center gap-1 text-sm">
        <button
          type="button"
          onClick={onBack}
          aria-label="All notes"
          className="-ml-2 inline-flex items-center gap-1 rounded-control px-2 py-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-ring md:hidden"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Notes
        </button>
        <span className="hidden min-w-0 items-center gap-1.5 text-muted-foreground md:flex">
          Notes
          <ChevronRight className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate text-foreground">{label.text}</span>
        </span>

        <div className="ml-auto flex min-w-0 items-center gap-1">
          {status && (
            <SaveStatus
              state={status.state}
              text={status.text}
              className="mr-1"
            />
          )}
          {saveState === "error" && error && (
            <p role="alert" className="mr-1 truncate text-xs text-destructive">
              Not saved: {error}{" "}
              <button
                type="button"
                onClick={() => {
                  dirty.current = true;
                  void persist();
                }}
                className="font-medium underline underline-offset-2"
              >
                Try again
              </button>
            </p>
          )}

          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={note.is_pinned ? "Unpin note" : "Pin note"}
            title={note.is_pinned ? "Unpin" : "Pin"}
            onClick={onTogglePin}
            className={cn("size-8", note.is_pinned && "text-primary")}
          >
            {note.is_pinned ? (
              <PinOff className="size-4" aria-hidden />
            ) : (
              <Pin className="size-4" aria-hidden />
            )}
          </Button>

          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="More actions"
                className="size-8"
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-1">
              <p className="px-2 pb-1.5 pt-1.5 text-xs font-medium text-muted-foreground">
                Colour
              </p>
              <div
                role="group"
                aria-label="Note colour"
                className="flex flex-wrap gap-1.5 px-2 pb-2"
              >
                <button
                  type="button"
                  onClick={() => change({ color: null })}
                  aria-label="No colour"
                  aria-pressed={draft.color === null}
                  className="flex size-6 items-center justify-center rounded-full border border-dashed hover:bg-muted focus-ring"
                >
                  <X className="size-3 text-muted-foreground" aria-hidden />
                </button>
                {NOTE_COLORS.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => change({ color: swatch })}
                    aria-label={`Use colour ${swatch}`}
                    aria-pressed={draft.color === swatch}
                    style={{ backgroundColor: swatch }}
                    className="flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-popover transition-shadow duration-fast hover:ring-2 hover:ring-border focus-ring"
                  >
                    {draft.color === swatch && (
                      <Check className="size-3.5 text-white" aria-hidden />
                    )}
                  </button>
                ))}
              </div>
              <div className="my-1 h-px bg-border" aria-hidden />
              <MenuButton
                icon={note.archived_at ? ArchiveRestore : Archive}
                onClick={() => {
                  setMenuOpen(false);
                  onArchive();
                }}
              >
                {note.archived_at ? "Restore note" : "Archive note"}
              </MenuButton>
              <MenuButton
                icon={Trash2}
                destructive
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                Delete note
              </MenuButton>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {draft.color && (
        <div
          aria-hidden
          data-testid="note-cover"
          // A rule in the note's colour, not a gradient cover: the colour
          // marks the note, the page stays text.
          className="mt-2 h-1 rounded-full"
          // Per-note user data, not a theme token, so it cannot be a class.
          // Mixed toward the theme's ground so it sits in any preset.
          style={{
            background: `color-mix(in srgb, ${draft.color} 75%, hsl(var(--background)))`,
          }}
        />
      )}

      {/* The side padding on wide screens is the editor's block-handle margin. */}
      <article
        aria-label={label.text}
        className={cn(
          "mx-auto w-full max-w-3xl pb-24 sm:px-12",
          draft.color ? "pt-6" : "pt-8",
        )}
      >
        {note.archived_at && (
          <p className="mb-5 rounded-control bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">
            Archived {format(new Date(note.archived_at), "MMM d, yyyy")} — out
            of the list, nothing lost.{" "}
            <button
              type="button"
              onClick={onArchive}
              className="font-medium text-foreground underline underline-offset-2"
            >
              Restore
            </button>
          </p>
        )}

        <textarea
          aria-label="Note title"
          rows={1}
          value={draft.title}
          onChange={(event) => change({ title: event.target.value })}
          onKeyDown={(event) => {
            // Enter goes to the body, as in any page editor.
            if (event.key === "Enter") {
              event.preventDefault();
              editorHandle.current?.focus("start");
            }
          }}
          // A new note opens here, ready to type.
          // eslint-disable-next-line jsx-a11y/no-autofocus -- a blank note exists to be written in
          autoFocus={!note.title && !note.content}
          placeholder="Untitled"
          className="block w-full resize-none overflow-hidden bg-transparent font-heading text-3xl font-bold leading-tight tracking-tight text-foreground outline-none [field-sizing:content] placeholder:text-muted-foreground/40 sm:text-4xl"
        />

        <dl className="mt-5 grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-sm">
          <Property icon={Tag} label="Tags">
            <TagInput
              tags={draft.tags}
              onTagsChange={(tags) => change({ tags })}
              draft={tagDraft}
              onDraftChange={setTagDraft}
              placeholder="Add a tag"
            />
          </Property>
          <Property icon={Clock} label="Edited">
            <span className="text-muted-foreground">{edited}</span>
          </Property>
          {note.created_at && (
            <Property icon={CalendarDays} label="Created">
              <span className="text-muted-foreground">
                {format(new Date(note.created_at), "MMM d, yyyy")}
              </span>
            </Property>
          )}
        </dl>

        <div className="mb-6 mt-5 h-px bg-border" aria-hidden />

        <NovelEditor
          value={draft.content}
          onChange={(content) => change({ content })}
          placeholder="Start writing — '/' for blocks, '[[' to link a note…"
          minHeight="40vh"
          links={links}
          handleRef={editorHandle}
        />

        <NoteConnections
          note={note}
          notes={liveNotes}
          onOpen={onOpenNote}
          onCreate={onCreateLinked}
        />
      </article>
    </div>
  );
}

function Property({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="flex items-center gap-2 py-1 text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {label}
      </dt>
      <dd className="min-w-0 py-1">{children}</dd>
    </>
  );
}

function MenuButton({
  icon: Icon,
  destructive,
  onClick,
  children,
}: {
  icon: LucideIcon;
  destructive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm transition-colors",
        "focus-ring",
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "hover:bg-secondary",
      )}
    >
      <Icon className="size-4 shrink-0 opacity-70" aria-hidden />
      {children}
    </button>
  );
}
