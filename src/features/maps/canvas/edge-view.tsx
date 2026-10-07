"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { RELATIONSHIP_LABEL, type GraphEdge } from "../domain/types";
import { COLOR_HSL } from "../ui/visuals";

type MapEdgeData = { edge: GraphEdge };
export type MapFlowEdge = Edge<MapEdgeData, "map">;

/**
 * One connection. The label shows the relationship when it is not the
 * default "related" (or the custom name), plus any free-text label — so a
 * glance tells "causes" from "depends on" without opening anything.
 */
export const MapEdge = memo(function MapEdge({
  id,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerStart,
  markerEnd,
  selected,
}: EdgeProps<MapFlowEdge>) {
  const edge = data?.edge;
  const geometry = {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  };
  const [path, labelX, labelY] =
    edge?.style === "straight"
      ? getStraightPath(geometry)
      : edge?.style === "orthogonal"
        ? getSmoothStepPath({ ...geometry, borderRadius: 8 })
        : getBezierPath(geometry);

  const relation =
    edge && edge.relationship !== "related" && edge.relationship !== "custom"
      ? RELATIONSHIP_LABEL[edge.relationship].toLowerCase()
      : "";
  const text = [relation, edge?.label].filter(Boolean).join(" · ");
  const stroke = edge?.color ? `hsl(${COLOR_HSL[edge.color]})` : undefined;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={stroke && !selected ? { stroke } : undefined}
      />
      {text && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute rounded-full border bg-card px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground shadow-e1"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              borderColor: selected ? "hsl(var(--primary))" : undefined,
            }}
          >
            {text}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
