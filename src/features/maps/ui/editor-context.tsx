"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { EditorActions } from "../state/actions";
import type { MapState, MapStore } from "../state/map-store";

/**
 * What every editor component needs: the store, the actions, and the little
 * UI state that is not part of the map (which node is being renamed). Passed
 * by context so the canvas, panels and menus stay free of prop chains.
 */

export interface EditorUi {
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  /** Rename the node and leave edit mode; empty titles are kept as-is. */
  commitTitle: (id: string, title: string) => void;
  notify: (message: string) => void;
  openSearch: () => void;
}

interface EditorContextValue {
  store: MapStore;
  actions: EditorActions;
  ui: EditorUi;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({
  value,
  children,
}: {
  value: EditorContextValue;
  children: ReactNode;
}) {
  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

export function useEditor(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value) throw new Error("useEditor outside <EditorProvider>");
  return value;
}

/**
 * One slice of the map state. The selector must return something stable —
 * a field of the state, not a newly built array — or React will re-render
 * forever; derive with useMemo in the component instead.
 */
export function useMapState<T>(selector: (state: MapState) => T): T {
  const { store } = useEditor();
  const read = () => selector(store.getState());
  return useSyncExternalStore(store.subscribe, read, read);
}
