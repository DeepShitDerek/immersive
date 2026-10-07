"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, PenLine, Search } from "lucide-react";
import { toast } from "sonner";
import type { LifeUpdate } from "@/types";
import {
  useDeleteLifeUpdateMutation,
  useGetLifeUpdatesQuery,
  useUpdateLifeUpdateMutation,
} from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RemovableChip } from "@/components/ui/filter-chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUndoableDelete } from "@/hooks/use-undoable-delete";
import {
  EmptyState,
  LoadingState,
  ManagerWrapper,
  ModuleTabs,
  PageHeader,
  LoadError,
} from "@/components/admin/shared";
import { LIFE_UPDATE_CATEGORY_OPTIONS } from "@/lib/constants";
import { byNewest, groupByMonth, matchesSearch } from "@/lib/life-update";
import { getErrorMessage } from "@/lib/utils";
import { UpdateComposer } from "./update-composer";
import { UpdateEntry } from "./update-entry";

type StatusFilter = "all" | "draft" | "published" | "pinned";

/**
 * Life Updates — write at the top, manage underneath.
 *
 * The old module opened on filters and a board of tilted polaroids, and
 * writing meant opening a sheet. Posting is the common case, so the composer
 * is the first thing on the page; below it is the stream, pinned first and
 * then month by month in the order the site will show it, with drafts in
 * place and marked. Editing swaps an entry for the composer in place.
 */
/** One empty list for every render while the query has none (see Navigation). */
const NO_UPDATES: LifeUpdate[] = [];

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "published", label: "Published" },
  { id: "pinned", label: "Pinned" },
];

export default function LifeUpdatesPage() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [composing, setComposing] = useState(false);
  const composerRef = useRef<HTMLDivElement>(null);
  // The composer stays mounted (so a draft survives closing it), which means
  // its autoFocus has already run: move focus into it when it opens, so a
  // keyboard user lands in the field they asked for.
  useEffect(() => {
    if (composing)
      composerRef.current
        ?.querySelector<HTMLElement>("input, textarea, [contenteditable=true]")
        ?.focus();
  }, [composing]);

  const {
    data: allUpdates = NO_UPDATES,
    isLoading,
    error: loadError,
    refetch,
  } = useGetLifeUpdatesQuery();
  const [updateLifeUpdate] = useUpdateLifeUpdateMutation();
  const [deleteLifeUpdate] = useDeleteLifeUpdateMutation();

  // Delete offers Undo instead of asking first. A published update
  // stays on /updates until the toast closes, so Undo leaves the site as it was.
  const { pending: deleting, remove: removeUpdate } =
    useUndoableDelete<LifeUpdate>(async (update) => {
      try {
        await deleteLifeUpdate(update.id).unwrap();
      } catch (err: unknown) {
        toast.error("Couldn't delete", { description: getErrorMessage(err) });
      }
    });
  const updates = useMemo(
    () =>
      deleting.size
        ? allUpdates.filter((u) => !deleting.has(u.id))
        : allUpdates,
    [allUpdates, deleting],
  );

  const counts = useMemo(
    () => ({
      all: updates.length,
      draft: updates.filter((u) => !u.is_published).length,
      published: updates.filter((u) => u.is_published).length,
      pinned: updates.filter((u) => u.is_pinned).length,
    }),
    [updates],
  );

  const presentCategories = LIFE_UPDATE_CATEGORY_OPTIONS.filter((option) =>
    updates.some((u) => u.category === option.value),
  );

  const visible = useMemo(
    () =>
      [...updates]
        .sort(byNewest)
        .filter((u) => {
          if (status === "draft") return !u.is_published;
          if (status === "published") return !!u.is_published;
          if (status === "pinned") return !!u.is_pinned;
          return true;
        })
        .filter((u) => !category || u.category === category)
        .filter((u) => matchesSearch(u, searchTerm)),
    [updates, status, category, searchTerm],
  );

  /** Pinned lead, as on the site; the rest by month. */
  const pinned = visible.filter((u) => u.is_pinned);
  const months = groupByMonth(
    status === "pinned" ? [] : visible.filter((u) => !u.is_pinned),
  );

  const handleDelete = (update: LifeUpdate) => {
    if (editingId === update.id) setEditingId(null);
    removeUpdate(
      update,
      "Update deleted",
      update.is_published
        ? "It comes off /updates when this closes."
        : undefined,
    );
  };

  const handlePatch = async (
    update: LifeUpdate,
    patch: Pick<Partial<LifeUpdate>, "is_pinned" | "is_published">,
    done: string,
  ) => {
    try {
      await updateLifeUpdate({ id: update.id, ...patch }).unwrap();
      toast.success(done);
    } catch (err: unknown) {
      toast.error("Couldn't update", { description: getErrorMessage(err) });
    }
  };

  const renderEntry = (update: LifeUpdate) =>
    editingId === update.id ? (
      <UpdateComposer
        key={update.id}
        update={update}
        autoFocus
        onDone={() => setEditingId(null)}
        onCancel={() => setEditingId(null)}
      />
    ) : (
      <UpdateEntry
        key={update.id}
        update={update}
        onEdit={() => setEditingId(update.id)}
        onDelete={() => handleDelete(update)}
        onTogglePin={() =>
          handlePatch(
            update,
            { is_pinned: !update.is_pinned },
            update.is_pinned ? "Unpinned." : "Pinned.",
          )
        }
        onTogglePublish={() =>
          handlePatch(
            update,
            { is_published: !update.is_published },
            update.is_published ? "Moved to drafts." : "Published.",
          )
        }
      />
    );

  const filtered = status !== "all" || !!category || !!searchTerm.trim();

  return (
    <ManagerWrapper>
      <PageHeader
        title="Updates"
        description="Short news for /updates — what you're doing, watching and thinking."
        actions={
          <Button variant="outline" asChild>
            <a href="/updates" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 size-4" aria-hidden />
              View on site
            </a>
          </Button>
        }
      />

      <div className="mx-auto max-w-3xl space-y-8">
        {/*
          A one-line "What's new?" that opens the composer: the composer was always open and pushed the feed down on
          every visit. Closed, it is hidden rather than removed, so whatever
          you had typed is still there when you open it again.
        */}
        {!composing && (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="flex w-full items-center gap-3 rounded-surface border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-input focus-ring"
          >
            <PenLine aria-hidden className="size-4 shrink-0" />
            What&apos;s new?
          </button>
        )}
        <div ref={composerRef} hidden={!composing}>
          <UpdateComposer
            onDone={() => setComposing(false)}
            onCancel={() => setComposing(false)}
          />
        </div>

        {isLoading ? (
          <LoadingState label="Loading updates" />
        ) : loadError && updates.length === 0 ? (
          <LoadError what="your updates" error={loadError} onRetry={refetch} />
        ) : updates.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nothing yet. Whatever you write above stays a draft until you
            publish it.
          </p>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              {/* Status as tabs, and one row for search and kind: there were
                  two rows of chips before the first update. */}
              <ModuleTabs
                label="Update status"
                className="mb-0"
                tabs={STATUS_TABS.filter(
                  (t) => t.id !== "pinned" || counts.pinned > 0,
                ).map((t) => ({
                  ...t,
                  label: `${t.label} ${counts[t.id]}`,
                }))}
                current={status}
                onSelect={setStatus}
              />
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search updates…"
                    aria-label="Search updates"
                    className="h-9 pl-8"
                  />
                </div>
                {presentCategories.length > 1 && (
                  <Select
                    value={category ?? "all"}
                    onValueChange={(v) => setCategory(v === "all" ? null : v)}
                  >
                    <SelectTrigger
                      className="h-9 w-auto min-w-[9rem]"
                      aria-label="Kind"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Every kind</SelectItem>
                      {presentCategories.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label} (
                          {
                            updates.filter((u) => u.category === option.value)
                              .length
                          }
                          )
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {category && (
                <div className="flex flex-wrap gap-2">
                  <RemovableChip
                    label={
                      presentCategories.find((o) => o.value === category)
                        ?.label ?? category
                    }
                    onRemove={() => setCategory(null)}
                  />
                </div>
              )}
            </div>

            {visible.length === 0 ? (
              <EmptyState
                variant="card"
                size="compact"
                icon={Search}
                title="No matches"
                description="No updates match these filters."
                action={
                  filtered
                    ? {
                        label: "Clear filters",
                        onClick: () => {
                          setStatus("all");
                          setCategory(null);
                          setSearchTerm("");
                        },
                      }
                    : undefined
                }
              />
            ) : (
              <>
                {pinned.length > 0 && (
                  <section aria-label="Pinned" className="space-y-3">
                    <h2 className="text-sm font-semibold text-foreground">
                      Pinned
                    </h2>
                    {pinned.map(renderEntry)}
                  </section>
                )}
                {months.map((group) => (
                  <section
                    key={group.label}
                    aria-label={group.label}
                    className="space-y-3"
                  >
                    <h2 className="text-sm font-semibold text-foreground">
                      {group.label}
                    </h2>
                    {group.updates.map(renderEntry)}
                  </section>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </ManagerWrapper>
  );
}
