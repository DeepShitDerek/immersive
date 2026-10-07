"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Network, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ThinkingMapSummary } from "@/types";
import {
  MAP_CONFLICT,
  useCreateMapMutation,
  useDeleteMapMutation,
  useGetMapQuery,
  useGetMapsQuery,
  useLazyGetMapQuery,
  useSaveMapDocMutation,
  useUpdateMapMetaMutation,
} from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  DocumentCard,
  EmptyState,
  LoadError,
  LoadingState,
  ManagerWrapper,
  NewDocumentCard,
  PageHeader,
} from "@/components/admin/shared";
import { useUndoableDelete } from "@/hooks/use-undoable-delete";
import { getErrorMessage } from "@/lib/utils";
import { emptyDocument } from "../domain/serialize";
import type { SaveOutcome, SaveRequest } from "../state/autosave";
import { MapEditor } from "./map-editor";

/**
 * /admin/maps — the list of maps, and the editor for one.
 *
 * The open map lives in the URL (`?map=<id>`), so a reload reopens it and
 * Back closes it. The editor covers the viewport like the whiteboard's.
 */
/** One empty list for every render while the query has none (see Navigation). */
const NO_MAPS: ThinkingMapSummary[] = [];

export default function MapsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const openId = params?.get("map") ?? null;
  const [search, setSearch] = useState("");

  const {
    data: allMaps = NO_MAPS,
    isLoading,
    error: loadError,
    refetch,
  } = useGetMapsQuery();
  const [createMap, { isLoading: creating }] = useCreateMapMutation();
  const [deleteMap] = useDeleteMapMutation();
  const [updateMeta] = useUpdateMapMetaMutation();

  // Delete offers Undo instead of asking first; nothing is removed
  // until the toast closes.
  const { pending: deleting, remove: removeMap } =
    useUndoableDelete<ThinkingMapSummary>(async (map) => {
      try {
        await deleteMap(map.id).unwrap();
      } catch (error) {
        toast.error("Couldn't delete the map", {
          description: getErrorMessage(error),
        });
      }
    });

  const maps = useMemo(
    () =>
      deleting.size ? allMaps.filter((m) => !deleting.has(m.id)) : allMaps,
    [allMaps, deleting],
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? maps.filter((m) => m.name.toLowerCase().includes(term))
      : maps;
  }, [maps, search]);

  const open = (id: string | null) =>
    router.replace(id ? `/admin/maps/?map=${id}` : "/admin/maps/");

  const handleCreate = async () => {
    try {
      const map = await createMap({
        name: "Untitled map",
        doc: emptyDocument(),
      }).unwrap();
      open(map.id);
    } catch (error) {
      toast.error("Couldn't create a map", {
        description: getErrorMessage(error),
      });
    }
  };

  const handleRename = async (map: ThinkingMapSummary, name: string) => {
    try {
      await updateMeta({ id: map.id, name }).unwrap();
    } catch (error) {
      toast.error("Couldn't rename the map", {
        description: getErrorMessage(error),
      });
    }
  };

  const header = (
    <PageHeader
      title="Maps"
      description="Map a problem: what’s happening, why, what depends on what, and what to do."
      actions={
        <Button onClick={handleCreate} disabled={creating}>
          {creating ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="mr-2 size-4" aria-hidden />
          )}
          New map
        </Button>
      }
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="Search maps…"
    />
  );

  // A failed read used to say "No maps yet".
  if (loadError && allMaps.length === 0) {
    return (
      <ManagerWrapper>
        {header}
        <LoadError what="your maps" error={loadError} onRetry={refetch} />
      </ManagerWrapper>
    );
  }

  if (isLoading && allMaps.length === 0) {
    return (
      <ManagerWrapper>
        {header}
        <LoadingState label="Loading your maps" />
      </ManagerWrapper>
    );
  }

  return (
    <ManagerWrapper>
      {header}

      {filtered.length === 0 && (search || maps.length > 0) ? (
        <EmptyState
          icon={Network}
          variant="bordered"
          title="No map matches"
          description="Try another name."
        />
      ) : maps.length === 0 ? (
        <EmptyState
          icon={Network}
          variant="card"
          title="No maps yet"
          description="Start with one question in the middle, then branch out: problems, causes, decisions, actions."
          action={{ label: "New map", onClick: handleCreate, icon: Plus }}
        />
      ) : (
        <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {!search && (
            <li>
              <NewDocumentCard
                label="New map"
                onClick={handleCreate}
                disabled={creating}
              />
            </li>
          )}
          {filtered.map((map) => (
            <li key={map.id}>
              <DocumentCard
                title={map.name}
                untitled="Untitled map"
                thumbnail={
                  <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                    <Network className="size-6" aria-hidden />
                    <span className="text-xs tabular-nums">
                      {map.node_count} node{map.node_count === 1 ? "" : "s"} ·{" "}
                      {map.edge_count} connection
                      {map.edge_count === 1 ? "" : "s"}
                    </span>
                  </span>
                }
                meta={`Edited ${formatDistanceToNow(new Date(map.updated_at), { addSuffix: true })}`}
                pinned={map.is_pinned}
                onOpen={() => open(map.id)}
                onRename={(name) => void handleRename(map, name)}
                menuItems={
                  <>
                    <DropdownMenuItem
                      onSelect={() =>
                        void updateMeta({
                          id: map.id,
                          is_pinned: !map.is_pinned,
                        })
                      }
                    >
                      {map.is_pinned ? (
                        <PinOff className="mr-2 size-4" aria-hidden />
                      ) : (
                        <Pin className="mr-2 size-4" aria-hidden />
                      )}
                      {map.is_pinned ? "Unpin" : "Pin"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() =>
                        removeMap(
                          map,
                          `Deleted "${map.name}"`,
                          `${map.node_count} node${map.node_count === 1 ? "" : "s"} and ${map.edge_count} connection${map.edge_count === 1 ? "" : "s"} go when this closes.`,
                        )
                      }
                    >
                      <Trash2 className="mr-2 size-4" aria-hidden /> Delete
                    </DropdownMenuItem>
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}

      {openId && <EditorOverlay id={openId} onClose={() => open(null)} />}
    </ManagerWrapper>
  );
}

function EditorOverlay({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: map, isLoading, isError } = useGetMapQuery(id);
  const [saveDoc] = useSaveMapDocMutation();
  const [fetchMap] = useLazyGetMapQuery();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (isError) {
      toast.error("That map couldn't be opened.");
      onClose();
    }
  }, [isError]);

  const save = async (request: SaveRequest): Promise<SaveOutcome> => {
    const result = await saveDoc({ id, ...request });
    if ("data" in result && result.data)
      return { ok: true, revision: result.data.revision };
    const error =
      "error" in result
        ? (result.error as { code?: string; message?: string })
        : undefined;
    return {
      ok: false,
      conflict: error?.code === MAP_CONFLICT,
      message: error?.message ?? "Save failed",
    };
  };

  const reload = async () => {
    const latest = await fetchMap(id).unwrap();
    return { name: latest.name, doc: latest.doc, revision: latest.revision };
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={map ? `Map: ${map.name}` : "Map"}
      className="fixed inset-0 z-overlay bg-background"
    >
      {isLoading || !map ? (
        <div className="flex h-full items-center justify-center">
          <Loader2
            aria-label="Loading map"
            className="size-8 animate-spin text-muted-foreground"
          />
        </div>
      ) : (
        <MapEditor
          key={map.id}
          initial={{ name: map.name, doc: map.doc, revision: map.revision }}
          save={save}
          reload={reload}
          onClose={onClose}
        />
      )}
    </div>,
    document.body,
  );
}
