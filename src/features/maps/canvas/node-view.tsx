"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { AlignLeft, Crown, Lock } from "lucide-react";
import { effectiveColor, TYPE_LABEL, type GraphNode } from "../domain/types";
import { COLOR_HSL, TYPE_ICON } from "../ui/visuals";
import { useEditor } from "../ui/editor-context";

type MapNodeData = {
  node: GraphNode;
  editing: boolean;
};
export type MapFlowNode = Node<MapNodeData, "map">;

const HANDLES = [
  { id: "t", position: Position.Top },
  { id: "r", position: Position.Right },
  { id: "b", position: Position.Bottom },
  { id: "l", position: Position.Left },
] as const;

/**
 * One node on the canvas. Memoised on the domain node object, which only
 * changes when that node does — so dragging one node of a thousand re-renders
 * one node.
 *
 * Every handle is a source; the canvas runs in "loose" connection mode, so a
 * drag from any side can end on any side of any node.
 */
export const MapNode = memo(function MapNode({ data }: NodeProps<MapFlowNode>) {
  const { node, editing } = data;
  const color = effectiveColor(node);
  const Icon = TYPE_ICON[node.type];

  return (
    <div
      className="map-node"
      data-colored={color ? "true" : "false"}
      data-shape={node.shape}
      data-root={node.isRoot ? "true" : "false"}
      style={
        color
          ? ({ "--map-accent": COLOR_HSL[color] } as React.CSSProperties)
          : undefined
      }
    >
      {HANDLES.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="source"
          position={handle.position}
          aria-label={`Connect from ${node.title || "untitled node"}`}
        />
      ))}

      <div className="flex items-center gap-1.5 px-3 pt-2.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon
          aria-hidden
          className="size-3.5 shrink-0"
          style={color ? { color: `hsl(${COLOR_HSL[color]})` } : undefined}
        />
        <span>{TYPE_LABEL[node.type]}</span>
        <span className="ml-auto flex items-center gap-1">
          {node.isRoot && <Crown aria-label="Root node" className="size-3" />}
          {node.description && (
            <AlignLeft aria-label="Has a description" className="size-3" />
          )}
          {node.locked && <Lock aria-label="Locked" className="size-3" />}
        </span>
      </div>

      <div className="px-3 pb-3 pt-1">
        {editing ? (
          <TitleEditor node={node} />
        ) : (
          <p
            className={
              node.title
                ? "line-clamp-4 break-words text-sm font-semibold leading-snug"
                : "text-sm italic text-muted-foreground"
            }
          >
            {node.title || "Untitled"}
          </p>
        )}
      </div>
    </div>
  );
});

/**
 * Inline rename. Enter commits, Escape abandons, clicking away commits.
 * Keys are stopped here so typing never triggers canvas shortcuts.
 */
function TitleEditor({ node }: { node: GraphNode }) {
  const { ui } = useEditor();
  const [value, setValue] = useState(node.title);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  // React Flow keeps a new node at `visibility: hidden` until it has measured
  // it, and focus() on a hidden element silently does nothing — so a node
  // made with Tab or a double-click would take no typing. Retry for a few
  // frames until the node is visible and the textarea actually has focus.
  useEffect(() => {
    let frame = 0;
    let tries = 0;
    const attempt = () => {
      const el = ref.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      if (document.activeElement === el) {
        el.select();
        return;
      }
      if (++tries < 30) frame = requestAnimationFrame(attempt);
    };
    attempt();
    return () => cancelAnimationFrame(frame);
  }, []);

  const finish = (commit: boolean, refocus = true) => {
    if (done.current) return;
    done.current = true;
    if (commit) ui.commitTitle(node.id, value.trim());
    else ui.setEditingId(null);
    // The textarea is about to unmount; without this, focus falls to <body>
    // and the next Tab / Enter / Ctrl+Z would go nowhere. Not on blur: the
    // person has already moved focus somewhere on purpose.
    if (refocus) {
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(
          `.react-flow__node[data-id="${CSS.escape(node.id)}"]`,
        );
        el?.focus({ preventScroll: true });
      });
    }
  };

  return (
    <textarea
      ref={ref}
      value={value}
      rows={Math.min(4, Math.max(1, Math.ceil(value.length / 24)))}
      maxLength={500}
      aria-label="Node title"
      placeholder="Name this node"
      // nodrag / nopan: React Flow leaves text selection and pointer
      // events inside this element alone.
      className="nodrag nopan nowheel w-full resize-none bg-transparent text-sm font-semibold leading-snug outline-none placeholder:font-normal placeholder:italic placeholder:text-muted-foreground"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(true, false)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          finish(true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          finish(false);
        }
      }}
    />
  );
}
