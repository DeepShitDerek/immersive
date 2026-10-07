"use client";

import type { ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  NODE_COLORS,
  NODE_TYPES,
  RELATIONSHIPS,
  RELATIONSHIP_LABEL,
  TYPE_LABEL,
} from "../domain/types";
import type { MenuTarget } from "../canvas/map-canvas";
import { shortcutLabel } from "../state/keyboard";
import { useEditor, useMapState } from "./editor-context";
import { COLOR_HSL, COLOR_LABEL, TYPE_ICON } from "./visuals";

/**
 * Right-click menu (§30). Shows only what applies to what was clicked: a
 * node, a connection, or empty canvas. Every item also has a keyboard or
 * toolbar route; the menu is a shortcut, never the only way.
 */
export function MapContextMenu({
  target,
  onDeleteRequest,
  children,
}: {
  target: MenuTarget | null;
  onDeleteRequest: () => void;
  children: ReactNode;
}) {
  const { store, actions, ui } = useEditor();
  const graph = useMapState((s) => s.graph);
  const node = target?.kind === "node" ? graph.nodes[target.id] : undefined;
  const edge = target?.kind === "edge" ? graph.edges[target.id] : undefined;

  const focusNode = (id: string) => store.select({ nodes: [id], edges: [] });
  const editNew = (id?: string) => id && ui.setEditingId(id);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        {node && (
          <>
            <ContextMenuItem
              onSelect={() => editNew(actions.addChild(node.id).editNodeId)}
            >
              Add child
              <ContextMenuShortcut>
                {shortcutLabel("addChild")}
              </ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => editNew(actions.addSibling(node.id).editNodeId)}
            >
              Add sibling
              <ContextMenuShortcut>
                {shortcutLabel("addSibling")}
              </ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => ui.setEditingId(node.id)}>
              Rename
              <ContextMenuShortcut>
                {shortcutLabel("rename")}
              </ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>Type</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {NODE_TYPES.map((type) => {
                  const Icon = TYPE_ICON[type];
                  return (
                    <ContextMenuItem
                      key={type}
                      onSelect={() => actions.setType(type, targetIds(node.id))}
                    >
                      <Icon aria-hidden className="mr-2 size-4" />
                      {TYPE_LABEL[type]}
                    </ContextMenuItem>
                  );
                })}
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSub>
              <ContextMenuSubTrigger>Colour</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem
                  onSelect={() => actions.setColor(null, targetIds(node.id))}
                >
                  Type colour
                </ContextMenuItem>
                {NODE_COLORS.map((color) => (
                  <ContextMenuItem
                    key={color}
                    onSelect={() => actions.setColor(color, targetIds(node.id))}
                  >
                    <span
                      aria-hidden
                      className="mr-2 size-3 rounded-full"
                      style={{ background: `hsl(${COLOR_HSL[color]})` }}
                    />
                    {COLOR_LABEL[color]}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
            {store.getState().selection.nodes.length >= 2 && (
              <ContextMenuItem
                onSelect={() => {
                  const r = actions.connectSelected();
                  if (r.notice) ui.notify(r.notice);
                }}
              >
                Connect selected
                <ContextMenuShortcut>
                  {shortcutLabel("connect")}
                </ContextMenuShortcut>
              </ContextMenuItem>
            )}
            <ContextMenuItem onSelect={() => actions.duplicate()}>
              Duplicate
              <ContextMenuShortcut>
                {shortcutLabel("duplicate")}
              </ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => actions.copy()}>
              Copy
              <ContextMenuShortcut>{shortcutLabel("copy")}</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() =>
                actions.setLocked(!node.locked, targetIds(node.id))
              }
            >
              {node.locked ? "Unlock" : "Lock"}
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => actions.setRoot(node.id)}>
              {node.isRoot ? "Unset root" : "Make root"}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-destructive"
              onSelect={onDeleteRequest}
            >
              Delete
              <ContextMenuShortcut>
                {shortcutLabel("delete")}
              </ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}

        {edge && (
          <>
            <ContextMenuSub>
              <ContextMenuSubTrigger>Relationship</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {RELATIONSHIPS.map((r) => (
                  <ContextMenuItem
                    key={r}
                    onSelect={() =>
                      actions.updateEdge(edge.id, { relationship: r })
                    }
                  >
                    {RELATIONSHIP_LABEL[r]}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuItem
              onSelect={() =>
                actions.updateEdge(edge.id, {
                  direction:
                    edge.direction === "forward"
                      ? "backward"
                      : edge.direction === "backward"
                        ? "forward"
                        : edge.direction,
                })
              }
            >
              Reverse direction
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => focusNode(edge.source)}>
              Select source
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => focusNode(edge.target)}>
              Select target
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-destructive"
              onSelect={() => actions.disconnect([edge.id])}
            >
              Remove connection
              <ContextMenuShortcut>
                {shortcutLabel("delete")}
              </ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}

        {target?.kind === "pane" && (
          <>
            <ContextMenuItem
              onSelect={() =>
                editNew(
                  actions.addNode({
                    position: { x: target.at.x - 100, y: target.at.y - 30 },
                  }).editNodeId,
                )
              }
            >
              Add node here
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                const r = actions.paste(undefined, target.at);
                if (r.notice) ui.notify(r.notice);
              }}
            >
              Paste here
              <ContextMenuShortcut>
                {shortcutLabel("paste")}
              </ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => actions.selectAll()}>
              Select all
              <ContextMenuShortcut>
                {shortcutLabel("selectAll")}
              </ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => ui.openSearch()}>
              Search nodes
              <ContextMenuShortcut>
                {shortcutLabel("search")}
              </ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );

  /** A menu action on a selected node applies to the whole selection. */
  function targetIds(id: string): string[] {
    const selected = store.getState().selection.nodes;
    return selected.includes(id) ? [...selected] : [id];
  }
}
