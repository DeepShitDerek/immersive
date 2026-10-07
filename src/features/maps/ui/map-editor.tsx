"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Panel,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  Link2,
  Loader2,
  ListTree,
  Map as MapIcon,
  Maximize,
  Minus,
  MoreHorizontal,
  PanelRight,
  Plus,
  Redo2,
  Search,
  Trash2,
  Undo2,
  Upload,
  Keyboard,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { MINIMAP_MIN_NODES } from "../state/minimap";
import { OPEN_KEYBOARD_MAP } from "@/features/admin-shell/keyboard-map";
import { cn } from "@/lib/cn";
import { NODE_H, NODE_W } from "../domain/commands";
import { isClip } from "../domain/clipboard";
import { fromDocument } from "../domain/serialize";
import { MapCanvas, type MenuTarget } from "../canvas/map-canvas";
import { createEditorActions } from "../state/actions";
import {
  createAutosaver,
  type SaveOutcome,
  type SaveRequest,
  type SaveStatus,
} from "../state/autosave";
import { isTypingTarget, shortcutFor, shortcutLabel } from "../state/keyboard";
import { createMapStore, type MapStore } from "../state/map-store";
import { DetailsPanel } from "./details-panel";
import {
  EditorProvider,
  useEditor,
  useMapState,
  type EditorUi,
} from "./editor-context";
import { MapContextMenu } from "./map-context-menu";
import { SearchDialog } from "./search-dialog";

/**
 * The Maps editor (§40 layout): header, canvas with a tool rail and zoom bar,
 * and a detail panel that becomes a drawer on small screens.
 *
 * Storage is injected (`save`, `reload`), so the same editor runs against
 * Supabase in the app and against local storage in the dev harness.
 */

export interface MapEditorProps {
  initial: { name: string; doc: unknown; revision: number };
  save: (request: SaveRequest) => Promise<SaveOutcome>;
  /** Fetches the latest saved copy, for resolving a conflict. */
  reload: () => Promise<{ name: string; doc: unknown; revision: number }>;
  onClose: () => void;
}

export function MapEditor(props: MapEditorProps) {
  return (
    <ReactFlowProvider>
      <TooltipProvider delayDuration={400}>
        <EditorShell {...props} />
      </TooltipProvider>
    </ReactFlowProvider>
  );
}

function EditorShell({ initial, save, reload, onClose }: MapEditorProps) {
  const confirm = useConfirm();
  const [store] = useState<MapStore>(() => {
    const loaded = fromDocument(initial.doc);
    if (loaded.repairs.length) {
      // Deferred: a toast during render warns in React.
      queueMicrotask(() => toast.warning(loaded.repairs.join(" ")));
    }
    return createMapStore({
      name: initial.name,
      graph: loaded.graph,
      viewport: loaded.viewport,
      settings: loaded.settings,
    });
  });
  const actions = useMemo(() => createEditorActions(store), [store]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [status, setStatus] = useState<{ value: SaveStatus; detail?: string }>({
    value: "saved",
  });
  const isMobile = useIsMobile();

  const ui: EditorUi = useMemo(
    () => ({
      editingId,
      setEditingId,
      commitTitle: (id, title) => {
        actions.rename(id, title);
        setEditingId(null);
      },
      notify: (message) => toast.info(message),
      openSearch: () => setSearchOpen(true),
    }),
    [actions, editingId],
  );

  /* ── Autosave ────────────────────────────────────────────────────────── */

  const saverRef = useRef<ReturnType<typeof createAutosaver> | null>(null);
  useEffect(() => {
    const saver = createAutosaver({
      store,
      revision: initial.revision,
      save,
      onStatus: (value, detail) => setStatus({ value, detail }),
    });
    saverRef.current = saver;
    const flush = () => void saver.flush();
    const onHidden = () => document.visibilityState === "hidden" && flush();
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (saver.status() !== "saved") {
        flush();
        event.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("beforeunload", onBeforeUnload);
      flush();
      saver.dispose();
    };
    // One autosaver per opened map.
  }, [store]);

  const close = async () => {
    await saverRef.current?.flush();
    onClose();
  };

  const resolveConflict = async (keep: "mine" | "theirs") => {
    const latest = await reload();
    if (keep === "theirs") {
      const loaded = fromDocument(latest.doc);
      store.load({
        name: latest.name,
        graph: loaded.graph,
        viewport: loaded.viewport,
        settings: loaded.settings,
      });
    }
    // Either way the next save is against the latest revision; "mine" saves
    // this copy over theirs right away.
    saverRef.current?.resume(latest.revision);
    if (keep === "mine") void saverRef.current?.flush();
  };

  return (
    <EditorProvider value={{ store, actions, ui }}>
      <div className="flex h-full flex-col bg-background">
        <EditorHeader
          status={status}
          onClose={close}
          onSearch={() => setSearchOpen(true)}
          onTogglePanel={() => setPanelOpen((o) => !o)}
          panelOpen={panelOpen}
        />

        {status.value === "conflict" && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 border-b bg-destructive/10 px-4 py-2 text-sm"
          >
            <AlertCircle className="size-4 text-destructive" aria-hidden />
            <span className="min-w-0 flex-1">
              {status.detail ?? "This map was changed somewhere else."} Autosave
              is paused.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void resolveConflict("theirs")}
            >
              Load the other version
            </Button>
            <Button size="sm" onClick={() => void resolveConflict("mine")}>
              Keep mine
            </Button>
          </div>
        )}

        <div className="relative flex min-h-0 flex-1">
          <CanvasArea
            menuTarget={menuTarget}
            onMenuTarget={setMenuTarget}
            confirmDelete={async () => {
              const impact = actions.deletionImpact();
              if (impact.edges >= 5 || impact.nodes >= 10) {
                const ok = await confirm({
                  title: `Delete ${impact.nodes === 1 ? "this node" : `${impact.nodes} nodes`}?`,
                  description: `This also removes ${impact.edges} connection${impact.edges === 1 ? "" : "s"}. You can undo it.`,
                  confirmText: "Delete",
                  variant: "destructive",
                });
                if (!ok) return;
              }
              const r = actions.deleteSelection();
              if (r.notice) toast.info(r.notice);
            }}
          />

          {panelOpen && !isMobile && (
            <aside
              aria-label="Details"
              className="w-80 shrink-0 overflow-y-auto border-l bg-card p-5"
            >
              <DetailsPanelWithFocus />
            </aside>
          )}
          {isMobile && (
            <MobileDetails open={panelOpen} onOpenChange={setPanelOpen} />
          )}
        </div>

        <SearchDialogWithFocus open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </EditorProvider>
  );
}

/* ── Header ────────────────────────────────────────────────────────────── */

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: "Saved",
  dirty: "Unsaved changes",
  saving: "Saving…",
  error: "Couldn't save — retrying",
  conflict: "Not saved — conflict",
};

function EditorHeader({
  status,
  onClose,
  onSearch,
  onTogglePanel,
  panelOpen,
}: {
  status: { value: SaveStatus; detail?: string };
  onClose: () => void;
  onSearch: () => void;
  onTogglePanel: () => void;
  panelOpen: boolean;
}) {
  const { store, actions } = useEditor();
  const name = useMapState((s) => s.name);
  const history = useMapState((s) => s.history);
  const settings = useMapState((s) => s.settings);
  const fileInput = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  const exportJson = () => {
    const doc = { name, ...store.toDocument() };
    const blob = new Blob([JSON.stringify(doc, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(name || "map").replace(/[^\w.-]+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      toast.error("That file isn't valid JSON.");
      return;
    }
    const loaded = fromDocument(parsed);
    const count = Object.keys(loaded.graph.nodes).length;
    const ok = await confirm({
      title: "Replace this map?",
      description: `The file has ${count} node${count === 1 ? "" : "s"}. It replaces what's on the canvas, and the replacement is saved. Export first if you want a copy.`,
      confirmText: "Replace",
      variant: "destructive",
    });
    if (!ok) return;
    const importedName = (parsed as { name?: unknown })?.name;
    store.load({
      name: typeof importedName === "string" ? importedName : undefined,
      graph: loaded.graph,
      viewport: loaded.viewport,
      settings: loaded.settings,
    });
    toast.success(
      `Imported ${count} node${count === 1 ? "" : "s"}.${loaded.repairs.length ? ` ${loaded.repairs.join(" ")}` : ""}`,
    );
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-2 sm:px-3">
      <IconButton label="Back to maps" onClick={onClose}>
        <ArrowLeft />
      </IconButton>
      <Input
        aria-label="Map name"
        value={name}
        maxLength={200}
        onChange={(e) => store.setName(e.target.value)}
        className="h-9 min-w-0 max-w-xs border-transparent bg-transparent font-semibold shadow-none hover:border-input focus-visible:border-input"
      />
      <SaveBadge status={status} />

      <div className="ml-auto flex items-center gap-1">
        <IconButton
          label="Undo"
          shortcut={shortcutLabel("undo")}
          disabled={history.past.length === 0}
          onClick={() => actions.undo()}
        >
          <Undo2 />
        </IconButton>
        <IconButton
          label="Redo"
          shortcut={shortcutLabel("redo")}
          disabled={history.future.length === 0}
          onClick={() => actions.redo()}
        >
          <Redo2 />
        </IconButton>
        <IconButton
          label="Search or add"
          shortcut={shortcutLabel("search")}
          onClick={onSearch}
        >
          <Search />
        </IconButton>
        <IconButton
          label={panelOpen ? "Hide details" : "Show details"}
          onClick={onTogglePanel}
          pressed={panelOpen}
        >
          <PanelRight />
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuCheckboxItem
              checked={settings.grid}
              onCheckedChange={(v) => store.setSettings({ grid: v })}
            >
              Show grid
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={settings.snap}
              onCheckedChange={(v) => store.setSettings({ snap: v })}
            >
              Snap to grid
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={settings.minimap}
              onCheckedChange={(v) => store.setSettings({ minimap: v })}
            >
              Show minimap
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={exportJson}>
              <Download className="mr-2 size-4" /> Export JSON
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
              <Upload className="mr-2 size-4" /> Import JSON…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                document.dispatchEvent(new Event(OPEN_KEYBOARD_MAP))
              }
            >
              <Keyboard className="mr-2 size-4" /> Keyboard shortcuts
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void importJson(file);
          }}
        />
      </div>
    </header>
  );
}

function SaveBadge({
  status,
}: {
  status: { value: SaveStatus; detail?: string };
}) {
  const { value } = status;
  return (
    <span
      aria-live="polite"
      title={status.detail}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-xs sm:px-2.5",
        value === "saved" && "text-muted-foreground",
        value === "saving" && "text-muted-foreground",
        value === "dirty" && "text-muted-foreground",
        (value === "error" || value === "conflict") &&
          "bg-destructive/10 text-destructive",
      )}
    >
      {value === "saving" ? (
        <Loader2 aria-hidden className="size-3 animate-spin" />
      ) : value === "saved" ? (
        <Check aria-hidden className="size-3" />
      ) : value === "dirty" ? (
        <span aria-hidden className="size-1.5 rounded-full bg-warning" />
      ) : (
        <AlertCircle aria-hidden className="size-3" />
      )}
      <span
        className={cn(
          (value === "saved" || value === "saving" || value === "dirty") &&
            "sr-only sm:not-sr-only",
        )}
      >
        {STATUS_TEXT[value]}
      </span>
    </span>
  );
}

function IconButton({
  label,
  shortcut,
  onClick,
  disabled,
  pressed,
  children,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={shortcut ? `${label} (${shortcut})` : label}
          aria-pressed={pressed}
          disabled={disabled}
          onClick={onClick}
          className="[&_svg]:size-4"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && (
          <span className="ml-2 text-muted-foreground">{shortcut}</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/* ── Canvas area: keyboard, clipboard, tool rail, zoom bar ─────────────── */

function CanvasArea({
  menuTarget,
  onMenuTarget,
  confirmDelete,
}: {
  menuTarget: MenuTarget | null;
  onMenuTarget: (target: MenuTarget) => void;
  confirmDelete: () => Promise<void>;
}) {
  const { actions, ui } = useEditor();
  const flow = useReactFlow();
  const selection = useMapState((s) => s.selection);

  const focusNode = useFocusNode();

  // The handlers read the latest values through a ref, so they are attached
  // once rather than on every selection change.
  const latest = useRef({ actions, ui, selection, flow, confirmDelete });
  latest.current = { actions, ui, selection, flow, confirmDelete };

  /**
   * Shortcuts, copy and paste, listened for on the window while the editor is
   * open. Not on a container: after a rename, a click on empty canvas or a
   * closed menu, focus sits on <body>, and a container listener would never
   * hear the next Tab or Ctrl+Z.
   *
   * Capture phase, so it runs before React Flow's own node key handling:
   * Enter on a focused-but-unselected node must still just select it. Keys
   * aimed at a field, a menu, a dialog or a list are left alone.
   */
  useEffect(() => {
    const inWidget = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(
        target.closest(
          '[role="menu"], [role="menubar"], [role="dialog"], [role="alertdialog"], [role="listbox"], [cmdk-root]',
        ),
      );

    const onKeyDown = (event: KeyboardEvent) => {
      const { actions, ui, selection, flow, confirmDelete } = latest.current;
      if (
        isTypingTarget(event.target) ||
        inWidget(event.target) ||
        ui.editingId
      )
        return;
      const action = shortcutFor(event);
      if (!action) return;
      const hasNode = selection.nodes.length > 0;
      const startEdit = (result: { editNodeId?: string }) => {
        if (result.editNodeId) ui.setEditingId(result.editNodeId);
      };

      const handled = (() => {
        switch (action) {
          case "addChild":
            // Tab only takes over when there is something to add to;
            // otherwise it keeps moving focus, which keyboard users rely on.
            if (!hasNode) return false;
            startEdit(actions.addChild());
            return true;
          case "addSibling":
            if (!hasNode) return false;
            startEdit(actions.addSibling());
            return true;
          case "rename":
            if (selection.nodes.length !== 1) return false;
            ui.setEditingId(selection.nodes[0]);
            return true;
          case "delete":
            if (!hasNode && selection.edges.length === 0) return false;
            void confirmDelete();
            return true;
          case "escape":
            actions.clearSelection();
            return true;
          case "undo":
            actions.undo();
            return true;
          case "redo":
            actions.redo();
            return true;
          case "search":
            ui.openSearch();
            return true;
          case "selectAll":
            actions.selectAll();
            return true;
          case "duplicate":
            if (!hasNode) return false;
            actions.duplicate();
            return true;
          case "connect": {
            const r = actions.connectSelected();
            if (r.notice) ui.notify(r.notice);
            return true;
          }
          case "fit":
            void flow.fitView({ padding: 0.2, duration: 250 });
            return true;
          // Copy and paste use the native clipboard events below.
          case "copy":
          case "paste":
            return false;
        }
      })();
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const onCopy = (event: ClipboardEvent) => {
      const { actions, selection } = latest.current;
      if (isTypingTarget(event.target) || inWidget(event.target)) return;
      if (selection.nodes.length === 0 || !event.clipboardData) return;
      const clip = actions.copy();
      if (!clip) return;
      event.clipboardData.setData("text/plain", JSON.stringify(clip));
      event.preventDefault();
    };

    const onPaste = (event: ClipboardEvent) => {
      const { actions, ui, flow } = latest.current;
      if (isTypingTarget(event.target) || inWidget(event.target)) return;
      const text = event.clipboardData?.getData("text/plain") ?? "";
      event.preventDefault();
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Not JSON: plain text becomes a node (quick add from anywhere).
      }
      if (isClip(parsed) || !text.trim()) {
        const r = actions.paste(parsed);
        if (r.notice) ui.notify(r.notice);
        return;
      }
      const center = flow.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      actions.addNode({
        title: text.trim().slice(0, 500),
        position: { x: center.x - NODE_W / 2, y: center.y - NODE_H / 2 },
      });
    };

    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
    };
  }, []);

  return (
    <div className="relative min-w-0 flex-1 outline-none">
      <MapContextMenu
        target={menuTarget}
        onDeleteRequest={() => void confirmDelete()}
      >
        <div className="h-full w-full">
          <MapCanvas onMenuTarget={onMenuTarget} />
        </div>
      </MapContextMenu>

      <BottomToolbar
        focusNode={focusNode}
        onDelete={() => void confirmDelete()}
      />
      <EmptyHint />
    </div>
  );
}

function useFocusNode() {
  const { store } = useEditor();
  const flow = useReactFlow();
  return useCallback(
    (id: string) => {
      const node = store.getState().graph.nodes[id];
      if (!node) return;
      store.select({ nodes: [id], edges: [] });
      const zoom = Math.max(flow.getZoom(), 1);
      void flow.setCenter(
        node.position.x + NODE_W / 2,
        node.position.y + NODE_H / 2,
        { zoom, duration: 300 },
      );
    },
    [flow, store],
  );
}

/**
 * One toolbar, at the bottom: what you can do to
 * the map, then how you look at it. It replaces a floating rail of four
 * unlabelled icons at the top left and a separate zoom bar, two of four
 * surfaces on an empty canvas. Every button has a name and a tooltip.
 */
function BottomToolbar({
  focusNode,
  onDelete,
}: {
  focusNode: (id: string) => void;
  onDelete: () => void;
}) {
  const { actions, ui, store } = useEditor();
  const selection = useMapState((s) => s.selection);
  const nodeCount = useMapState((s) => Object.keys(s.graph.nodes).length);
  const settings = useMapState((s) => s.settings);
  const flow = useReactFlow();
  const { zoom } = useViewport();
  const isMobile = useIsMobile();
  const hasNode = selection.nodes.length > 0;

  const addHere = () => {
    const center = flow.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    const r = actions.addNode({
      position: { x: center.x - NODE_W / 2, y: center.y - NODE_H / 2 },
    });
    if (r.editNodeId) {
      ui.setEditingId(r.editNodeId);
      focusNode(r.editNodeId);
    }
  };

  return (
    <Panel position="bottom-center" className="!m-3 max-w-[calc(100%-1.5rem)]">
      <div
        role="toolbar"
        aria-label="Map tools"
        className="flex items-center gap-0.5 overflow-x-auto rounded-control border bg-card p-1"
      >
        <IconButton label="Add node" onClick={addHere}>
          <Plus />
        </IconButton>
        <IconButton
          label="Add child"
          shortcut={shortcutLabel("addChild")}
          disabled={!hasNode}
          onClick={() => {
            const r = actions.addChild();
            if (r.editNodeId) ui.setEditingId(r.editNodeId);
          }}
        >
          <ListTree />
        </IconButton>
        <IconButton
          label="Connect selected"
          shortcut={shortcutLabel("connect")}
          disabled={selection.nodes.length < 2}
          onClick={() => {
            const r = actions.connectSelected();
            if (r.notice) ui.notify(r.notice);
          }}
        >
          <Link2 />
        </IconButton>
        <IconButton
          label="Delete selected"
          shortcut={shortcutLabel("delete")}
          disabled={!hasNode && selection.edges.length === 0}
          onClick={onDelete}
        >
          <Trash2 />
        </IconButton>

        <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />

        <IconButton
          label="Zoom out"
          onClick={() => void flow.zoomOut({ duration: 150 })}
        >
          <Minus />
        </IconButton>
        <button
          type="button"
          onClick={() => void flow.zoomTo(1, { duration: 150 })}
          className="h-9 min-w-12 shrink-0 rounded-md px-1 text-xs tabular-nums text-muted-foreground hover:bg-secondary focus-ring"
          aria-label={`Zoom ${Math.round(zoom * 100)}%. Reset to 100%`}
        >
          {Math.round(zoom * 100)}%
        </button>
        <IconButton
          label="Zoom in"
          onClick={() => void flow.zoomIn({ duration: 150 })}
        >
          <Plus />
        </IconButton>
        <IconButton
          label="Fit to screen"
          shortcut={shortcutLabel("fit")}
          onClick={() => void flow.fitView({ padding: 0.2, duration: 250 })}
        >
          <Maximize />
        </IconButton>
        {/* Only where the overview can appear: a big enough map, a big
            enough screen. */}
        {!isMobile && nodeCount > MINIMAP_MIN_NODES && (
          <IconButton
            label={settings.minimap ? "Hide overview" : "Show overview"}
            pressed={settings.minimap}
            onClick={() => store.setSettings({ minimap: !settings.minimap })}
          >
            <MapIcon />
          </IconButton>
        )}
      </div>
    </Panel>
  );
}

function EmptyHint() {
  const count = useMapState((s) => Object.keys(s.graph.nodes).length);
  // Copy for the pointer in hand: a phone can neither double-click nor Tab.
  const coarse = useCoarsePointer();
  if (count > 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <p className="font-heading text-lg font-semibold">
          Start with what&apos;s on your mind
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {coarse ? (
            <>
              Tap ＋ below to add your first idea. Select it, then add a child
              or connect it to another from the same bar.
            </>
          ) : (
            <>
              Double-click anywhere to add a node, or ＋ in the toolbar below.
              Then Tab adds a child, Enter a sibling, and any node connects to
              any other.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function DetailsPanelWithFocus() {
  const focusNode = useFocusNode();
  return <DetailsPanel onFocusNode={focusNode} />;
}

function SearchDialogWithFocus(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const focusNode = useFocusNode();
  return <SearchDialog {...props} onFocusNode={focusNode} />;
}

function MobileDetails({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const focusNode = useFocusNode();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70dvh] overflow-y-auto">
        <SheetTitle className="sr-only">Details</SheetTitle>
        <DetailsPanel onFocusNode={focusNode} />
      </SheetContent>
    </Sheet>
  );
}
