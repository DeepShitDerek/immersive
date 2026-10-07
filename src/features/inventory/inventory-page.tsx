"use client";

import { useRememberedChoice } from "@/hooks/use-remembered-choice";
import { useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Box,
  LayoutGrid,
  Plus,
  ShieldAlert,
  Table2,
} from "lucide-react";
import { toast } from "sonner";
import type { InventoryItem } from "@/types";
import {
  useArchiveInventoryItemMutation,
  useDeleteInventoryItemMutation,
  useGetInventoryQuery,
} from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useUndoableDelete } from "@/hooks/use-undoable-delete";
import {
  EmptyState,
  FormSheet,
  LoadingState,
  ManagerWrapper,
  PageHeader,
  LoadError,
} from "@/components/admin/shared";
import { getErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/cn";
import { InventoryForm } from "./inventory-form";
import { InventoryTable } from "./inventory-table";
import { InventoryGrid } from "./inventory-grid";
import { InventoryToolbar } from "./inventory-toolbar";
import { formatValue } from "./item-value";
import type { ArchiveReason } from "./item-actions";
import { useGetMoneySettingsQuery } from "@/features/money/data/money-api";
import {
  DEFAULT_INVENTORY_FILTERS,
  daysUntilExpiry,
  distinctValues,
  filterItems,
  needsAttention,
  sortItems,
  todayIso,
  totals,
  type InventoryFilters,
  type InventorySortBy,
} from "./inventory-filters";

/**
 * One figure in the summary strip. A term and its value, not a card: the
 * strip is static, and static content sits on a ground, not a shadow.
 */
function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
      {hint && (
        <dd className="mt-0.5 text-micro text-muted-foreground">{hint}</dd>
      )}
    </div>
  );
}

export default function InventoryPage() {
  const today = todayIso();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [filters, setFilters] = useState<InventoryFilters>(
    DEFAULT_INVENTORY_FILTERS,
  );
  const [sortBy, setSortBy] = useState<InventorySortBy>("recent");
  const [viewMode, setViewMode] = useRememberedChoice<"grid" | "table">(
    "inventory",
    "grid",
    ["grid", "table"],
  );

  const {
    data: items = [],
    isLoading,
    error: loadError,
    refetch,
  } = useGetInventoryQuery();
  // An item with no currency of its own is in the base currency.
  const { data: moneySettings } = useGetMoneySettingsQuery();
  const baseCurrency = moneySettings?.baseCurrency ?? "CAD";
  const [archiveItem] = useArchiveInventoryItemMutation();
  const [deleteItem] = useDeleteInventoryItemMutation();

  // Delete offers Undo instead of asking first.
  const { pending: deleting, remove: removeItem } =
    useUndoableDelete<InventoryItem>(async (item) => {
      try {
        await deleteItem(item.id).unwrap();
      } catch (err) {
        toast.error("Couldn't delete the item", {
          description: getErrorMessage(err),
        });
      }
    });
  const kept = useMemo(
    () => items.filter((i) => !deleting.has(i.id)),
    [items, deleting],
  );
  const live = useMemo(() => kept.filter((i) => !i.archived_at), [kept]);
  const archivedCount = kept.length - live.length;

  const attention = useMemo(() => needsAttention(kept, today), [kept, today]);

  const visible = useMemo(
    () => sortItems(filterItems(kept, filters, today), sortBy, today),
    [kept, filters, sortBy, today],
  );

  const summary = useMemo(
    () => totals(live, baseCurrency),
    [live, baseCurrency],
  );
  // The base currency (or the largest) leads; the rest are listed under it.
  const [lead, ...others] = summary.byCurrency;
  const moneyStat = (
    pick: (t: (typeof summary.byCurrency)[number]) => number,
  ) => ({
    value: lead ? formatValue(pick(lead), lead.currency) : "—",
    hint: others.length
      ? `+ ${others.map((t) => formatValue(pick(t), t.currency)).join(" · ")}`
      : undefined,
  });
  const categories = useMemo(() => distinctValues(live, "category"), [live]);
  const locations = useMemo(() => distinctValues(live, "location"), [live]);

  const hasActiveFilters =
    !!filters.search ||
    filters.category !== "all" ||
    filters.location !== "all" ||
    filters.warranty !== "all";

  const openCreate = () => {
    setEditingItem(null);
    setIsSheetOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setIsSheetOpen(true);
  };

  const handleArchive = async (item: InventoryItem, reason?: ArchiveReason) => {
    const archived = !!item.archived_at;
    try {
      await archiveItem({ id: item.id, archived: !archived, reason }).unwrap();
      toast.success(archived ? "Item restored." : "Item archived.");
    } catch (err) {
      toast.error("Couldn't update the item", {
        description: getErrorMessage(err),
      });
    }
  };

  const handleDelete = (item: InventoryItem) =>
    removeItem(
      item,
      `Deleted "${item.name}"`,
      "Archiving keeps the record of what it cost instead.",
    );

  if (loadError && items.length === 0) {
    return (
      <ManagerWrapper>
        <LoadError what="your inventory" error={loadError} onRetry={refetch} />
      </ManagerWrapper>
    );
  }

  if (isLoading && items.length === 0) {
    return (
      <ManagerWrapper>
        <LoadingState label="Loading inventory" />
      </ManagerWrapper>
    );
  }

  return (
    <ManagerWrapper>
      <PageHeader
        title="Inventory"
        description="What you own, what it's worth, and what's about to lose cover."
        actions={
          // One primary (G7). The archive opens from the foot of the list,
          // as Habits' does.
          <Button onClick={openCreate}>
            <Plus className="mr-2 size-4" aria-hidden /> Add item
          </Button>
        }
      />

      {/*
        The one thing here that is ever actionable. A warranty lapses whether or
        not anyone looks, and money — which is what this page used to lead with
        — is a fact rather than a task.
      */}
      {!filters.showArchived && attention.length > 0 && (
        <button
          type="button"
          onClick={() =>
            setFilters((f) => ({
              ...DEFAULT_INVENTORY_FILTERS,
              showArchived: false,
              warranty: "expiring",
              search: f.search,
            }))
          }
          className="mb-5 flex w-full items-center gap-3 rounded-surface border border-warning/40 bg-warning/10 p-4 text-left transition-colors hover:bg-warning/15 focus-ring"
        >
          <ShieldAlert className="size-5 shrink-0 text-warning" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">
              {attention.length} warrant
              {attention.length === 1 ? "y" : "ies"} expiring within a month
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {attention
                .slice(0, 3)
                .map((item) => {
                  const days = daysUntilExpiry(item, today) ?? 0;
                  return `${item.name} — ${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"}`}`;
                })
                .join(" · ")}
              {attention.length > 3 && ` · +${attention.length - 3} more`}
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-primary">
            Review
          </span>
        </button>
      )}

      {!filters.showArchived && live.length > 0 && (
        <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-surface border bg-card p-4 lg:grid-cols-4">
          <Stat
            label="Items"
            value={`${summary.items}`}
            hint={
              summary.units !== summary.items
                ? `${summary.units} units`
                : undefined
            }
          />
          <Stat label="Worth now" {...moneyStat((t) => t.worth)} />
          <Stat label="Paid" {...moneyStat((t) => t.paid)} />
          <Stat
            label="Lost to depreciation"
            {...moneyStat((t) => t.depreciation)}
          />
        </dl>
      )}

      {filters.showArchived && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setFilters((f) => ({ ...f, showArchived: false }))}
            className="mb-2 inline-flex items-center gap-1.5 rounded-control text-sm text-muted-foreground hover:text-foreground focus-ring"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Inventory
          </button>
          <h2 className="t-heading">Archived</h2>
        </div>
      )}

      <InventoryToolbar
        filters={filters}
        onFiltersChange={setFilters}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        categories={categories}
        locations={locations}
      >
        {/* Both views at every width. The table used to be replaced by the grid
            below a breakpoint, so the columns simply vanished on a phone. */}
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => v && setViewMode(v as "grid" | "table")}
          size="sm"
        >
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <LayoutGrid className="size-4" aria-hidden />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view">
            <Table2 className="size-4" aria-hidden />
          </ToggleGroupItem>
        </ToggleGroup>
      </InventoryToolbar>

      {visible.length === 0 ? (
        <EmptyState
          icon={filters.showArchived ? Archive : Box}
          variant="card"
          title={
            filters.showArchived
              ? "Nothing archived"
              : hasActiveFilters
                ? "No items match"
                : "Nothing recorded yet"
          }
          description={
            filters.showArchived
              ? "Sold, gifted and discarded items keep their record here."
              : hasActiveFilters
                ? "Try a different search, or clear the filters."
                : "Add the things worth knowing you own — what they cost, where they are, and when the warranty runs out."
          }
          action={
            hasActiveFilters
              ? {
                  label: "Clear filters",
                  onClick: () =>
                    setFilters((f) => ({
                      ...DEFAULT_INVENTORY_FILTERS,
                      showArchived: f.showArchived,
                    })),
                }
              : filters.showArchived
                ? undefined
                : { label: "Add item", onClick: openCreate, icon: Plus }
          }
        />
      ) : (
        <div className={cn(filters.showArchived && "opacity-90")}>
          {viewMode === "grid" ? (
            <InventoryGrid
              items={visible}
              today={today}
              onEdit={openEdit}
              onArchive={handleArchive}
              baseCurrency={baseCurrency}
              onDelete={handleDelete}
            />
          ) : (
            <InventoryTable
              items={visible}
              today={today}
              onEdit={openEdit}
              onArchive={handleArchive}
              baseCurrency={baseCurrency}
              onDelete={handleDelete}
            />
          )}
        </div>
      )}

      {!filters.showArchived && archivedCount > 0 && (
        <button
          type="button"
          onClick={() => setFilters((f) => ({ ...f, showArchived: true }))}
          className="mt-4 inline-flex items-center gap-1.5 rounded-control text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-ring"
        >
          <Archive aria-hidden className="size-4" />
          Show archived ({archivedCount})
        </button>
      )}

      <FormSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        title={editingItem ? "Edit item" : "Add item"}
        description="What it is, where it lives, and what it cost."
      >
        <InventoryForm
          key={editingItem?.id ?? "new"}
          item={editingItem}
          onSuccess={() => setIsSheetOpen(false)}
        />
      </FormSheet>
    </ManagerWrapper>
  );
}
