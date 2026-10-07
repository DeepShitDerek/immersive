import type { GraphMutation } from "./mutations";
import {
  GraphError,
  type EdgePatch,
  type Graph,
  type GraphEdge,
  type GraphNode,
  type NodeColor,
  type NodePatch,
  type NodeType,
  type Point,
  type Relationship,
} from "./types";
import { incidentEdges, incomingEdges, outgoingEdges } from "./selectors";

/**
 * Intent → mutations. Every function here is pure: it reads the graph and
 * returns what to change, and the store applies, records and undoes it. No
 * component mutates a graph directly (§45).
 */

export interface Env {
  /** Injected so tests are deterministic. */
  id: () => string;
  now: () => string;
}

export const defaultEnv: Env = {
  id: () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
  now: () => new Date().toISOString(),
};

/** Layout constants for placing new nodes. Rendering may size differently. */
export const NODE_W = 200;
export const NODE_H = 64;
const GAP_X = 40;
const GAP_Y = 80;

export type NodeInit = Partial<
  Omit<GraphNode, "id" | "createdAt" | "updatedAt">
>;

function makeNode(env: Env, init: NodeInit = {}): GraphNode {
  const now = env.now();
  return {
    id: env.id(),
    title: init.title ?? "",
    description: init.description ?? "",
    type: init.type ?? "idea",
    color: init.color ?? null,
    shape: init.shape ?? "rounded",
    position: init.position ? { ...init.position } : { x: 0, y: 0 },
    width: init.width ?? null,
    height: init.height ?? null,
    collapsed: init.collapsed ?? false,
    locked: init.locked ?? false,
    isRoot: init.isRoot ?? false,
    groupId: init.groupId ?? null,
    tags: init.tags ? [...init.tags] : [],
    metadata: init.metadata ? { ...init.metadata } : {},
    createdAt: now,
    updatedAt: now,
  };
}

export type EdgeInit = Partial<
  Omit<GraphEdge, "id" | "source" | "target" | "createdAt">
>;

function makeEdge(
  env: Env,
  source: string,
  target: string,
  init: EdgeInit = {},
): GraphEdge {
  return {
    id: env.id(),
    source,
    target,
    relationship: init.relationship ?? "related",
    label: init.label ?? "",
    direction: init.direction ?? "forward",
    style: init.style ?? "curved",
    color: init.color ?? null,
    metadata: init.metadata ? { ...init.metadata } : {},
    createdAt: env.now(),
  };
}

/* ── Placement ─────────────────────────────────────────────────────────── */

function overlaps(graph: Graph, at: Point): boolean {
  return Object.values(graph.nodes).some(
    (node) =>
      Math.abs(node.position.x - at.x) < NODE_W * 0.9 &&
      Math.abs(node.position.y - at.y) < NODE_H * 0.9,
  );
}

/** The nearest free spot to the right of `desired`, so new nodes never stack. */
export function freeSpot(graph: Graph, desired: Point): Point {
  const at = { ...desired };
  for (let i = 0; i < 200 && overlaps(graph, at); i++) {
    at.x += NODE_W + GAP_X;
  }
  return at;
}

/* ── Nodes ─────────────────────────────────────────────────────────────── */

export function createNode(
  graph: Graph,
  init: NodeInit,
  env: Env = defaultEnv,
): { mutations: GraphMutation[]; nodeId: string } {
  const node = makeNode(env, {
    ...init,
    position: freeSpot(graph, init.position ?? { x: 0, y: 0 }),
  });
  const mutations: GraphMutation[] = [];
  if (node.isRoot) mutations.push(...clearRoot(graph));
  mutations.push({ type: "CREATE_NODE", node });
  return { mutations, nodeId: node.id };
}

/**
 * A new node below `parentId`, connected from it. Later children line up to
 * the right of earlier ones. "Child" is a placement and an edge, not a
 * hierarchy: the new node can be reconnected anywhere afterwards.
 */
export function addChild(
  graph: Graph,
  parentId: string,
  init: NodeInit = {},
  env: Env = defaultEnv,
): { mutations: GraphMutation[]; nodeId: string } {
  const parent = graph.nodes[parentId];
  if (!parent) throw new GraphError(`No node ${parentId}`);
  const children = outgoingEdges(graph, parentId)
    .map((edge) => graph.nodes[edge.target])
    .filter((node): node is GraphNode => Boolean(node));
  const below = parent.position.y + NODE_H + GAP_Y;
  const desired =
    children.length === 0
      ? { x: parent.position.x, y: below }
      : {
          x: Math.max(...children.map((c) => c.position.x)) + NODE_W + GAP_X,
          y: below,
        };
  const node = makeNode(env, { ...init, position: freeSpot(graph, desired) });
  return {
    nodeId: node.id,
    mutations: [
      { type: "CREATE_NODE", node },
      { type: "CREATE_EDGE", edge: makeEdge(env, parentId, node.id) },
    ],
  };
}

/**
 * A new node beside `nodeId`, connected from the same parent the same way.
 * With no parent it is simply placed alongside.
 */
export function addSibling(
  graph: Graph,
  nodeId: string,
  init: NodeInit = {},
  env: Env = defaultEnv,
): { mutations: GraphMutation[]; nodeId: string } {
  const node = graph.nodes[nodeId];
  if (!node) throw new GraphError(`No node ${nodeId}`);
  const parentEdge = incomingEdges(graph, nodeId)[0];
  const sibling = makeNode(env, {
    ...init,
    position: freeSpot(graph, {
      x: node.position.x + NODE_W + GAP_X,
      y: node.position.y,
    }),
  });
  const mutations: GraphMutation[] = [{ type: "CREATE_NODE", node: sibling }];
  if (parentEdge) {
    mutations.push({
      type: "CREATE_EDGE",
      edge: makeEdge(env, parentEdge.source, sibling.id, {
        relationship: parentEdge.relationship,
        direction: parentEdge.direction,
        style: parentEdge.style,
      }),
    });
  }
  return { mutations, nodeId: sibling.id };
}

export function updateNode(
  graph: Graph,
  id: string,
  patch: NodePatch,
): GraphMutation[] {
  const node = graph.nodes[id];
  if (!node) throw new GraphError(`No node ${id}`);
  const changed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (
      JSON.stringify(node[key as keyof GraphNode]) !== JSON.stringify(value)
    ) {
      changed[key] = value;
    }
  }
  if (Object.keys(changed).length === 0) return [];
  const mutations: GraphMutation[] = [];
  if (changed.isRoot === true) mutations.push(...clearRoot(graph, id));
  mutations.push({ type: "UPDATE_NODE", id, patch: changed as NodePatch });
  return mutations;
}

function clearRoot(graph: Graph, except?: string): GraphMutation[] {
  return Object.values(graph.nodes)
    .filter((node) => node.isRoot && node.id !== except)
    .map((node) => ({
      type: "UPDATE_NODE" as const,
      id: node.id,
      patch: { isRoot: false },
    }));
}

/** The same patch on many nodes — colour, type, lock. */
function updateNodes(
  graph: Graph,
  ids: readonly string[],
  patch: NodePatch,
): GraphMutation[] {
  return ids.flatMap((id) =>
    graph.nodes[id] ? updateNode(graph, id, patch) : [],
  );
}

export const setColor = (
  graph: Graph,
  ids: readonly string[],
  color: NodeColor | null,
) => updateNodes(graph, ids, { color });
export const setType = (graph: Graph, ids: readonly string[], type: NodeType) =>
  updateNodes(graph, ids, { type });
export const setLocked = (
  graph: Graph,
  ids: readonly string[],
  locked: boolean,
) => updateNodes(graph, ids, { locked });

/**
 * Removes nodes and every edge touching them (each edge once). Locked nodes
 * are skipped — locking is how a central node is protected — and reported so
 * the UI can say why they stayed.
 */
export function deleteNodes(
  graph: Graph,
  ids: readonly string[],
): { mutations: GraphMutation[]; skippedLocked: string[]; edgeCount: number } {
  const skippedLocked: string[] = [];
  const doomed = new Set<string>();
  for (const id of ids) {
    const node = graph.nodes[id];
    if (!node) continue;
    if (node.locked) skippedLocked.push(id);
    else doomed.add(id);
  }
  const edgeIds = new Set<string>();
  for (const id of doomed) {
    for (const edge of incidentEdges(graph, id)) edgeIds.add(edge.id);
  }
  const mutations: GraphMutation[] = [
    ...[...edgeIds].map((id) => ({ type: "DELETE_EDGE" as const, id })),
    ...[...doomed].map((id) => ({ type: "DELETE_NODE" as const, id })),
  ];
  return { mutations, skippedLocked, edgeCount: edgeIds.size };
}

/** Drops moves of locked or missing nodes and moves that go nowhere. */
export function moveNodes(
  graph: Graph,
  moves: readonly { id: string; to: Point }[],
): GraphMutation[] {
  const real = moves.filter(({ id, to }) => {
    const node = graph.nodes[id];
    return (
      node &&
      !node.locked &&
      (node.position.x !== to.x || node.position.y !== to.y)
    );
  });
  return real.length === 0
    ? []
    : [
        {
          type: "MOVE_NODES",
          moves: real.map(({ id, to }) => ({ id, to: { ...to } })),
        },
      ];
}

/* ── Edges ─────────────────────────────────────────────────────────────── */

/**
 * Connects two nodes. Refuses a self-loop (a node relating to itself says
 * nothing a description can't) and an exact duplicate of an existing edge —
 * the usual result of dragging the same connection twice. A second edge of a
 * *different* relationship between the same pair is allowed.
 */
export function connect(
  graph: Graph,
  source: string,
  target: string,
  init: EdgeInit = {},
  env: Env = defaultEnv,
): { mutations: GraphMutation[]; edgeId: string | null; reason?: string } {
  if (!graph.nodes[source] || !graph.nodes[target]) {
    return { mutations: [], edgeId: null, reason: "missing node" };
  }
  if (source === target) {
    return { mutations: [], edgeId: null, reason: "self" };
  }
  const relationship: Relationship = init.relationship ?? "related";
  const duplicate = Object.values(graph.edges).some(
    (edge) =>
      edge.source === source &&
      edge.target === target &&
      edge.relationship === relationship &&
      edge.label === (init.label ?? ""),
  );
  if (duplicate) return { mutations: [], edgeId: null, reason: "duplicate" };
  const edge = makeEdge(env, source, target, init);
  return { mutations: [{ type: "CREATE_EDGE", edge }], edgeId: edge.id };
}

/** Selected nodes in order: the first connects to each of the others. */
export function connectFirstToRest(
  graph: Graph,
  ids: readonly string[],
  env: Env = defaultEnv,
): GraphMutation[] {
  const [first, ...rest] = ids;
  if (!first) return [];
  let working = graph;
  const mutations: GraphMutation[] = [];
  for (const target of rest) {
    const result = connect(working, first, target, {}, env);
    mutations.push(...result.mutations);
    for (const m of result.mutations) {
      if (m.type === "CREATE_EDGE") {
        working = {
          ...working,
          edges: { ...working.edges, [m.edge.id]: m.edge },
        };
      }
    }
  }
  return mutations;
}

export function updateEdge(
  graph: Graph,
  id: string,
  patch: EdgePatch,
): GraphMutation[] {
  const edge = graph.edges[id];
  if (!edge) throw new GraphError(`No edge ${id}`);
  const changed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (
      JSON.stringify(edge[key as keyof GraphEdge]) !== JSON.stringify(value)
    ) {
      changed[key] = value;
    }
  }
  return Object.keys(changed).length === 0
    ? []
    : [{ type: "UPDATE_EDGE", id, patch: changed as EdgePatch }];
}

/** Removes edges only. Never touches either end. */
export function disconnect(
  graph: Graph,
  edgeIds: readonly string[],
): GraphMutation[] {
  return [...new Set(edgeIds)]
    .filter((id) => graph.edges[id])
    .map((id) => ({ type: "DELETE_EDGE" as const, id }));
}
