import {
  GraphError,
  type EdgePatch,
  type Graph,
  type GraphEdge,
  type GraphNode,
  type NodePatch,
  type Point,
} from "./types";

/**
 * The complete vocabulary of changes to a graph.
 *
 * Every edit — by a person, a paste, an undo, or (later) an AI command or a
 * collaborator — is a list of these. Each has an exact inverse computed from
 * the graph it is applied to, which is what makes undo generic rather than a
 * per-feature afterthought, and what a version history or a sync layer would
 * record.
 */
export type GraphMutation =
  | { type: "CREATE_NODE"; node: GraphNode }
  | { type: "DELETE_NODE"; id: string }
  | { type: "UPDATE_NODE"; id: string; patch: NodePatch }
  | { type: "MOVE_NODES"; moves: { id: string; to: Point }[] }
  | { type: "CREATE_EDGE"; edge: GraphEdge }
  | { type: "DELETE_EDGE"; id: string }
  | { type: "UPDATE_EDGE"; id: string; patch: EdgePatch };

function requireNode(graph: Graph, id: string): GraphNode {
  const node = graph.nodes[id];
  if (!node) throw new GraphError(`No node ${id}`);
  return node;
}

function requireEdge(graph: Graph, id: string): GraphEdge {
  const edge = graph.edges[id];
  if (!edge) throw new GraphError(`No edge ${id}`);
  return edge;
}

/** A graph whose two records may be written. Only ever a private copy. */
interface Draft {
  nodes: Record<string, GraphNode>;
  edges: Record<string, GraphEdge>;
}

/**
 * Applies one mutation to a draft in place. The draft's records are private
 * copies made by `applyAll`; the node and edge objects inside are replaced,
 * never modified, so anything still holding the old graph keeps seeing it.
 */
function applyInPlace(
  draft: Draft,
  mutation: GraphMutation,
  now: string,
): void {
  switch (mutation.type) {
    case "CREATE_NODE": {
      const { node } = mutation;
      if (draft.nodes[node.id]) throw new GraphError(`Node ${node.id} exists`);
      draft.nodes[node.id] = node;
      return;
    }

    case "DELETE_NODE": {
      requireNode(draft, mutation.id);
      // Edges go first, as their own mutations, so they can be restored.
      for (const edge of Object.values(draft.edges)) {
        if (edge.source === mutation.id || edge.target === mutation.id) {
          throw new GraphError(`Node ${mutation.id} still has edge ${edge.id}`);
        }
      }
      delete draft.nodes[mutation.id];
      return;
    }

    case "UPDATE_NODE": {
      const node = requireNode(draft, mutation.id);
      draft.nodes[node.id] = { ...node, ...mutation.patch, updatedAt: now };
      return;
    }

    case "MOVE_NODES": {
      for (const { id, to } of mutation.moves) {
        const node = requireNode(draft, id);
        draft.nodes[id] = { ...node, position: { x: to.x, y: to.y } };
      }
      return;
    }

    case "CREATE_EDGE": {
      const { edge } = mutation;
      if (draft.edges[edge.id]) throw new GraphError(`Edge ${edge.id} exists`);
      requireNode(draft, edge.source);
      requireNode(draft, edge.target);
      draft.edges[edge.id] = edge;
      return;
    }

    case "DELETE_EDGE": {
      requireEdge(draft, mutation.id);
      delete draft.edges[mutation.id];
      return;
    }

    case "UPDATE_EDGE": {
      const edge = requireEdge(draft, mutation.id);
      draft.edges[edge.id] = { ...edge, ...mutation.patch };
      return;
    }
  }
}

/**
 * Applies one mutation, returning a new graph (the input is never modified,
 * so React can compare by reference). Throws `GraphError` on anything that
 * would leave the graph inconsistent: a duplicate id, an edge to a missing
 * node, deleting a node that still has edges.
 */
export function applyMutation(
  graph: Graph,
  mutation: GraphMutation,
  now?: string,
): Graph {
  return applyAll(graph, [mutation], now).graph;
}

/** The mutation that undoes `mutation`, given the graph *before* it applies. */
function invertMutation(graph: Graph, mutation: GraphMutation): GraphMutation {
  switch (mutation.type) {
    case "CREATE_NODE":
      return { type: "DELETE_NODE", id: mutation.node.id };
    case "DELETE_NODE":
      return { type: "CREATE_NODE", node: requireNode(graph, mutation.id) };
    case "UPDATE_NODE": {
      const node = requireNode(graph, mutation.id);
      const previous: Record<string, unknown> = {};
      for (const key of Object.keys(mutation.patch)) {
        previous[key] = node[key as keyof GraphNode];
      }
      return { type: "UPDATE_NODE", id: node.id, patch: previous as NodePatch };
    }
    case "MOVE_NODES":
      return {
        type: "MOVE_NODES",
        moves: mutation.moves.map(({ id }) => ({
          id,
          to: { ...requireNode(graph, id).position },
        })),
      };
    case "CREATE_EDGE":
      return { type: "DELETE_EDGE", id: mutation.edge.id };
    case "DELETE_EDGE":
      return { type: "CREATE_EDGE", edge: requireEdge(graph, mutation.id) };
    case "UPDATE_EDGE": {
      const edge = requireEdge(graph, mutation.id);
      const previous: Record<string, unknown> = {};
      for (const key of Object.keys(mutation.patch)) {
        previous[key] = edge[key as keyof GraphEdge];
      }
      return { type: "UPDATE_EDGE", id: edge.id, patch: previous as EdgePatch };
    }
  }
}

/**
 * Applies a list of mutations atomically: either all apply, or the original
 * graph is untouched (the error is rethrown). Returns the new graph and the
 * inverse list, already in undo order.
 *
 * The two records are copied once per batch, not once per mutation: deleting
 * 50 connected nodes is ~200 mutations, and copying 2,000 edges for each made
 * that plus its undo take over half a second (see the performance test).
 */
export function applyAll(
  graph: Graph,
  mutations: readonly GraphMutation[],
  now: string = new Date().toISOString(),
): { graph: Graph; inverse: GraphMutation[] } {
  if (mutations.length === 0) return { graph, inverse: [] };
  const draft: Draft = { nodes: { ...graph.nodes }, edges: { ...graph.edges } };
  const inverse: GraphMutation[] = [];
  for (const mutation of mutations) {
    inverse.push(invertMutation(draft, mutation));
    applyInPlace(draft, mutation, now);
  }
  inverse.reverse();
  return { graph: { nodes: draft.nodes, edges: draft.edges }, inverse };
}
