import { applyAll, type GraphMutation } from "./mutations";
import type { Graph } from "./types";

/**
 * Undo/redo as data (§20).
 *
 * An entry is the mutations that were applied and their inverses. Undo applies
 * the inverses; redo applies the originals again. Because every edit goes
 * through `execute`, nothing can change the graph without being undoable.
 *
 * Consecutive edits with the same `mergeKey` inside `MERGE_WINDOW_MS` become
 * one entry — typing a title is one undo step, not one per keystroke.
 */

interface HistoryEntry {
  label: string;
  forward: GraphMutation[];
  inverse: GraphMutation[];
  mergeKey?: string;
  at: number;
}

export interface History {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

export const EMPTY_HISTORY: History = { past: [], future: [] };
const HISTORY_LIMIT = 300;
const MERGE_WINDOW_MS = 1200;

export interface ExecuteResult {
  graph: Graph;
  history: History;
  /** False when there was nothing to do; the history is unchanged. */
  changed: boolean;
}

export function execute(
  graph: Graph,
  history: History,
  label: string,
  mutations: readonly GraphMutation[],
  options: { mergeKey?: string; at?: number; now?: string } = {},
): ExecuteResult {
  if (mutations.length === 0) return { graph, history, changed: false };
  const at = options.at ?? Date.now();
  const applied = applyAll(graph, mutations, options.now);

  const last = history.past[history.past.length - 1];
  const merge =
    options.mergeKey !== undefined &&
    last?.mergeKey === options.mergeKey &&
    at - last.at <= MERGE_WINDOW_MS;

  const entry: HistoryEntry = merge
    ? {
        label: last.label,
        forward: [...last.forward, ...mutations],
        // The older inverse must run last: it restores the original state.
        inverse: [...applied.inverse, ...last.inverse],
        mergeKey: last.mergeKey,
        at,
      }
    : {
        label,
        forward: [...mutations],
        inverse: applied.inverse,
        mergeKey: options.mergeKey,
        at,
      };

  const past = merge
    ? [...history.past.slice(0, -1), entry]
    : [...history.past, entry];
  return {
    graph: applied.graph,
    history: { past: past.slice(-HISTORY_LIMIT), future: [] },
    changed: true,
  };
}

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.future.length > 0;
}

export function undo(
  graph: Graph,
  history: History,
  now?: string,
): ExecuteResult {
  const entry = history.past[history.past.length - 1];
  if (!entry) return { graph, history, changed: false };
  const { graph: next } = applyAll(graph, entry.inverse, now);
  return {
    graph: next,
    history: {
      past: history.past.slice(0, -1),
      // No merging across an undo: the next edit starts a fresh step.
      future: [{ ...entry, mergeKey: undefined }, ...history.future],
    },
    changed: true,
  };
}

export function redo(
  graph: Graph,
  history: History,
  now?: string,
): ExecuteResult {
  const [entry, ...rest] = history.future;
  if (!entry) return { graph, history, changed: false };
  const { graph: next } = applyAll(graph, entry.forward, now);
  return {
    graph: next,
    history: { past: [...history.past, entry], future: rest },
    changed: true,
  };
}
