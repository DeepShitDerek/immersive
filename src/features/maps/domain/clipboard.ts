import { defaultEnv, freeSpot, type Env } from "./commands";
import type { GraphMutation } from "./mutations";
import { internalEdges } from "./selectors";
import type { Graph, GraphEdge, GraphNode, Point } from "./types";

/**
 * Copy, paste and duplicate (§27, §28).
 *
 * A clip is the chosen nodes plus the edges *between* them. Edges to nodes
 * outside the selection are left behind: a pasted "Cost → Rent" should not
 * quietly wire itself back into the map it came from.
 */

const CLIP_KIND = "foliokit/maps-clip";

export interface Clip {
  kind: typeof CLIP_KIND;
  version: 1;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function copy(graph: Graph, ids: readonly string[]): Clip | null {
  const chosen = new Set(ids.filter((id) => graph.nodes[id]));
  if (chosen.size === 0) return null;
  return {
    kind: CLIP_KIND,
    version: 1,
    nodes: [...chosen].map((id) => structuredClone(graph.nodes[id])),
    edges: internalEdges(graph, chosen).map((edge) => structuredClone(edge)),
  };
}

export function isClip(value: unknown): value is Clip {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Clip).kind === CLIP_KIND &&
    Array.isArray((value as Clip).nodes) &&
    Array.isArray((value as Clip).edges)
  );
}

/**
 * Mutations that insert a clip with fresh ids, keeping its internal edges.
 * With `at`, the clip's top-left lands there; otherwise it is offset from
 * where it was copied so the copy is visibly separate. Pasted nodes are never
 * roots and never locked — a copy is something to work on.
 */
export function paste(
  graph: Graph,
  clip: Clip,
  options: { at?: Point; offset?: Point } = {},
  env: Env = defaultEnv,
): { mutations: GraphMutation[]; nodeIds: string[] } {
  if (clip.nodes.length === 0) return { mutations: [], nodeIds: [] };
  const minX = Math.min(...clip.nodes.map((n) => n.position.x));
  const minY = Math.min(...clip.nodes.map((n) => n.position.y));
  const origin = options.at
    ? freeSpot(graph, options.at)
    : {
        x: minX + (options.offset?.x ?? 40),
        y: minY + (options.offset?.y ?? 40),
      };

  const now = env.now();
  const idMap = new Map<string, string>();
  const nodes: GraphNode[] = clip.nodes.map((node) => {
    const id = env.id();
    idMap.set(node.id, id);
    return {
      ...structuredClone(node),
      id,
      isRoot: false,
      locked: false,
      groupId: null,
      position: {
        x: origin.x + (node.position.x - minX),
        y: origin.y + (node.position.y - minY),
      },
      createdAt: now,
      updatedAt: now,
    };
  });
  const edges: GraphEdge[] = clip.edges
    .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
    .map((edge) => ({
      ...structuredClone(edge),
      id: env.id(),
      source: idMap.get(edge.source)!,
      target: idMap.get(edge.target)!,
      createdAt: now,
    }));

  return {
    nodeIds: nodes.map((node) => node.id),
    mutations: [
      ...nodes.map((node) => ({ type: "CREATE_NODE" as const, node })),
      ...edges.map((edge) => ({ type: "CREATE_EDGE" as const, edge })),
    ],
  };
}

/** Copy-then-paste in one step. The duplicate is not connected to the original. */
export function duplicate(
  graph: Graph,
  ids: readonly string[],
  env: Env = defaultEnv,
): { mutations: GraphMutation[]; nodeIds: string[] } {
  const clip = copy(graph, ids);
  return clip
    ? paste(graph, clip, { offset: { x: 40, y: 40 } }, env)
    : { mutations: [], nodeIds: [] };
}
