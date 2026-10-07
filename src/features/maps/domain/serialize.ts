import { z } from "zod";
import {
  EDGE_DIRECTIONS,
  EDGE_STYLES,
  NODE_COLORS,
  NODE_SHAPES,
  NODE_TYPES,
  RELATIONSHIPS,
  type Graph,
  type GraphEdge,
  type GraphNode,
} from "./types";

/**
 * The stored form of a map (§34), and the JSON export/import format (§36).
 *
 * Loading is forgiving on purpose. A map is someone's thinking; one malformed
 * node must not make the whole thing unopenable. Unknown enum values fall back
 * to defaults, missing optional fields are filled in, and structural problems
 * (duplicate ids, edges to nowhere) are repaired and reported.
 */

const SCHEMA_VERSION = 1;

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface MapSettings {
  grid: boolean;
  snap: boolean;
  minimap: boolean;
}

export interface MapDocument {
  schemaVersion: typeof SCHEMA_VERSION;
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewport: Viewport;
  settings: MapSettings;
}

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };
export const DEFAULT_SETTINGS: MapSettings = {
  grid: true,
  snap: false,
  minimap: true,
};

const finite = z.number().finite();
const iso = z.string().catch(() => new Date(0).toISOString());
const text = (max: number) =>
  z
    .string()
    .catch("")
    .transform((value) => value.slice(0, max));

const nodeSchema = z.object({
  id: z.string().min(1),
  title: text(500).default(""),
  description: text(20_000).default(""),
  type: z.enum(NODE_TYPES).catch("idea"),
  color: z.enum(NODE_COLORS).nullable().catch(null).default(null),
  shape: z.enum(NODE_SHAPES).catch("rounded"),
  position: z.object({ x: finite, y: finite }).catch({ x: 0, y: 0 }),
  width: finite.positive().nullable().catch(null).default(null),
  height: finite.positive().nullable().catch(null).default(null),
  collapsed: z.boolean().catch(false).default(false),
  locked: z.boolean().catch(false).default(false),
  isRoot: z.boolean().catch(false).default(false),
  groupId: z.string().nullable().catch(null).default(null),
  tags: z.array(z.string().max(60)).max(50).catch([]).default([]),
  metadata: z.record(z.unknown()).catch({}).default({}),
  createdAt: iso,
  updatedAt: iso,
});

const edgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  relationship: z.enum(RELATIONSHIPS).catch("related"),
  label: text(200).default(""),
  direction: z.enum(EDGE_DIRECTIONS).catch("forward"),
  style: z.enum(EDGE_STYLES).catch("curved"),
  color: z.enum(NODE_COLORS).nullable().catch(null).default(null),
  metadata: z.record(z.unknown()).catch({}).default({}),
  createdAt: iso,
});

const documentSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).catch(SCHEMA_VERSION),
  nodes: z.array(z.unknown()).catch([]),
  edges: z.array(z.unknown()).catch([]),
  viewport: z
    .object({ x: finite, y: finite, zoom: finite.min(0.05).max(8) })
    .catch(DEFAULT_VIEWPORT)
    .default(DEFAULT_VIEWPORT),
  settings: z
    .object({
      grid: z.boolean().catch(true),
      snap: z.boolean().catch(false),
      minimap: z.boolean().catch(true),
    })
    .catch(DEFAULT_SETTINGS)
    .default(DEFAULT_SETTINGS),
});

export interface LoadResult {
  graph: Graph;
  viewport: Viewport;
  settings: MapSettings;
  /** Human-readable notes on anything that had to be fixed. Empty when clean. */
  repairs: string[];
}

export function emptyDocument(): MapDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodes: [],
    edges: [],
    viewport: { ...DEFAULT_VIEWPORT },
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function toDocument(
  graph: Graph,
  viewport: Viewport,
  settings: MapSettings,
): MapDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodes: Object.values(graph.nodes),
    edges: Object.values(graph.edges),
    viewport,
    settings,
  };
}

export function fromDocument(input: unknown): LoadResult {
  const repairs: string[] = [];
  const doc = documentSchema.parse(
    typeof input === "object" && input !== null ? input : {},
  );

  const nodes: Record<string, GraphNode> = {};
  let badNodes = 0;
  let duplicateNodes = 0;
  for (const raw of doc.nodes) {
    const parsed = nodeSchema.safeParse(raw);
    if (!parsed.success) {
      badNodes += 1;
      continue;
    }
    if (nodes[parsed.data.id]) {
      duplicateNodes += 1;
      continue;
    }
    nodes[parsed.data.id] = parsed.data as GraphNode;
  }

  const edges: Record<string, GraphEdge> = {};
  let badEdges = 0;
  let dangling = 0;
  for (const raw of doc.edges) {
    const parsed = edgeSchema.safeParse(raw);
    if (!parsed.success || edges[parsed.data.id]) {
      badEdges += 1;
      continue;
    }
    const edge = parsed.data as GraphEdge;
    if (
      !nodes[edge.source] ||
      !nodes[edge.target] ||
      edge.source === edge.target
    ) {
      dangling += 1;
      continue;
    }
    edges[edge.id] = edge;
  }

  const roots = Object.values(nodes).filter((node) => node.isRoot);
  for (const extra of roots.slice(1))
    nodes[extra.id] = { ...extra, isRoot: false };

  if (badNodes) repairs.push(`Skipped ${badNodes} unreadable node(s).`);
  if (duplicateNodes)
    repairs.push(`Skipped ${duplicateNodes} duplicate node id(s).`);
  if (badEdges) repairs.push(`Skipped ${badEdges} unreadable connection(s).`);
  if (dangling)
    repairs.push(`Removed ${dangling} connection(s) to missing nodes.`);
  if (roots.length > 1)
    repairs.push("Kept one root node; the others became regular nodes.");

  return {
    graph: { nodes, edges },
    viewport: doc.viewport,
    settings: doc.settings,
    repairs,
  };
}
