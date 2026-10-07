import type { MapStore } from "./map-store";

/**
 * Debounced autosave for one open map (§34).
 *
 * Watches the store's `version`. After `delay` ms without further changes it
 * saves the whole document; changes that land while a save is in flight are
 * saved right after it. Every save names the revision it expects, and a
 * conflict stops autosave until the person decides what to do — silently
 * overwriting another tab's work is the one outcome worse than not saving.
 *
 * Framework-agnostic; the timer functions are injectable for tests.
 */

export type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict";

export interface SaveRequest {
  expectedRevision: number;
  name: string;
  doc: unknown;
  nodeCount: number;
  edgeCount: number;
}

export type SaveOutcome =
  | { ok: true; revision: number }
  | { ok: false; conflict: boolean; message: string };

export interface AutosaverOptions {
  store: MapStore;
  revision: number;
  save: (request: SaveRequest) => Promise<SaveOutcome>;
  delay?: number;
  onStatus?: (status: SaveStatus, detail?: string) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface Autosaver {
  status(): SaveStatus;
  revision(): number;
  /** Saves now if there are unsaved changes; resolves when settled. */
  flush(): Promise<void>;
  /** After a conflict: take over with this revision and save on the next change. */
  resume(revision: number): void;
  dispose(): void;
}

export function createAutosaver({
  store,
  revision: initialRevision,
  save,
  delay = 800,
  onStatus,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (handle) =>
    clearTimeout(handle as ReturnType<typeof setTimeout>),
}: AutosaverOptions): Autosaver {
  let revision = initialRevision;
  let savedVersion = store.getState().version;
  let status: SaveStatus = "saved";
  let timer: unknown = null;
  let inFlight: Promise<void> | null = null;
  let disposed = false;

  // Announces changes only: every keystroke makes the map "dirty" again, and
  // re-reporting the same status would re-render the save indicator each time.
  let lastDetail: string | undefined;
  const setStatus = (next: SaveStatus, detail?: string) => {
    if (next === status && detail === lastDetail) return;
    status = next;
    lastDetail = detail;
    onStatus?.(next, detail);
  };

  const cancelTimer = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  const run = async (): Promise<void> => {
    cancelTimer();
    if (status === "conflict" || disposed) return;
    const state = store.getState();
    if (state.version === savedVersion) {
      if (status !== "saved") setStatus("saved");
      return;
    }
    const version = state.version;
    setStatus("saving");
    const outcome = await save({
      expectedRevision: revision,
      name: state.name,
      doc: store.toDocument(),
      nodeCount: Object.keys(state.graph.nodes).length,
      edgeCount: Object.keys(state.graph.edges).length,
    });
    if (outcome.ok) {
      revision = outcome.revision;
      savedVersion = version;
      // Edits made while saving are still unsaved: go again.
      if (store.getState().version !== savedVersion) {
        setStatus("dirty");
        schedule();
      } else {
        setStatus("saved");
      }
    } else if (outcome.conflict) {
      setStatus("conflict", outcome.message);
    } else {
      setStatus("error", outcome.message);
      schedule(delay * 4);
    }
  };

  const start = (): Promise<void> => {
    if (inFlight) return inFlight;
    inFlight = run().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  function schedule(ms = delay) {
    cancelTimer();
    if (disposed || status === "conflict") return;
    timer = setTimer(() => {
      timer = null;
      void start();
    }, ms);
  }

  const unsubscribe = store.subscribe(() => {
    if (store.getState().version === savedVersion) return;
    if (status === "conflict") return;
    if (status !== "saving") setStatus("dirty");
    if (!inFlight) schedule();
  });

  return {
    status: () => status,
    revision: () => revision,
    async flush() {
      if (inFlight) await inFlight;
      await start();
    },
    resume(next) {
      revision = next;
      setStatus("dirty");
      schedule();
    },
    dispose() {
      disposed = true;
      cancelTimer();
      unsubscribe();
    },
  };
}
