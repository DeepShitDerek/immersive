"use client";

import { useMemo, useState } from "react";
import { BookMarked, ChevronDown, Plus, Quote } from "lucide-react";
import { toast } from "sonner";
import type { LibraryHighlight, LibrarySource } from "@/types";
import {
  useDeleteLibraryHighlightMutation,
  useDeleteLibrarySourceMutation,
  useGetLibraryHighlightsQuery,
  useGetLibrarySourcesQuery,
  useSaveLibraryHighlightMutation,
  useSaveLibrarySourceMutation,
} from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterBar, FilterChip } from "@/components/ui/filter-chip";
import {
  EmptyState,
  FormSheet,
  LoadingState,
  ManagerWrapper,
  ModuleTabs,
  PageHeader,
  LoadError,
} from "@/components/admin/shared";
import { useUndoableDelete } from "@/hooks/use-undoable-delete";
import { useUrlTab } from "@/hooks/use-url-tab";
import { getErrorMessage } from "@/lib/utils";
import { HighlightForm } from "./highlight-form";
import { SourceForm } from "./source-form";
import { SourceView } from "./source-view";
import { HighlightItem, NowReading, SourceRow } from "./library-rows";
import {
  STATUS_FILTER_LABELS,
  STATUS_ORDER,
  citationLine,
  countHighlights,
  countSourcesByStatus,
  highlightsPerSource,
  localIsoDate,
  statusChange,
  visibleHighlights,
  visibleSources,
  type HighlightFilter,
  type StatusFilter,
} from "./library-model";

const HIGHLIGHT_FILTERS: { value: HighlightFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "favorites", label: "Favourites" },
  { value: "public", label: "On the site" },
];

const TABS = ["reading", "highlights"] as const;
type Tab = (typeof TABS)[number];

/** How many in-progress sources the "Now reading" strip shows. */
const NOW_READING_MAX = 3;

/** One empty list for every render while a query has none (see Navigation). */
const NO_SOURCES: LibrarySource[] = [];
const NO_HIGHLIGHTS: LibraryHighlight[] = [];

export default function LibraryPage() {
  const {
    data: allSources = NO_SOURCES,
    isLoading: loadingSources,
    error: sourcesError,
    refetch: refetchSources,
  } = useGetLibrarySourcesQuery();
  const {
    data: allHighlights = NO_HIGHLIGHTS,
    isLoading: loadingHighlights,
    error: highlightsError,
    refetch: refetchHighlights,
  } = useGetLibraryHighlightsQuery();
  const [saveHighlight] = useSaveLibraryHighlightMutation();
  const [deleteHighlight] = useDeleteLibraryHighlightMutation();
  const [saveSource] = useSaveLibrarySourceMutation();
  const [deleteSource] = useDeleteLibrarySourceMutation();

  // Reading first: it holds what you are in the
  // middle of. In the URL, so a reload or a shared link keeps the tab.
  const [tab, setTab] = useUrlTab<Tab>("reading", TABS);
  const [search, setSearch] = useState("");
  const [highlightFilter, setHighlightFilter] =
    useState<HighlightFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [sourceSheet, setSourceSheet] = useState<{
    open: boolean;
    source: LibrarySource | null;
  }>({ open: false, source: null });
  const [highlightSheet, setHighlightSheet] = useState<{
    open: boolean;
    highlight: LibraryHighlight | null;
    sourceId: string | null;
  }>({ open: false, highlight: null, sourceId: null });
  // An id rather than the row, so the view follows edits made while it is open.
  const [viewingId, setViewingId] = useState<string | null>(null);

  // Deletes offer Undo instead of asking first. Nothing is deleted
  // until the toast closes: a public highlight stays on the site meanwhile,
  // and a source's highlights keep their source.
  const { pending: deletingHighlights, remove: removeHighlightLater } =
    useUndoableDelete<LibraryHighlight>(async (highlight) => {
      try {
        await deleteHighlight(highlight.id).unwrap();
      } catch (error) {
        toast.error("Couldn't delete the highlight", {
          description: getErrorMessage(error),
        });
      }
    });
  const { pending: deletingSources, remove: removeSourceLater } =
    useUndoableDelete<LibrarySource>(async (source) => {
      try {
        await deleteSource(source.id).unwrap();
      } catch (error) {
        toast.error("Couldn't delete it", {
          description: getErrorMessage(error),
        });
      }
    });

  const sources = useMemo(
    () =>
      deletingSources.size
        ? allSources.filter((s) => !deletingSources.has(s.id))
        : allSources,
    [allSources, deletingSources],
  );
  const highlights = useMemo(
    () =>
      deletingHighlights.size
        ? allHighlights.filter((h) => !deletingHighlights.has(h.id))
        : allHighlights,
    [allHighlights, deletingHighlights],
  );

  const sourcesById = useMemo(
    () => new Map(sources.map((s) => [s.id, s])),
    [sources],
  );
  const perSource = useMemo(
    () => highlightsPerSource(highlights),
    [highlights],
  );
  const highlightCounts = useMemo(
    () => countHighlights(highlights),
    [highlights],
  );
  const statusCounts = useMemo(() => countSourcesByStatus(sources), [sources]);

  const shownHighlights = useMemo(
    () => visibleHighlights(highlights, sourcesById, highlightFilter, search),
    [highlights, sourcesById, highlightFilter, search],
  );
  const shownSources = useMemo(
    () => visibleSources(sources, statusFilter, search),
    [sources, statusFilter, search],
  );
  const nowReading = useMemo(
    () =>
      sources
        .filter((s) => s.status === "in_progress")
        .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
        .slice(0, NOW_READING_MAX),
    [sources],
  );

  const viewing = viewingId ? (sourcesById.get(viewingId) ?? null) : null;

  const openNewHighlight = (sourceId: string | null = null) =>
    setHighlightSheet({ open: true, highlight: null, sourceId });
  const openNewSource = () => setSourceSheet({ open: true, source: null });

  const toggle = async (
    highlight: LibraryHighlight,
    field: "is_public" | "is_favorite",
  ) => {
    const next = !highlight[field];
    try {
      await saveHighlight({ id: highlight.id, [field]: next }).unwrap();
      if (field === "is_public") {
        toast.success(next ? "Now on the site." : "Taken off the site.");
      }
    } catch (error) {
      toast.error("Couldn't update the highlight", {
        description: getErrorMessage(error),
      });
    }
  };

  const removeHighlight = (highlight: LibraryHighlight) =>
    removeHighlightLater(
      highlight,
      "Highlight deleted",
      highlight.is_public
        ? "It comes off the site when this closes."
        : undefined,
    );

  const removeSource = (source: LibrarySource) => {
    const kept = perSource.get(source.id) ?? 0;
    if (viewingId === source.id) setViewingId(null);
    removeSourceLater(
      source,
      `Deleted "${source.title}"`,
      // The foreign key sets the highlights' source to null rather than
      // deleting them — which is right, but should not come as a surprise.
      kept > 0
        ? `Its ${kept} highlight${kept === 1 ? " stays" : "s stay"} in your library, without a source.`
        : undefined,
    );
  };

  const changeStatus = async (
    source: LibrarySource,
    next: LibrarySource["status"],
  ) => {
    if (next === source.status) return;
    try {
      await saveSource(statusChange(source, next, localIsoDate())).unwrap();
    } catch (error) {
      toast.error("Couldn't change the status", {
        description: getErrorMessage(error),
      });
    }
  };

  /** One primary action, which asks what to add. */
  const addMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" aria-hidden /> Add
          <ChevronDown className="ml-1.5 size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={openNewSource}>
          <BookMarked className="mr-2 size-4" aria-hidden /> Source
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openNewHighlight()}>
          <Quote className="mr-2 size-4" aria-hidden /> Highlight
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const header = (
    <PageHeader
      title="Library"
      description="What you're reading, watching and listening to — and the lines worth keeping."
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="Search lines, titles, authors…"
      actions={addMenu}
    />
  );

  const loadError = sourcesError ?? highlightsError;
  if (loadError && !allSources.length && !allHighlights.length) {
    return (
      <ManagerWrapper>
        {header}
        <LoadError
          what="your library"
          error={loadError}
          onRetry={() => {
            void refetchSources();
            void refetchHighlights();
          }}
        />
      </ManagerWrapper>
    );
  }

  if (
    (loadingSources || loadingHighlights) &&
    !allSources.length &&
    !allHighlights.length
  ) {
    return (
      <ManagerWrapper>
        {header}
        <LoadingState label="Loading your library" />
      </ManagerWrapper>
    );
  }

  return (
    <ManagerWrapper>
      {header}

      <ModuleTabs
        label="Library"
        tabs={[
          { id: "reading", label: `Reading ${sources.length}` },
          { id: "highlights", label: `Highlights ${highlights.length}` },
        ]}
        current={tab}
        onSelect={setTab}
      />

      {/* One measure for both tabs: the highlights were capped at 3xl and
          the sources ran full width. */}
      <div className="max-w-3xl space-y-4">
        {tab === "reading" ? (
          <>
            {!search && (
              <NowReading
                sources={nowReading}
                keptPer={perSource}
                onOpen={(source) => setViewingId(source.id)}
              />
            )}

            <FilterBar label="Filter by status">
              <FilterChip
                active={statusFilter === "all"}
                count={statusCounts.all}
                onClick={() => setStatusFilter("all")}
              >
                All
              </FilterChip>
              {STATUS_ORDER.map((status) => (
                <FilterChip
                  key={status}
                  active={statusFilter === status}
                  count={statusCounts[status]}
                  onClick={() => setStatusFilter(status)}
                >
                  {STATUS_FILTER_LABELS[status]}
                </FilterChip>
              ))}
            </FilterBar>

            {shownSources.length === 0 ? (
              <EmptyState
                icon={BookMarked}
                variant="card"
                title={
                  sources.length === 0
                    ? "Your reading list is empty"
                    : "Nothing matches"
                }
                description={
                  sources.length === 0
                    ? "Books, articles, videos and podcasts — what you've finished and what's next. Videos and podcasts play right here."
                    : "Try a different search or status."
                }
                action={
                  sources.length === 0
                    ? {
                        label: "Add source",
                        onClick: openNewSource,
                        icon: Plus,
                      }
                    : undefined
                }
              />
            ) : (
              <ul className="list-none divide-y rounded-surface border bg-card p-0">
                {shownSources.map((source) => (
                  <SourceRow
                    key={source.id}
                    source={source}
                    kept={perSource.get(source.id) ?? 0}
                    onOpen={() => setViewingId(source.id)}
                    onEdit={() => setSourceSheet({ open: true, source })}
                    onDelete={() => removeSource(source)}
                    onStatus={(next) => void changeStatus(source, next)}
                  />
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <FilterBar label="Filter highlights">
              {HIGHLIGHT_FILTERS.map((f) => (
                <FilterChip
                  key={f.value}
                  active={highlightFilter === f.value}
                  count={highlightCounts[f.value]}
                  onClick={() => setHighlightFilter(f.value)}
                >
                  {f.label}
                </FilterChip>
              ))}
            </FilterBar>

            {shownHighlights.length === 0 ? (
              <EmptyState
                icon={Quote}
                variant="card"
                title={
                  highlights.length === 0
                    ? "No highlights yet"
                    : "Nothing matches"
                }
                description={
                  highlights.length === 0
                    ? "Keep the lines worth remembering — from a book, an essay, a talk. Put one on the site and it can turn up at random for visitors."
                    : "Try a different search or filter."
                }
                action={
                  highlights.length === 0
                    ? {
                        label: "Add highlight",
                        onClick: () => openNewHighlight(),
                        icon: Plus,
                      }
                    : undefined
                }
              />
            ) : (
              // One column: quotes vary wildly in length, and a single
              // measure reads better than a grid with a hole under every
              // short one.
              <ul className="list-none divide-y rounded-surface border bg-card p-0">
                {shownHighlights.map((highlight) => {
                  const source = highlight.source_id
                    ? sourcesById.get(highlight.source_id)
                    : undefined;
                  return (
                    <HighlightItem
                      key={highlight.id}
                      highlight={highlight}
                      source={source}
                      cite={citationLine(highlight, source)}
                      onOpenSource={() => source && setViewingId(source.id)}
                      onToggle={(field) => void toggle(highlight, field)}
                      onEdit={() =>
                        setHighlightSheet({
                          open: true,
                          highlight,
                          sourceId: null,
                        })
                      }
                      onDelete={() => removeHighlight(highlight)}
                    />
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

      <FormSheet
        open={viewing !== null}
        onOpenChange={(open) => !open && setViewingId(null)}
        title={viewing?.title ?? ""}
        description={viewing?.creator ?? undefined}
      >
        {viewing && (
          <SourceView
            key={viewing.id}
            source={viewing}
            highlights={highlights.filter((h) => h.source_id === viewing.id)}
            onAddHighlight={() => openNewHighlight(viewing.id)}
            onEdit={() => setSourceSheet({ open: true, source: viewing })}
          />
        )}
      </FormSheet>

      <FormSheet
        open={sourceSheet.open}
        onOpenChange={(open) => setSourceSheet((s) => ({ ...s, open }))}
        title={sourceSheet.source ? "Edit source" : "Add to your library"}
        description="A book, an article, a video or a podcast."
      >
        <SourceForm
          key={sourceSheet.source?.id ?? "new"}
          source={sourceSheet.source}
          onSuccess={() => setSourceSheet({ open: false, source: null })}
        />
      </FormSheet>

      <FormSheet
        open={highlightSheet.open}
        onOpenChange={(open) => setHighlightSheet((s) => ({ ...s, open }))}
        title={highlightSheet.highlight ? "Edit highlight" : "Keep a line"}
        description="The line, where it came from, and why it stayed with you."
      >
        <HighlightForm
          key={
            highlightSheet.highlight?.id ??
            `new-${highlightSheet.sourceId ?? "none"}`
          }
          highlight={highlightSheet.highlight}
          sources={sources}
          defaultSourceId={highlightSheet.sourceId}
          onSuccess={() =>
            setHighlightSheet({ open: false, highlight: null, sourceId: null })
          }
        />
      </FormSheet>
    </ManagerWrapper>
  );
}
