"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchNodes } from "../domain/selectors";
import { TYPE_LABEL } from "../domain/types";
import { useEditor, useMapState } from "./editor-context";
import { TYPE_ICON } from "./visuals";

/**
 * Search (§22) and quick add (§5): type to find a node; Enter jumps to it.
 * When nothing matches — or always, as the last item — the same text can
 * become a new node, as a child of the selected node if there is one.
 */
export function SearchDialog({
  open,
  onOpenChange,
  onFocusNode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFocusNode: (id: string) => void;
}) {
  const { store, actions } = useEditor();
  const graph = useMapState((s) => s.graph);
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchNodes(graph, query, 30), [graph, query]);
  const title = query.trim();

  const close = () => {
    onOpenChange(false);
    setQuery("");
  };

  const create = () => {
    const parent = store.getState().selection.nodes[0];
    const r = parent ? actions.addChild(parent) : actions.addNode();
    if (r.editNodeId) {
      actions.rename(r.editNodeId, title);
      onFocusNode(r.editNodeId);
    }
    close();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent className="overflow-hidden p-0 shadow-e3">
        <DialogTitle className="sr-only">Search or add a node</DialogTitle>
        {/* Ranking is ours (prefix before contains): cmdk must not re-filter,
            or it would match the query against item values (node ids). */}
        <Command
          shouldFilter={false}
          loop
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5"
        >
          <CommandInput
            placeholder="Search nodes, or type to add one…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {title && results.length === 0 && (
              <CommandEmpty>No node matches “{title}”.</CommandEmpty>
            )}
            {results.length > 0 && (
              <CommandGroup heading="Nodes">
                {results.map((node) => {
                  const Icon = TYPE_ICON[node.type];
                  return (
                    <CommandItem
                      key={node.id}
                      value={node.id}
                      onSelect={() => {
                        onFocusNode(node.id);
                        close();
                      }}
                    >
                      <Icon
                        aria-hidden
                        className="mr-2 size-4 text-muted-foreground"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {node.title || "Untitled"}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {TYPE_LABEL[node.type]}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {title && (
              <CommandGroup heading="Add">
                <CommandItem value={`__create__${title}`} onSelect={create}>
                  <Plus aria-hidden className="mr-2 size-4" />
                  Add “{title}”
                  {store.getState().selection.nodes[0]
                    ? " under the selected node"
                    : ""}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
