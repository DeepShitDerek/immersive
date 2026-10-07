import {
  addChild,
  addSibling,
  connect,
  connectFirstToRest,
  createNode,
  deleteNodes,
  disconnect,
  moveNodes,
  setColor,
  setLocked,
  setType,
  updateEdge,
  updateNode,
  type NodeInit,
} from "../domain/commands";
import { copy, duplicate, isClip, paste, type Clip } from "../domain/clipboard";
import type {
  EdgePatch,
  NodeColor,
  NodePatch,
  NodeType,
  Point,
} from "../domain/types";
import type { MapStore } from "./map-store";

/**
 * What the editor can do, in the person's terms (§45).
 *
 * The toolbar, the context menu and the keyboard all call these; none of them
 * builds mutations itself. Each action reads the current selection when it
 * needs a target, runs the domain command, and selects what the person will
 * want to act on next (usually the node just made, ready to be named).
 *
 * Returns small results the UI can react to — e.g. which node to start
 * editing, or why nothing happened.
 */

export interface ActionResult {
  /** A node to put into rename mode. */
  editNodeId?: string;
  /** A short sentence for a toast when an action could not do all it was asked. */
  notice?: string;
}

export function createEditorActions(store: MapStore) {
  const env = store.env;
  const graph = () => store.getState().graph;
  const selection = () => store.getState().selection;
  const selectOnly = (nodeIds: string[], edgeIds: string[] = []) => ({
    nodes: nodeIds,
    edges: edgeIds,
  });
  let clipboard: Clip | null = null;

  return {
    addNode(init: NodeInit = {}): ActionResult {
      const r = createNode(graph(), init, env);
      store.run("Add node", r.mutations, { select: selectOnly([r.nodeId]) });
      return { editNodeId: r.nodeId };
    },

    /** Tab: a child of the selected node, or a new node when nothing is selected. */
    addChild(parentId = selection().nodes[0]): ActionResult {
      if (!parentId) return this.addNode();
      const r = addChild(graph(), parentId, {}, env);
      store.run("Add child", r.mutations, { select: selectOnly([r.nodeId]) });
      return { editNodeId: r.nodeId };
    },

    /** Enter: a sibling of the selected node. */
    addSibling(nodeId = selection().nodes[0]): ActionResult {
      if (!nodeId) return this.addNode();
      const r = addSibling(graph(), nodeId, {}, env);
      store.run("Add sibling", r.mutations, { select: selectOnly([r.nodeId]) });
      return { editNodeId: r.nodeId };
    },

    rename(id: string, title: string) {
      // One undo step per rename session, however many keystrokes it took.
      store.run("Rename", updateNode(graph(), id, { title }), {
        mergeKey: `title:${id}`,
      });
    },

    updateNode(id: string, patch: NodePatch, mergeKey?: string) {
      store.run("Edit node", updateNode(graph(), id, patch), { mergeKey });
    },

    setColor(color: NodeColor | null, ids = selection().nodes) {
      store.run("Change colour", setColor(graph(), ids, color));
    },

    setType(type: NodeType, ids = selection().nodes) {
      store.run("Change type", setType(graph(), ids, type));
    },

    setLocked(locked: boolean, ids = selection().nodes) {
      store.run(locked ? "Lock" : "Unlock", setLocked(graph(), ids, locked));
    },

    setRoot(id: string) {
      const node = graph().nodes[id];
      if (!node) return;
      store.run(
        node.isRoot ? "Unset root" : "Set as root",
        updateNode(graph(), id, { isRoot: !node.isRoot }),
      );
    },

    move(moves: { id: string; to: Point }[]) {
      store.run("Move", moveNodes(graph(), moves));
    },

    /** Deletes the selected nodes and edges. */
    deleteSelection(): ActionResult {
      const { nodes, edges } = selection();
      const nodeResult = deleteNodes(graph(), nodes);
      const edgeIds = edges.filter(
        (id) =>
          !nodeResult.mutations.some(
            (m) => m.type === "DELETE_EDGE" && m.id === id,
          ),
      );
      const mutations = [
        ...disconnect(graph(), edgeIds),
        ...nodeResult.mutations,
      ];
      store.run("Delete", mutations, {
        select: selectOnly(nodeResult.skippedLocked),
      });
      return nodeResult.skippedLocked.length
        ? {
            notice: `${nodeResult.skippedLocked.length} locked node(s) kept. Unlock to delete.`,
          }
        : {};
    },

    /** How many connections deleting the selection would also remove. */
    deletionImpact(): { nodes: number; edges: number } {
      const r = deleteNodes(graph(), selection().nodes);
      return {
        nodes: r.mutations.filter((m) => m.type === "DELETE_NODE").length,
        edges: r.edgeCount,
      };
    },

    connect(source: string, target: string): ActionResult {
      const r = connect(graph(), source, target, {}, env);
      if (r.reason === "self")
        return { notice: "A node can't connect to itself." };
      if (r.reason === "duplicate")
        return { notice: "Those are already connected." };
      store.run("Connect", r.mutations, {
        select: r.edgeId ? selectOnly([], [r.edgeId]) : undefined,
      });
      return {};
    },

    /** Selected nodes, in the order they were selected: first → each other. */
    connectSelected(): ActionResult {
      const ids = selection().nodes;
      if (ids.length < 2)
        return { notice: "Select two or more nodes to connect." };
      const mutations = connectFirstToRest(graph(), ids, env);
      if (mutations.length === 0)
        return { notice: "Those are already connected." };
      store.run("Connect", mutations);
      return {};
    },

    updateEdge(id: string, patch: EdgePatch, mergeKey?: string) {
      store.run("Edit connection", updateEdge(graph(), id, patch), {
        mergeKey,
      });
    },

    disconnect(edgeIds = selection().edges) {
      store.run("Disconnect", disconnect(graph(), edgeIds), {
        select: selectOnly([]),
      });
    },

    duplicate(): ActionResult {
      const r = duplicate(graph(), selection().nodes, env);
      store.run("Duplicate", r.mutations, { select: selectOnly(r.nodeIds) });
      return {};
    },

    /** Returns the clip so the caller can also put it on the system clipboard. */
    copy(): Clip | null {
      clipboard = copy(graph(), selection().nodes);
      return clipboard;
    },

    /** Pastes `external` (from the system clipboard) or the last internal copy. */
    paste(external?: unknown, at?: Point): ActionResult {
      const clip = isClip(external) ? external : clipboard;
      if (!clip) return { notice: "Nothing to paste." };
      const r = paste(graph(), clip, at ? { at } : {}, env);
      store.run("Paste", r.mutations, { select: selectOnly(r.nodeIds) });
      return {};
    },

    selectAll() {
      store.select(
        selectOnly(Object.keys(graph().nodes), Object.keys(graph().edges)),
      );
    },

    clearSelection() {
      store.select(selectOnly([]));
    },

    undo: () => store.undo(),
    redo: () => store.redo(),
  };
}

export type EditorActions = ReturnType<typeof createEditorActions>;
