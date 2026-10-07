"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Loader2, PenLine } from "lucide-react";
import { skipToken } from "@reduxjs/toolkit/query";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { Whiteboard } from "@/types";
import {
  useGetWhiteboardQuery,
  useSaveWhiteboardMutation,
} from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { SaveStatus, type SaveState } from "@/components/admin/shared";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";
import { OWNS_SHORTCUTS_ATTR } from "@/lib/editor-shortcuts";
import { getErrorMessage } from "@/lib/utils";
import ExcalidrawCanvasLazy from "./excalidraw-canvas-lazy";
import { usePenInput } from "./use-pen-input";
import { describeSaveState, shouldAutosave } from "./pen-input";
import { useExcalidrawTheme } from "./use-excalidraw-theme";
import {
  isEmptyScene,
  sceneFingerprint,
  sceneFromJson,
  toInitialData,
  withinPreviewBudget,
} from "./scene-io";

interface BoardEditorProps {
  /** Board to open, or null for a blank one. */
  boardId: string | null;
  onClose: () => void;
  /** A blank board got its id on its first save; the page puts it in the URL. */
  onCreated?: (id: string) => void;
}

const AUTOSAVE_IDLE_MS = 2500;

/**
 * Full-screen board editor.
 *
 * One header that belongs to us: back · title · save status · (pen). The
 * board's buttons used to sit inside Excalidraw's own top-right slot, which
 * the library gives to its sidebar when the sidebar is docked (on a tablet,
 * Close and Save vanished while the library panel was open) and which on a
 * phone shares a row with the tool bar (the tools and the Save button were
 * both cut off at the edges).
 *
 * There is no Save button. Autosave runs a moment after the canvas goes
 * still, ⌘S saves at once, and leaving saves first; the only prompt is when
 * that save fails.
 *
 * This is a hand-rolled portal rather than the shared `Dialog`, and has to
 * stay one: Excalidraw appends menus and pickers to `document.body`, and a
 * Radix modal would set `pointer-events: none` on everything outside itself.
 */
export function BoardEditor({ boardId, onClose, onCreated }: BoardEditorProps) {
  // The board this editor was opened on. When a blank board gets an id the
  // URL changes, but this must not: refetching would unmount the canvas
  // mid-drawing and drop its undo history.
  const [openedId] = useState(boardId);
  const {
    data: board,
    isLoading,
    isError,
    error,
  } = useGetWhiteboardQuery(openedId ?? skipToken);
  const isReady = !openedId || (!isLoading && !!board);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus the panel, not the title: a focused input would swallow the
  // canvas shortcuts before anything was drawn.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // The shell behind is covered; letting it scroll moves nothing visible.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={openedId ? "Edit whiteboard" : "New whiteboard"}
      tabIndex={-1}
      {...{ [OWNS_SHORTCUTS_ATTR]: "" }}
      className="fixed inset-0 z-overlay flex flex-col bg-background outline-none"
    >
      {isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="font-medium">This board couldn&apos;t be opened.</p>
          <p className="text-sm text-muted-foreground">
            {getErrorMessage(error)}
          </p>
          <Button variant="outline" onClick={onClose}>
            <ArrowLeft className="mr-2 size-4" aria-hidden /> Back to boards
          </Button>
        </div>
      ) : isReady ? (
        <BoardSurface
          board={openedId ? (board ?? null) : null}
          onClose={onClose}
          onCreated={onCreated}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <Loader2
            className="size-8 animate-spin text-muted-foreground"
            aria-label="Opening the board"
          />
        </div>
      )}
    </div>,
    document.body,
  );
}

function BoardSurface({
  board,
  onClose,
  onCreated,
}: {
  board: Whiteboard | null;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const confirm = useConfirm();
  const theme = useExcalidrawTheme();
  const [title, setTitle] = useState(board?.title ?? "");
  const [isDirty, setIsDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [saveWhiteboard, { isLoading: isSaving }] = useSaveWhiteboardMutation();
  // Re-render the "Saved 2 minutes ago" line now and then.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const pen = usePenInput();
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  // A blank board gets its id on its first save.
  const savedIdRef = useRef<string | null>(board?.id ?? null);
  const lastChangeAt = useRef(0);
  // What the board was when opened or last saved. Compared against, never
  // rendered from.
  const baselineScene = useRef(sceneFingerprint(board?.elements ?? null));
  const baselineTitle = useRef(board?.title ?? "");
  // Set on the first real gesture. Excalidraw's own load-time onChange
  // arrives before any of these and must not count as an edit.
  const hasInteracted = useRef(false);
  const titleRef = useRef(title);
  titleRef.current = title;
  const stateRef = useRef({ isDirty: false, isSaving: false });
  stateRef.current = { isDirty, isSaving };

  const handleApiReady = useCallback((api: ExcalidrawImperativeAPI) => {
    apiRef.current = api;
  }, []);

  /**
   * Dirty is a comparison, not an event: Excalidraw fires onChange for
   * pointer moves, selection and its own load. Dirty means the reader has
   * touched the canvas *and* the drawing differs from the baseline.
   */
  const handleChange = useCallback((elements: readonly unknown[]) => {
    lastChangeAt.current = Date.now();
    const sceneChanged =
      hasInteracted.current &&
      sceneFingerprint(elements) !== baselineScene.current;
    setIsDirty(sceneChanged || titleRef.current !== baselineTitle.current);
  }, []);

  const handleTitleChange = useCallback((next: string) => {
    setTitle(next);
    lastChangeAt.current = Date.now();
    const api = apiRef.current;
    const sceneChanged =
      !!api &&
      hasInteracted.current &&
      sceneFingerprint(api.getSceneElements()) !== baselineScene.current;
    setIsDirty(sceneChanged || next !== baselineTitle.current);
  }, []);

  const persist = useCallback(async (): Promise<boolean> => {
    const api = apiRef.current;
    if (!api) return false;

    // Already loaded: the canvas above pulled the package in.
    const { serializeAsJSON, exportToSvg } = await import(
      "@excalidraw/excalidraw"
    );
    const elements = api.getSceneElements();
    const appState = api.getAppState();
    const files = api.getFiles();
    const scene = sceneFromJson(
      serializeAsJSON(elements, appState, files, "local"),
    );

    let preview: string | null = null;
    if (!isEmptyScene(scene)) {
      try {
        const svg = await exportToSvg({
          elements,
          appState: { ...appState, exportBackground: true },
          files,
          exportPadding: 16,
        });
        preview = withinPreviewBudget(svg.outerHTML) ? svg.outerHTML : null;
      } catch {
        // A missing thumbnail is cosmetic; never fail the save over it.
      }
    }

    const savingTitle = titleRef.current;
    try {
      const saved = await saveWhiteboard({
        ...(savedIdRef.current ? { id: savedIdRef.current } : {}),
        title: savingTitle.trim() || null,
        ...scene,
        preview,
      }).unwrap();

      if (!savedIdRef.current && saved?.id) {
        savedIdRef.current = saved.id;
        onCreated?.(saved.id);
      }
      baselineScene.current = sceneFingerprint(elements);
      baselineTitle.current = savingTitle;
      // Still dirty if the title changed while this was in flight.
      setIsDirty(titleRef.current !== savingTitle);
      setSavedAt(Date.now());
      setFailed(false);
      return true;
    } catch {
      // Quietly: the status says "Not saved" and the next pause tries again.
      setFailed(true);
      return false;
    }
  }, [onCreated, saveWhiteboard]);

  /**
   * Autosave once the surface has been still for a moment. A tablet session
   * ends by locking the screen, which runs no save handler. Polling on a
   * timer keeps this off the drawing path: onChange fires per pointer move.
   */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (
        shouldAutosave({
          isDirty: stateRef.current.isDirty,
          isSaving: stateRef.current.isSaving,
          idleFor: Date.now() - lastChangeAt.current,
          idleThreshold: AUTOSAVE_IDLE_MS,
        })
      ) {
        void persist();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [persist]);

  // The browser's own guard for a closed tab or reload. It cannot save.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!stateRef.current.isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  /** Leaving saves first. The only question is when that save fails. */
  const handleClose = async () => {
    if (leaving) return;
    if (!stateRef.current.isDirty) {
      onClose();
      return;
    }
    setLeaving(true);
    const ok = await persist();
    setLeaving(false);
    if (ok) {
      onClose();
      return;
    }
    const leave = await confirm({
      title: "This board couldn't be saved",
      description:
        "Your latest changes are only on this screen. Stay to try again, or leave without them.",
      confirmText: "Leave without saving",
      cancelText: "Stay",
      variant: "destructive",
    });
    if (leave) onClose();
  };

  const state: SaveState =
    isSaving || leaving
      ? "saving"
      : failed
        ? "error"
        : isDirty
          ? "dirty"
          : savedAt
            ? "saved"
            : "idle";
  const statusText =
    state === "error"
      ? "Not saved — retrying"
      : state === "saved"
        ? describeSaveState({ isSaving: false, isDirty: false, savedAt })
        : undefined;

  return (
    // ⌘S saves now, from the canvas or the title field; the browser's own
    // "Save page" and Excalidraw's "Save to file" both stay out of it.
    <div
      className="flex min-h-0 flex-1 flex-col"
      onKeyDownCapture={(event) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "s"
        ) {
          event.preventDefault();
          event.stopPropagation();
          void persist();
        }
      }}
    >
      <header
        className="flex h-12 shrink-0 items-center gap-1 border-b bg-card px-2 sm:gap-2 sm:px-3"
        onKeyDown={(event) => {
          // Enter in the title hands the keyboard back to the canvas.
          if (
            event.key === "Enter" &&
            event.target instanceof HTMLInputElement
          ) {
            event.currentTarget.closest<HTMLElement>("[role=dialog]")?.focus();
          }
        }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          aria-label="Back to boards"
          title="Back to boards"
          onClick={() => void handleClose()}
          disabled={leaving}
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Button>
        <Input
          value={title}
          onChange={(event) => handleTitleChange(event.target.value)}
          placeholder="Untitled board"
          aria-label="Whiteboard title"
          maxLength={200}
          className="h-9 min-w-0 max-w-xs flex-1 border-transparent bg-transparent px-2 text-sm font-semibold shadow-none hover:border-input focus-visible:border-input"
        />
        {/* Right after the title, where the eye already is. */}
        <SaveStatus state={state} text={statusText} className="shrink-0" />
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {/*
            Shown once a stylus has been used here: on a laptop it answers a
            question nobody asked, and there is no way to know a pen exists
            before one touches the screen.
          */}
          {pen.hasPen && (
            <Toggle
              size="sm"
              pressed={pen.stylusOnly}
              onPressedChange={pen.setStylusOnly}
              aria-label="Draw with pen only"
              title="Draw with pen only — fingers pan and zoom"
              className="h-9"
            >
              <PenLine className="size-4" aria-hidden />
            </Toggle>
          )}
        </div>
      </header>
      {/*
        The drawing surface owns every gesture on it. Without these the
        browser gets there first: a two-finger drag zooms the page, a long
        press raises the selection callout mid-stroke, and a swipe down at the
        top pulls to refresh. On the canvas only, so the title field above
        still takes a tap on an iPad.

        Interaction is noticed here, in the capture phase, because Excalidraw
        offers no "the user did something" signal of its own.
      */}
      <div
        className="min-h-0 flex-1 select-none [-webkit-touch-callout:none]"
        style={{ touchAction: "none", overscrollBehavior: "none" }}
        ref={pen.ref}
        onPointerDownCapture={() => {
          hasInteracted.current = true;
        }}
        onKeyDownCapture={() => {
          hasInteracted.current = true;
        }}
      >
        <ExcalidrawCanvasLazy
          initialData={toInitialData(board)}
          theme={theme}
          onApiReady={handleApiReady}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
