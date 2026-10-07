import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addChild,
  createNode,
  deleteNodes,
  updateNode,
} from "../domain/commands";
import { testEnv } from "../domain/test-helpers";
import {
  createAutosaver,
  type SaveOutcome,
  type SaveRequest,
} from "./autosave";
import { createMapStore } from "./map-store";

function storeWithRoot() {
  const env = testEnv();
  const store = createMapStore({ name: "Life" }, env);
  const root = createNode(
    store.getState().graph,
    { title: "What's happening?" },
    env,
  );
  store.run("root", root.mutations, {
    select: { nodes: [root.nodeId], edges: [] },
  });
  return { store, env, rootId: root.nodeId };
}

describe("map store", () => {
  it("records every graph change for undo and bumps the save version", () => {
    const { store, env, rootId } = storeWithRoot();
    const v = store.getState().version;
    const child = addChild(
      store.getState().graph,
      rootId,
      { title: "Move Out" },
      env,
    );
    store.run("child", child.mutations, {
      select: { nodes: [child.nodeId], edges: [] },
    });
    expect(store.getState().version).toBe(v + 1);
    expect(store.getState().selection.nodes).toEqual([child.nodeId]);

    expect(store.undo()).toBe(true);
    expect(store.getState().graph.nodes[child.nodeId]).toBeUndefined();
    // The selected node is gone, so it is no longer selected.
    expect(store.getState().selection.nodes).toEqual([]);
    expect(store.redo()).toBe(true);
    expect(store.getState().graph.nodes[child.nodeId]).toBeDefined();
  });

  it("notifies subscribers, and not for no-ops", () => {
    const { store, rootId } = storeWithRoot();
    const listener = vi.fn();
    store.subscribe(listener);
    store.run(
      "noop",
      updateNode(store.getState().graph, rootId, {
        title: "What's happening?",
      }),
    );
    store.select({ nodes: [rootId], edges: [] });
    store.setViewport({ ...store.getState().viewport });
    expect(listener).not.toHaveBeenCalled();
    store.setName("Life map");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("viewport changes are saved but never undo steps", () => {
    const { store } = storeWithRoot();
    const past = store.getState().history.past.length;
    const v = store.getState().version;
    store.setViewport({ x: 10, y: 10, zoom: 2 });
    expect(store.getState().version).toBe(v + 1);
    expect(store.getState().history.past.length).toBe(past);
  });

  it("load replaces the map and clears history", () => {
    const { store } = storeWithRoot();
    store.load({ graph: { nodes: {}, edges: {} }, name: "Imported" });
    expect(store.getState()).toMatchObject({
      name: "Imported",
      selection: { nodes: [], edges: [] },
    });
    expect(store.canUndo()).toBe(false);
  });
});

describe("autosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** A save whose outcome the test decides, one call at a time. */
  function controllableSave() {
    const calls: { request: SaveRequest; resolve: (o: SaveOutcome) => void }[] =
      [];
    const save = (request: SaveRequest) =>
      new Promise<SaveOutcome>((resolve) => calls.push({ request, resolve }));
    return { save, calls };
  }

  it("debounces a burst of edits into one save", async () => {
    const { store, env, rootId } = storeWithRoot();
    const { save, calls } = controllableSave();
    const statuses: string[] = [];
    createAutosaver({
      store,
      revision: 3,
      save,
      delay: 800,
      onStatus: (s) => statuses.push(s),
    });

    for (const title of ["a", "ab", "abc"]) {
      store.run("t", updateNode(store.getState().graph, rootId, { title }));
      await vi.advanceTimersByTimeAsync(300);
    }
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(800);
    expect(calls).toHaveLength(1);
    expect(calls[0].request).toMatchObject({
      expectedRevision: 3,
      name: "Life",
      nodeCount: 1,
    });
    calls[0].resolve({ ok: true, revision: 4 });
    await vi.runOnlyPendingTimersAsync();
    expect(statuses).toEqual(["dirty", "saving", "saved"]);
    void env;
  });

  it("saves again when edits arrive during a save, with the new revision", async () => {
    const { store, env, rootId } = storeWithRoot();
    const { save, calls } = controllableSave();
    const saver = createAutosaver({ store, revision: 1, save, delay: 100 });

    store.run(
      "t",
      updateNode(store.getState().graph, rootId, { title: "one" }),
    );
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toHaveLength(1);

    const child = addChild(store.getState().graph, rootId, {}, env);
    store.run("child", child.mutations);
    calls[0].resolve({ ok: true, revision: 2 });
    await vi.advanceTimersByTimeAsync(150);

    expect(calls).toHaveLength(2);
    expect(calls[1].request).toMatchObject({
      expectedRevision: 2,
      nodeCount: 2,
    });
    calls[1].resolve({ ok: true, revision: 3 });
    await vi.runOnlyPendingTimersAsync();
    expect(saver.status()).toBe("saved");
    expect(saver.revision()).toBe(3);
  });

  it("stops on a conflict instead of overwriting, until resumed", async () => {
    const { store, rootId } = storeWithRoot();
    const { save, calls } = controllableSave();
    const saver = createAutosaver({ store, revision: 5, save, delay: 50 });

    store.run(
      "t",
      updateNode(store.getState().graph, rootId, { title: "mine" }),
    );
    await vi.advanceTimersByTimeAsync(60);
    calls[0].resolve({
      ok: false,
      conflict: true,
      message: "changed elsewhere",
    });
    await vi.runOnlyPendingTimersAsync();
    expect(saver.status()).toBe("conflict");

    store.run(
      "t",
      updateNode(store.getState().graph, rootId, { title: "more" }),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect(calls).toHaveLength(1);

    saver.resume(9);
    await vi.advanceTimersByTimeAsync(60);
    expect(calls).toHaveLength(2);
    expect(calls[1].request.expectedRevision).toBe(9);
  });

  it("retries after a failed save", async () => {
    const { store, rootId } = storeWithRoot();
    const { save, calls } = controllableSave();
    const saver = createAutosaver({ store, revision: 0, save, delay: 50 });

    store.run("t", updateNode(store.getState().graph, rootId, { title: "x" }));
    await vi.advanceTimersByTimeAsync(60);
    calls[0].resolve({ ok: false, conflict: false, message: "offline" });
    await vi.advanceTimersByTimeAsync(0);
    expect(saver.status()).toBe("error");
    await vi.advanceTimersByTimeAsync(250);
    expect(calls).toHaveLength(2);
  });

  it("flush saves immediately, e.g. when the editor closes", async () => {
    const { store, env } = storeWithRoot();
    const { save, calls } = controllableSave();
    const saver = createAutosaver({ store, revision: 0, save, delay: 10_000 });

    store.run(
      "delete",
      deleteNodes(
        store.getState().graph,
        Object.keys(store.getState().graph.nodes),
      ).mutations,
    );
    const done = saver.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(1);
    calls[0].resolve({ ok: true, revision: 1 });
    await done;
    expect(saver.status()).toBe("saved");
    void env;
  });

  it("does nothing when nothing changed", async () => {
    const { store } = storeWithRoot();
    const { save, calls } = controllableSave();
    const saver = createAutosaver({ store, revision: 0, save, delay: 10 });
    await saver.flush();
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toHaveLength(0);
    expect(saver.status()).toBe("saved");
  });
});
