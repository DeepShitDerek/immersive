"use client";

import "@xyflow/react/dist/style.css";
import "./maps.css";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  ReactFlow,
  SelectionMode,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Viewport,
} from "@xyflow/react";
import { effectiveColor, type Point } from "../domain/types";
import { COLOR_HSL } from "../ui/visuals";
import { useEditor, useMapState } from "../ui/editor-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { minimapVisible } from "../state/minimap";
import { createFlowAdapter, type Measured } from "./adapter";
import { MapEdge, type MapFlowEdge } from "./edge-view";
import { MapNode, type MapFlowNode } from "./node-view";

const nodeTypes = { map: MapNode };
const edgeTypes = { map: MapEdge };

/** Where the context menu was opened, so the menu can offer the right actions. */
export type MenuTarget =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }
  | { kind: "pane"; at: Point };

/**
 * The canvas. Renders the store's graph through React Flow and turns canvas
 * events into editor actions — it never edits the graph itself.
 *
 * Positions are local while a drag is in progress (smooth, no history) and
 * are committed once, as one undoable move, when the drag ends.
 */
export function MapCanvas({
  onMenuTarget,
}: {
  onMenuTarget: (target: MenuTarget) => void;
}) {
  const { store, actions, ui } = useEditor();
  const graph = useMapState((s) => s.graph);
  const selection = useMapState((s) => s.selection);
  const settings = useMapState((s) => s.settings);
  const isMobile = useIsMobile();
  const flow = useReactFlow<MapFlowNode, MapFlowEdge>();

  const [dragging, setDragging] = useState<ReadonlyMap<string, Point>>(
    new Map(),
  );
  const [measured, setMeasured] = useState<ReadonlyMap<string, Measured>>(
    new Map(),
  );
  const adapter = useRef(createFlowAdapter()).current;
  // The saved view is applied once, on mount; after that React Flow owns it.
  const initialViewport = useRef(store.getState().viewport).current;

  const selectedNodes = useMemo(
    () => new Set(selection.nodes),
    [selection.nodes],
  );
  const selectedEdges = useMemo(
    () => new Set(selection.edges),
    [selection.edges],
  );

  const nodes = useMemo(
    () => adapter.nodes(graph, selectedNodes, ui.editingId, dragging, measured),
    [adapter, graph, selectedNodes, ui.editingId, dragging, measured],
  );
  const edges = useMemo(
    () => adapter.edges(graph, selectedEdges, dragging, measured),
    [adapter, graph, selectedEdges, dragging, measured],
  );

  /**
   * Applies React Flow's select changes to the store. In controlled mode
   * React Flow only *reports* a click; nothing is selected until the change
   * is applied. Order is kept: "connect selected" links the first-chosen
   * node to the rest.
   */
  const applySelect = useCallback(
    (kind: "nodes" | "edges", changes: { id: string; selected: boolean }[]) => {
      if (changes.length === 0) return;
      const current = store.getState().selection;
      const ids = [...current[kind]];
      for (const { id, selected } of changes) {
        const index = ids.indexOf(id);
        if (selected && index < 0) ids.push(id);
        if (!selected && index >= 0) ids.splice(index, 1);
      }
      store.select({ ...current, [kind]: ids });
    },
    [store],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<MapFlowNode>[]) => {
      applySelect(
        "nodes",
        changes.flatMap((c) => (c.type === "select" ? [c] : [])),
      );
      let nextDragging: Map<string, Point> | null = null;
      const committed: { id: string; to: Point }[] = [];
      let nextMeasured: Map<string, Measured> | null = null;

      for (const change of changes) {
        if (change.type === "position") {
          if (change.dragging && change.position) {
            nextDragging ??= new Map(dragging);
            nextDragging.set(change.id, change.position);
          } else {
            // Drag end, or a keyboard nudge (arrow keys on a focused node).
            const to = change.position ?? dragging.get(change.id);
            if (to) committed.push({ id: change.id, to });
            nextDragging ??= new Map(dragging);
            nextDragging.delete(change.id);
          }
        } else if (change.type === "dimensions" && change.dimensions) {
          const prev = measured.get(change.id);
          const { width, height } = change.dimensions;
          if (!prev || prev.width !== width || prev.height !== height) {
            nextMeasured ??= new Map(measured);
            nextMeasured.set(change.id, { width, height });
          }
        }
      }
      // Commit before clearing the local positions, so nothing snaps back.
      if (committed.length) actions.move(committed);
      if (nextDragging) setDragging(nextDragging);
      if (nextMeasured) setMeasured(nextMeasured);
    },
    [actions, applySelect, dragging, measured],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<MapFlowEdge>[]) => {
      // Only selection: deletion goes through the editor (undo, confirmation).
      applySelect(
        "edges",
        changes.flatMap((c) => (c.type === "select" ? [c] : [])),
      );
    },
    [applySelect],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const result = actions.connect(connection.source, connection.target);
      if (result.notice) ui.notify(result.notice);
    },
    [actions, ui],
  );

  const onMoveEnd = useCallback(
    (_event: unknown, viewport: Viewport) => store.setViewport(viewport),
    [store],
  );

  /** Double-click on empty canvas: a new node right there, ready to name. */
  const onDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.classList.contains("react-flow__pane")) return;
      const at = flow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const result = actions.addNode({
        position: { x: at.x - 100, y: at.y - 30 },
      });
      if (result.editNodeId) ui.setEditingId(result.editNodeId);
    },
    [actions, flow, ui],
  );

  const large = nodes.length > 250;

  return (
    <div
      className="maps-canvas relative h-full w-full"
      onDoubleClick={onDoubleClick}
    >
      <ReactFlow<MapFlowNode, MapFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMoveEnd={onMoveEnd}
        onNodeDoubleClick={(_event, node) => ui.setEditingId(node.id)}
        onNodeContextMenu={(_event, node) =>
          onMenuTarget({ kind: "node", id: node.id })
        }
        onEdgeContextMenu={(_event, edge) =>
          onMenuTarget({ kind: "edge", id: edge.id })
        }
        onPaneContextMenu={(event) =>
          onMenuTarget({
            kind: "pane",
            at: flow.screenToFlowPosition({
              x: event.clientX,
              y: event.clientY,
            }),
          })
        }
        // A click on empty canvas ends a rename, but not the second click of
        // a double-click: that is the gesture starting one. Depending on
        // timing, its click could land after the double-click had opened
        // the new node's title, closing it before anything was typed.
        onPaneClick={(event) => {
          if (event.detail > 1) return;
          ui.setEditingId(null);
        }}
        defaultViewport={initialViewport}
        minZoom={0.1}
        maxZoom={2.5}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={28}
        // Figma-like: drag on empty canvas draws a selection box; Space or
        // the middle/right button pans; two-finger scroll pans; pinch or
        // Ctrl+scroll zooms.
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        panActivationKeyCode="Space"
        multiSelectionKeyCode={["Shift", "Meta", "Control"]}
        // Deletion runs through the editor (undo, lock rules, confirmation).
        deleteKeyCode={null}
        snapToGrid={settings.snap}
        snapGrid={[20, 20]}
        onlyRenderVisibleElements={large}
        elevateEdgesOnSelect
        proOptions={{ hideAttribution: true }}
        ariaLabelConfig={{
          "node.a11yDescription.default":
            "Press Enter or Space to select. Arrow keys move it. Tab adds a child, Delete removes it.",
        }}
      >
        {settings.grid && (
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} />
        )}
        {minimapVisible({
          enabled: settings.minimap,
          nodeCount: Object.keys(graph.nodes).length,
          isMobile,
        }) && (
          <MiniMap<MapFlowNode>
            pannable
            zoomable
            ariaLabel="Map overview"
            className="!rounded-control !border"
            nodeColor={(node) => {
              const color = effectiveColor(node.data.node);
              return color
                ? `hsl(${COLOR_HSL[color]})`
                : "hsl(var(--muted-foreground))";
            }}
            nodeBorderRadius={6}
          />
        )}
      </ReactFlow>
    </div>
  );
}
