/**
 * The Maps graph model.
 *
 * Pure data, no rendering concerns: nothing in `domain/` may import React or
 * the canvas library. The canvas renders a `Graph`; it never owns
 * one.
 *
 * The model is a general directed graph, not a tree. Cycles, multiple parents,
 * several edges between the same two nodes and edges in both directions are
 * all valid — the map represents how someone thinks, and thinking loops.
 */

export const NODE_TYPES = [
  "idea",
  "problem",
  "question",
  "decision",
  "action",
  "goal",
  "solution",
  "insight",
  "note",
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

/**
 * Colours are stored by name and resolved per theme when rendered, so a map
 * reads correctly on all 56 presets. `null` means "use the type's colour".
 */
export const NODE_COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "gray",
] as const;
export type NodeColor = (typeof NODE_COLORS)[number];

export const NODE_SHAPES = [
  "rounded",
  "rectangle",
  "circle",
  "diamond",
] as const;
type NodeShape = (typeof NODE_SHAPES)[number];

export const RELATIONSHIPS = [
  "related",
  "causes",
  "depends_on",
  "leads_to",
  "supports",
  "contradicts",
  "answers",
  "custom",
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

/** Which way the arrow points, relative to source → target. */
export const EDGE_DIRECTIONS = ["forward", "backward", "both", "none"] as const;
export type EdgeDirection = (typeof EDGE_DIRECTIONS)[number];

export const EDGE_STYLES = ["curved", "straight", "orthogonal"] as const;
export type EdgeStyle = (typeof EDGE_STYLES)[number];

export interface Point {
  x: number;
  y: number;
}

export interface GraphNode {
  id: string;
  title: string;
  description: string;
  type: NodeType;
  color: NodeColor | null;
  shape: NodeShape;
  position: Point;
  /** Null: size to content. */
  width: number | null;
  height: number | null;
  collapsed: boolean;
  locked: boolean;
  /** At most one per map; visual emphasis only, never a hierarchy. */
  isRoot: boolean;
  /** A containing group, for V1.1 groups. Not a tree parent. */
  groupId: string | null;
  tags: string[];
  /** Room for priority, status, due date, links… without a schema change. */
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: Relationship;
  /** Free text; for `custom` it is the relationship's name. */
  label: string;
  direction: EdgeDirection;
  style: EdgeStyle;
  color: NodeColor | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** Keyed by id. Object key order is insertion order, which is paint order. */
export interface Graph {
  nodes: Readonly<Record<string, GraphNode>>;
  edges: Readonly<Record<string, GraphEdge>>;
}

export const EMPTY_GRAPH: Graph = { nodes: {}, edges: {} };

/** Fields a node update may change. Identity and timestamps are managed. */
export type NodePatch = Partial<
  Omit<GraphNode, "id" | "createdAt" | "updatedAt">
>;
export type EdgePatch = Partial<
  Omit<GraphEdge, "id" | "source" | "target" | "createdAt">
>;

export class GraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphError";
  }
}

/**
 * The colour a node is drawn in when it has none of its own. Semantic, so a
 * glance separates problems from actions — but always paired with the type's
 * icon and name, because colour must never be the only signal (§48).
 */
const TYPE_DEFAULT_COLOR: Record<NodeType, NodeColor | null> = {
  idea: null,
  problem: "red",
  question: "yellow",
  decision: "purple",
  action: "blue",
  goal: "green",
  solution: "green",
  insight: "orange",
  note: "gray",
};

export const TYPE_LABEL: Record<NodeType, string> = {
  idea: "Idea",
  problem: "Problem",
  question: "Question",
  decision: "Decision",
  action: "Action",
  goal: "Goal",
  solution: "Solution",
  insight: "Insight",
  note: "Note",
};

export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  related: "Related",
  causes: "Causes",
  depends_on: "Depends on",
  leads_to: "Leads to",
  supports: "Supports",
  contradicts: "Contradicts",
  answers: "Answers",
  custom: "Custom",
};

export function effectiveColor(node: Pick<GraphNode, "color" | "type">) {
  return node.color ?? TYPE_DEFAULT_COLOR[node.type];
}
