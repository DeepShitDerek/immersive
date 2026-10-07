"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  Crown,
  Link2,
  Lock,
  Trash2,
  Unlock,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { incidentEdges } from "../domain/selectors";
import {
  EDGE_DIRECTIONS,
  EDGE_STYLES,
  NODE_COLORS,
  NODE_TYPES,
  RELATIONSHIPS,
  RELATIONSHIP_LABEL,
  TYPE_LABEL,
  effectiveColor,
  type EdgeDirection,
  type EdgeStyle,
  type GraphEdge,
  type GraphNode,
  type NodeColor,
  type NodeType,
  type Relationship,
} from "../domain/types";
import { shortcutLabel } from "../state/keyboard";
import { useEditor, useMapState } from "./editor-context";
import { COLOR_HSL, COLOR_LABEL, TYPE_ICON } from "./visuals";

const DIRECTION_LABEL: Record<EdgeDirection, string> = {
  forward: "Source → target",
  backward: "Target → source",
  both: "Both ways",
  none: "No arrow",
};
const STYLE_LABEL: Record<EdgeStyle, string> = {
  curved: "Curved",
  straight: "Straight",
  orthogonal: "Right angles",
};

/**
 * The detail panel (§29): what is selected, and everything editable about it.
 * The canvas stays visible beside it. Text fields merge their keystrokes into
 * one undo step per field.
 */
export function DetailsPanel({
  onFocusNode,
}: {
  onFocusNode: (id: string) => void;
}) {
  const graph = useMapState((s) => s.graph);
  const selection = useMapState((s) => s.selection);

  if (selection.nodes.length === 1 && selection.edges.length === 0) {
    const node = graph.nodes[selection.nodes[0]];
    return node ? <NodeDetails node={node} onFocusNode={onFocusNode} /> : null;
  }
  if (selection.edges.length === 1 && selection.nodes.length === 0) {
    const edge = graph.edges[selection.edges[0]];
    return edge ? <EdgeDetails edge={edge} /> : null;
  }
  if (selection.nodes.length + selection.edges.length > 1) {
    return <MultiDetails />;
  }
  return <EmptyDetails />;
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function ColorSwatches({
  value,
  onChange,
  typeFallback,
}: {
  value: NodeColor | null;
  onChange: (color: NodeColor | null) => void;
  typeFallback?: NodeColor | null;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Colour"
      className="flex flex-wrap gap-1.5"
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        onClick={() => onChange(null)}
        title={
          typeFallback
            ? `Type colour (${COLOR_LABEL[typeFallback]})`
            : "No colour"
        }
        className={cn(
          "flex size-7 items-center justify-center rounded-full border text-[0.625rem] text-muted-foreground",
          value === null &&
            "ring-2 ring-primary ring-offset-2 ring-offset-card",
        )}
        style={
          typeFallback
            ? { background: `hsl(${COLOR_HSL[typeFallback]} / 0.25)` }
            : undefined
        }
      >
        A
      </button>
      {NODE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={COLOR_LABEL[color]}
          title={COLOR_LABEL[color]}
          onClick={() => onChange(color)}
          className={cn(
            "size-7 rounded-full border border-black/10",
            value === color &&
              "ring-2 ring-primary ring-offset-2 ring-offset-card",
          )}
          style={{ background: `hsl(${COLOR_HSL[color]})` }}
        />
      ))}
    </div>
  );
}

function TypeSelect({
  value,
  onChange,
}: {
  value: NodeType | "";
  onChange: (type: NodeType) => void;
}) {
  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => onChange(v as NodeType)}
    >
      <SelectTrigger aria-label="Type">
        <SelectValue placeholder="Mixed" />
      </SelectTrigger>
      <SelectContent>
        {NODE_TYPES.map((type) => {
          const Icon = TYPE_ICON[type];
          return (
            <SelectItem key={type} value={type}>
              <span className="flex items-center gap-2">
                <Icon aria-hidden className="size-4" />
                {TYPE_LABEL[type]}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function NodeDetails({
  node,
  onFocusNode,
}: {
  node: GraphNode;
  onFocusNode: (id: string) => void;
}) {
  const { actions, ui } = useEditor();
  const graph = useMapState((s) => s.graph);
  const connections = useMemo(
    () =>
      incidentEdges(graph, node.id).map((edge) => {
        const outgoing = edge.source === node.id;
        const other = graph.nodes[outgoing ? edge.target : edge.source];
        return { edge, outgoing, other };
      }),
    [graph, node.id],
  );

  return (
    <div className="space-y-5">
      <Field label="Title" htmlFor="map-node-title">
        <Input
          id="map-node-title"
          value={node.title}
          maxLength={500}
          placeholder="Untitled"
          onChange={(e) => actions.rename(node.id, e.target.value)}
        />
      </Field>

      <Field label="Type">
        <TypeSelect
          value={node.type}
          onChange={(type) => actions.setType(type, [node.id])}
        />
      </Field>

      <Field label="Colour">
        <ColorSwatches
          value={node.color}
          typeFallback={effectiveColor({ ...node, color: null })}
          onChange={(color) => actions.setColor(color, [node.id])}
        />
      </Field>

      <Field label="Description" htmlFor="map-node-description">
        <Textarea
          id="map-node-description"
          value={node.description}
          rows={4}
          maxLength={20_000}
          placeholder="Details, context, evidence…"
          onChange={(e) =>
            actions.updateNode(
              node.id,
              { description: e.target.value },
              `desc:${node.id}`,
            )
          }
        />
      </Field>

      <Field label="Tags" htmlFor="map-node-tags">
        <Input
          id="map-node-tags"
          defaultValue={node.tags.join(", ")}
          key={node.tags.join("|")}
          placeholder="life, housing"
          onBlur={(e) =>
            actions.updateNode(node.id, {
              tags: e.target.value
                .split(",")
                .map((t) => t.trim().replace(/^#/, ""))
                .filter(Boolean)
                .slice(0, 50),
            })
          }
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => actions.setLocked(!node.locked, [node.id])}
          aria-pressed={node.locked}
        >
          {node.locked ? (
            <Unlock className="mr-1.5 size-3.5" />
          ) : (
            <Lock className="mr-1.5 size-3.5" />
          )}
          {node.locked ? "Unlock" : "Lock"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => actions.setRoot(node.id)}
          aria-pressed={node.isRoot}
        >
          <Crown className="mr-1.5 size-3.5" />
          {node.isRoot ? "Unset root" : "Make root"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={() => {
            const r = actions.deleteSelection();
            if (r.notice) ui.notify(r.notice);
          }}
          title={shortcutLabel("delete")}
        >
          <Trash2 className="mr-1.5 size-3.5" />
          Delete
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Connections ({connections.length})
        </p>
        {connections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None yet. Drag from a node&apos;s edge dot to another node.
          </p>
        ) : (
          <ul className="space-y-1">
            {connections.map(({ edge, outgoing, other }) => (
              <li key={edge.id}>
                <button
                  type="button"
                  onClick={() => other && onFocusNode(other.id)}
                  className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm hover:bg-secondary"
                >
                  {outgoing ? (
                    <ArrowRight
                      aria-label="to"
                      className="size-3.5 shrink-0 text-muted-foreground"
                    />
                  ) : (
                    <ArrowLeft
                      aria-label="from"
                      className="size-3.5 shrink-0 text-muted-foreground"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {other?.title || "Untitled"}
                  </span>
                  {(edge.relationship !== "related" || edge.label) && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {edge.label || RELATIONSHIP_LABEL[edge.relationship]}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Created {format(new Date(node.createdAt), "MMM d, yyyy")} · edited{" "}
        {format(new Date(node.updatedAt), "MMM d, yyyy HH:mm")}
      </p>
    </div>
  );
}

function EdgeDetails({ edge }: { edge: GraphEdge }) {
  const { actions } = useEditor();
  const graph = useMapState((s) => s.graph);
  const source = graph.nodes[edge.source];
  const target = graph.nodes[edge.target];

  return (
    <div className="space-y-5">
      <p className="text-sm">
        <span className="font-semibold">{source?.title || "Untitled"}</span>
        <ArrowRight
          aria-label="to"
          className="mx-1.5 inline size-3.5 text-muted-foreground"
        />
        <span className="font-semibold">{target?.title || "Untitled"}</span>
      </p>

      <Field label="Relationship">
        <Select
          value={edge.relationship}
          onValueChange={(v) =>
            actions.updateEdge(edge.id, { relationship: v as Relationship })
          }
        >
          <SelectTrigger aria-label="Relationship">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RELATIONSHIPS.map((r) => (
              <SelectItem key={r} value={r}>
                {RELATIONSHIP_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label={edge.relationship === "custom" ? "Relationship name" : "Label"}
        htmlFor="map-edge-label"
      >
        <Input
          id="map-edge-label"
          value={edge.label}
          maxLength={200}
          placeholder={
            edge.relationship === "custom" ? "e.g. blocks" : "e.g. because"
          }
          onChange={(e) =>
            actions.updateEdge(
              edge.id,
              { label: e.target.value },
              `label:${edge.id}`,
            )
          }
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Direction">
          <Select
            value={edge.direction}
            onValueChange={(v) =>
              actions.updateEdge(edge.id, { direction: v as EdgeDirection })
            }
          >
            <SelectTrigger aria-label="Direction">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EDGE_DIRECTIONS.map((d) => (
                <SelectItem key={d} value={d}>
                  {DIRECTION_LABEL[d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Line">
          <Select
            value={edge.style}
            onValueChange={(v) =>
              actions.updateEdge(edge.id, { style: v as EdgeStyle })
            }
          >
            <SelectTrigger aria-label="Line style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EDGE_STYLES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STYLE_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Colour">
        <ColorSwatches
          value={edge.color}
          onChange={(color) => actions.updateEdge(edge.id, { color })}
        />
      </Field>

      <Button
        variant="outline"
        size="sm"
        className="text-destructive"
        onClick={() => actions.disconnect([edge.id])}
      >
        <Unlink className="mr-1.5 size-3.5" />
        Remove connection
      </Button>
    </div>
  );
}

function MultiDetails() {
  const { actions, ui } = useEditor();
  const graph = useMapState((s) => s.graph);
  const selection = useMapState((s) => s.selection);
  const nodes = selection.nodes.map((id) => graph.nodes[id]).filter(Boolean);
  const sharedType = nodes.every((n) => n.type === nodes[0]?.type)
    ? (nodes[0]?.type ?? "")
    : "";
  const sharedColor = nodes.every((n) => n.color === nodes[0]?.color)
    ? (nodes[0]?.color ?? null)
    : null;

  return (
    <div className="space-y-5">
      <p className="text-sm font-medium">
        {selection.nodes.length} nodes
        {selection.edges.length
          ? `, ${selection.edges.length} connections`
          : ""}{" "}
        selected
      </p>
      {nodes.length > 0 && (
        <>
          <Field label="Type">
            <TypeSelect
              value={sharedType}
              onChange={(type) => actions.setType(type)}
            />
          </Field>
          <Field label="Colour">
            <ColorSwatches
              value={sharedColor}
              onChange={(color) => actions.setColor(color)}
            />
          </Field>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {nodes.length >= 2 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const r = actions.connectSelected();
              if (r.notice) ui.notify(r.notice);
            }}
            title={shortcutLabel("connect")}
          >
            <Link2 className="mr-1.5 size-3.5" />
            Connect first to others
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={() => {
            const r = actions.deleteSelection();
            if (r.notice) ui.notify(r.notice);
          }}
        >
          <Trash2 className="mr-1.5 size-3.5" />
          Delete
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Drag any selected node to move them together.
      </p>
    </div>
  );
}

/**
 * Nothing selected. Keyboard shortcuts are not listed here: they are
 * desktop-only content, and the editor's ⋯ menu opens the workspace keyboard
 * map.
 *
 * Deliberately static: no store subscriptions. Showing live counts here made
 * the panel re-render as a double-clicked node took focus, and the typed
 * title was lost in about one run in three (check:maps step 6).
 */
function EmptyDetails() {
  return (
    <div className="space-y-2">
      {/* Wording for the pointer in hand, by CSS: no state, no re-render. */}
      <p className="hidden text-sm text-muted-foreground [@media(pointer:coarse)]:block">
        Tap a node or connection to edit it here.
      </p>
      <p className="text-sm text-muted-foreground [@media(pointer:coarse)]:hidden">
        Select a node or connection to edit it here. Double-click empty space to
        add a node.
      </p>
    </div>
  );
}
