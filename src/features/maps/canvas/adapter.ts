import { MarkerType } from "@xyflow/react";
import { NODE_H, NODE_W } from "../domain/commands";
import {
  RELATIONSHIP_LABEL,
  TYPE_LABEL,
  type Graph,
  type GraphEdge,
  type Point,
} from "../domain/types";
import { COLOR_HSL } from "../ui/visuals";
import type { MapFlowEdge } from "./edge-view";
import type { MapFlowNode } from "./node-view";

/**
 * Graph → React Flow elements (§44: Canvas Adapter).
 *
 * The adapter is the only place that knows both shapes. It keeps the
 * previous output and returns the *same object* for anything that did not
 * change, which is what lets React Flow and the memoised views skip work on a
 * map of a thousand nodes.
 */

export interface Measured {
  width: number;
  height: number;
}

type Side = "t" | "r" | "b" | "l";

/** The pair of sides that face each other, so edges don't loop around nodes. */
function facingSides(
  a: Point,
  aSize: Measured,
  b: Point,
  bSize: Measured,
): [Side, Side] {
  const dx = b.x + bSize.width / 2 - (a.x + aSize.width / 2);
  const dy = b.y + bSize.height / 2 - (a.y + aSize.height / 2);
  if (Math.abs(dx) > Math.abs(dy) * 1.2)
    return dx > 0 ? ["r", "l"] : ["l", "r"];
  return dy > 0 ? ["b", "t"] : ["t", "b"];
}

export function createFlowAdapter() {
  const nodeCache = new Map<string, { key: unknown[]; flow: MapFlowNode }>();
  const edgeCache = new Map<string, { key: unknown[]; flow: MapFlowEdge }>();
  const same = (a: unknown[], b: unknown[]) =>
    a.length === b.length && a.every((value, i) => value === b[i]);

  function nodes(
    graph: Graph,
    selected: ReadonlySet<string>,
    editingId: string | null,
    positions: ReadonlyMap<string, Point>,
    measured: ReadonlyMap<string, Measured>,
  ): MapFlowNode[] {
    const out: MapFlowNode[] = [];
    const seen = new Set<string>();
    for (const node of Object.values(graph.nodes)) {
      seen.add(node.id);
      const position = positions.get(node.id) ?? node.position;
      const size = measured.get(node.id);
      const isSelected = selected.has(node.id);
      const editing = editingId === node.id;
      const key = [node, position, size, isSelected, editing];
      const cached = nodeCache.get(node.id);
      if (cached && same(cached.key, key)) {
        out.push(cached.flow);
        continue;
      }
      const flow: MapFlowNode = {
        id: node.id,
        type: "map",
        position,
        data: { node, editing },
        selected: isSelected,
        draggable: !node.locked && !editing,
        // React Flow needs the measured size back to draw edges and to
        // compute visibility; it reports it through dimension changes.
        ...(size ? { measured: size } : {}),
        ...(node.width ? { width: node.width } : {}),
        ariaLabel: `${TYPE_LABEL[node.type]}: ${node.title || "Untitled"}${
          node.locked ? " (locked)" : ""
        }`,
        zIndex: isSelected ? 10 : node.isRoot ? 5 : 0,
      };
      nodeCache.set(node.id, { key, flow });
      out.push(flow);
    }
    for (const id of nodeCache.keys()) if (!seen.has(id)) nodeCache.delete(id);
    return out;
  }

  function edges(
    graph: Graph,
    selected: ReadonlySet<string>,
    positions: ReadonlyMap<string, Point>,
    measured: ReadonlyMap<string, Measured>,
  ): MapFlowEdge[] {
    const out: MapFlowEdge[] = [];
    const seen = new Set<string>();
    const fallback = { width: NODE_W, height: NODE_H };
    for (const edge of Object.values(graph.edges)) {
      const source = graph.nodes[edge.source];
      const target = graph.nodes[edge.target];
      if (!source || !target) continue;
      seen.add(edge.id);
      const [sourceHandle, targetHandle] = facingSides(
        positions.get(source.id) ?? source.position,
        measured.get(source.id) ?? fallback,
        positions.get(target.id) ?? target.position,
        measured.get(target.id) ?? fallback,
      );
      const isSelected = selected.has(edge.id);
      const key = [
        edge,
        sourceHandle,
        targetHandle,
        isSelected,
        source.title,
        target.title,
      ];
      const cached = edgeCache.get(edge.id);
      if (cached && same(cached.key, key)) {
        out.push(cached.flow);
        continue;
      }
      const flow: MapFlowEdge = {
        id: edge.id,
        type: "map",
        source: edge.source,
        target: edge.target,
        sourceHandle,
        targetHandle,
        data: { edge },
        selected: isSelected,
        zIndex: isSelected ? 10 : 0,
        ...markers(edge),
        ariaLabel: `${RELATIONSHIP_LABEL[edge.relationship]}${
          edge.label ? ` "${edge.label}"` : ""
        }: ${source.title || "Untitled"} to ${target.title || "Untitled"}`,
      };
      edgeCache.set(edge.id, { key, flow });
      out.push(flow);
    }
    for (const id of edgeCache.keys()) if (!seen.has(id)) edgeCache.delete(id);
    return out;
  }

  return { nodes, edges };
}

function markers(edge: GraphEdge) {
  const marker = {
    type: MarkerType.ArrowClosed,
    width: 16,
    height: 16,
    ...(edge.color ? { color: `hsl(${COLOR_HSL[edge.color]})` } : {}),
  };
  switch (edge.direction) {
    case "forward":
      return { markerEnd: marker };
    case "backward":
      return { markerStart: marker };
    case "both":
      return { markerStart: marker, markerEnd: marker };
    case "none":
      return {};
  }
}
