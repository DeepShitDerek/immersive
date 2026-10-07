import type { Graph, GraphEdge, GraphNode } from "./types";

/*
  Read-only queries. Linear scans are deliberate: at the design ceiling
  (1,000 nodes, 2,000 edges) a scan is well under a millisecond, and an index
  would be one more thing every mutation has to keep in step. The performance
  test in selectors.test.ts holds this to account.
*/

export function outgoingEdges(graph: Graph, id: string): GraphEdge[] {
  return Object.values(graph.edges).filter((edge) => edge.source === id);
}

export function incomingEdges(graph: Graph, id: string): GraphEdge[] {
  return Object.values(graph.edges).filter((edge) => edge.target === id);
}

export function incidentEdges(graph: Graph, id: string): GraphEdge[] {
  return Object.values(graph.edges).filter(
    (edge) => edge.source === id || edge.target === id,
  );
}

/** Every node connected to `id`, whichever way the edge points, once each. */
export function neighbours(graph: Graph, id: string): GraphNode[] {
  const ids = new Set<string>();
  for (const edge of incidentEdges(graph, id)) {
    ids.add(edge.source === id ? edge.target : edge.source);
  }
  return [...ids].map((other) => graph.nodes[other]).filter(Boolean);
}

/** Edges whose both ends are in `ids` — what a copy or duplicate keeps. */
export function internalEdges(
  graph: Graph,
  ids: ReadonlySet<string>,
): GraphEdge[] {
  return Object.values(graph.edges).filter(
    (edge) => ids.has(edge.source) && ids.has(edge.target),
  );
}

const fold = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Nodes matching `query`, best first: title starts with it, then a word in the
 * title starts with it, then the title contains it, then the description or a
 * tag does. Accent- and case-insensitive.
 */
export function searchNodes(
  graph: Graph,
  query: string,
  limit = 20,
): GraphNode[] {
  const q = fold(query.trim());
  if (!q) return [];
  const scored: { node: GraphNode; score: number }[] = [];
  for (const node of Object.values(graph.nodes)) {
    const title = fold(node.title);
    let score = 0;
    if (title.startsWith(q)) score = 4;
    else if (title.split(/\s+/).some((word) => word.startsWith(q))) score = 3;
    else if (title.includes(q)) score = 2;
    else if (
      fold(node.description).includes(q) ||
      node.tags.some((tag) => fold(tag).includes(q))
    ) {
      score = 1;
    }
    if (score > 0) scored.push({ node, score });
  }
  return scored
    .sort(
      (a, b) => b.score - a.score || a.node.title.localeCompare(b.node.title),
    )
    .slice(0, limit)
    .map(({ node }) => node);
}
