import { defaultEnv, type Env } from "../domain/commands";
import {
  EMPTY_HISTORY,
  canRedo,
  canUndo,
  execute,
  redo as redoHistory,
  undo as undoHistory,
  type History,
} from "../domain/history";
import type { GraphMutation } from "../domain/mutations";
import {
  DEFAULT_SETTINGS,
  DEFAULT_VIEWPORT,
  toDocument,
  type MapDocument,
  type MapSettings,
  type Viewport,
} from "../domain/serialize";
import { EMPTY_GRAPH, type Graph } from "../domain/types";

/**
 * The editor's state, outside React (§44: Graph State layer).
 *
 * One object holds the graph, its history, the selection and the view. Every
 * graph change goes through `run`, so it is recorded for undo; components read
 * slices through `useMap` (use-map.ts) and re-render only when their slice
 * changes. Nothing here knows about the canvas library.
 */

interface Selection {
  nodes: readonly string[];
  edges: readonly string[];
}

const EMPTY_SELECTION: Selection = { nodes: [], edges: [] };

export interface MapState {
  name: string;
  graph: Graph;
  history: History;
  selection: Selection;
  viewport: Viewport;
  settings: MapSettings;
  /** Bumped by every change that should be saved. Autosave watches this. */
  version: number;
}

interface RunOptions {
  /** Consecutive runs with the same key within a second merge into one undo. */
  mergeKey?: string;
  /** Selection to apply afterwards — e.g. the node just created. */
  select?: Selection;
}

export interface MapStore {
  getState(): MapState;
  subscribe(listener: () => void): () => void;
  /** Applies mutations as one undoable step. Returns false if nothing changed. */
  run(
    label: string,
    mutations: readonly GraphMutation[],
    options?: RunOptions,
  ): boolean;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  select(selection: Selection): void;
  setViewport(viewport: Viewport): void;
  setSettings(patch: Partial<MapSettings>): void;
  setName(name: string): void;
  /** Replaces everything, e.g. after importing JSON. Clears history. */
  load(next: {
    name?: string;
    graph: Graph;
    viewport?: Viewport;
    settings?: MapSettings;
  }): void;
  toDocument(): MapDocument;
  env: Env;
}

/** Drops selected ids that no longer exist, keeping the same object when unchanged. */
function pruneSelection(selection: Selection, graph: Graph): Selection {
  const nodes = selection.nodes.filter((id) => graph.nodes[id]);
  const edges = selection.edges.filter((id) => graph.edges[id]);
  return nodes.length === selection.nodes.length &&
    edges.length === selection.edges.length
    ? selection
    : { nodes, edges };
}

export function createMapStore(
  initial: Partial<Omit<MapState, "history" | "version" | "selection">> = {},
  env: Env = defaultEnv,
): MapStore {
  let state: MapState = {
    name: initial.name ?? "Untitled map",
    graph: initial.graph ?? EMPTY_GRAPH,
    history: EMPTY_HISTORY,
    selection: EMPTY_SELECTION,
    viewport: initial.viewport ?? { ...DEFAULT_VIEWPORT },
    settings: initial.settings ?? { ...DEFAULT_SETTINGS },
    version: 0,
  };
  const listeners = new Set<() => void>();

  const set = (next: MapState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    env,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    run(label, mutations, options = {}) {
      const result = execute(state.graph, state.history, label, mutations, {
        mergeKey: options.mergeKey,
        now: env.now(),
      });
      if (!result.changed) return false;
      set({
        ...state,
        graph: result.graph,
        history: result.history,
        selection: pruneSelection(
          options.select ?? state.selection,
          result.graph,
        ),
        version: state.version + 1,
      });
      return true;
    },

    undo() {
      const result = undoHistory(state.graph, state.history, env.now());
      if (!result.changed) return false;
      set({
        ...state,
        graph: result.graph,
        history: result.history,
        selection: pruneSelection(state.selection, result.graph),
        version: state.version + 1,
      });
      return true;
    },

    redo() {
      const result = redoHistory(state.graph, state.history, env.now());
      if (!result.changed) return false;
      set({
        ...state,
        graph: result.graph,
        history: result.history,
        selection: pruneSelection(state.selection, result.graph),
        version: state.version + 1,
      });
      return true;
    },

    canUndo: () => canUndo(state.history),
    canRedo: () => canRedo(state.history),

    select(selection) {
      const next = pruneSelection(selection, state.graph);
      const same =
        next.nodes.length === state.selection.nodes.length &&
        next.edges.length === state.selection.edges.length &&
        next.nodes.every((id, i) => id === state.selection.nodes[i]) &&
        next.edges.every((id, i) => id === state.selection.edges[i]);
      if (!same) set({ ...state, selection: next });
    },

    setViewport(viewport) {
      const v = state.viewport;
      if (v.x === viewport.x && v.y === viewport.y && v.zoom === viewport.zoom)
        return;
      // Saved (reopening restores the view) but never an undo step.
      set({ ...state, viewport: { ...viewport }, version: state.version + 1 });
    },

    setSettings(patch) {
      set({
        ...state,
        settings: { ...state.settings, ...patch },
        version: state.version + 1,
      });
    },

    setName(name) {
      const trimmed = name.slice(0, 200);
      if (trimmed === state.name) return;
      set({ ...state, name: trimmed, version: state.version + 1 });
    },

    load(next) {
      set({
        ...state,
        name: next.name ?? state.name,
        graph: next.graph,
        history: EMPTY_HISTORY,
        selection: EMPTY_SELECTION,
        viewport: next.viewport ?? state.viewport,
        settings: next.settings ?? state.settings,
        version: state.version + 1,
      });
    },

    toDocument: () => toDocument(state.graph, state.viewport, state.settings),
  };
}
