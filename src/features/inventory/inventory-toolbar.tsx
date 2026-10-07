"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";
import type {
  InventoryFilters,
  InventorySortBy,
  WarrantyFilter,
} from "./inventory-filters";
import { RemovableChip } from "@/components/ui/filter-chip";

const SORT_OPTIONS: { value: InventorySortBy; label: string }[] = [
  { value: "recent", label: "Newest" },
  { value: "value", label: "Value" },
  { value: "name", label: "Name" },
  { value: "warranty", label: "Warranty" },
];

const WARRANTY_OPTIONS: { value: WarrantyFilter; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "expiring", label: "Expiring soon" },
  { value: "active", label: "Covered" },
  { value: "expired", label: "Expired" },
  { value: "none", label: "No warranty" },
];

export interface InventoryToolbarProps {
  filters: InventoryFilters;
  onFiltersChange: (
    update: (current: InventoryFilters) => InventoryFilters,
  ) => void;
  sortBy: InventorySortBy;
  onSortByChange: (sortBy: InventorySortBy) => void;
  categories: string[];
  locations: string[];
}

/** A labelled select that treats "all" as the unset state. */
function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Search left; sort and a Filters popover right — the same shape as Tasks and
 * Notes, so the three modules are operated the same way.
 *
 * Sorting used to be a dropdown menu whose selected item was marked by
 * concatenating a tick into the label, which is a select wearing a disguise.
 */
export function InventoryToolbar({
  filters,
  onFiltersChange,
  sortBy,
  onSortByChange,
  categories,
  locations,
  children,
}: InventoryToolbarProps & { children?: React.ReactNode }) {
  const chips = [
    filters.warranty !== "all" && {
      key: "warranty",
      label:
        WARRANTY_OPTIONS.find((o) => o.value === filters.warranty)?.label ??
        "Warranty",
      clear: () => onFiltersChange((f) => ({ ...f, warranty: "all" })),
    },
    filters.category !== "all" && {
      key: "category",
      label: filters.category,
      clear: () => onFiltersChange((f) => ({ ...f, category: "all" })),
    },
    filters.location !== "all" && {
      key: "location",
      label: filters.location,
      clear: () => onFiltersChange((f) => ({ ...f, location: "all" })),
    },
  ].filter((chip): chip is { key: string; label: string; clear: () => void } =>
    Boolean(chip),
  );

  const activeCount =
    (filters.category !== "all" ? 1 : 0) +
    (filters.location !== "all" ? 1 : 0) +
    (filters.warranty !== "all" ? 1 : 0);

  return (
    <div className="mb-5 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={filters.search}
          onChange={(e) =>
            onFiltersChange((f) => ({ ...f, search: e.target.value }))
          }
          placeholder="Search name, serial, location…"
          aria-label="Search inventory"
          className="w-full sm:max-w-[20rem]"
        />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            value={sortBy}
            onValueChange={(v) => onSortByChange(v as InventorySortBy)}
          >
            <SelectTrigger className="h-9 w-[9.5rem]" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  Sort: {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={activeCount > 0 ? "secondary" : "outline"}
                size="sm"
                className="h-9"
              >
                <SlidersHorizontal className="mr-2 size-4" aria-hidden />
                Filters
                {activeCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground">
                    {activeCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="inv-warranty"
                  className="text-xs text-muted-foreground"
                >
                  Warranty
                </Label>
                <Select
                  value={filters.warranty}
                  onValueChange={(v) =>
                    onFiltersChange((f) => ({
                      ...f,
                      warranty: v as WarrantyFilter,
                    }))
                  }
                >
                  <SelectTrigger id="inv-warranty" className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WARRANTY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Only offered once there is something to choose between. */}
              {categories.length > 0 && (
                <FilterSelect
                  id="inv-category"
                  label="Category"
                  allLabel="Any category"
                  value={filters.category}
                  onChange={(v) =>
                    onFiltersChange((f) => ({ ...f, category: v }))
                  }
                  options={categories}
                />
              )}

              {locations.length > 0 && (
                <FilterSelect
                  id="inv-location"
                  label="Location"
                  allLabel="Anywhere"
                  value={filters.location}
                  onChange={(v) =>
                    onFiltersChange((f) => ({ ...f, location: v }))
                  }
                  options={locations}
                />
              )}

              {activeCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("w-full")}
                  onClick={() =>
                    onFiltersChange((f) => ({
                      ...f,
                      category: "all",
                      location: "all",
                      warranty: "all",
                    }))
                  }
                >
                  Clear filters
                </Button>
              )}
            </PopoverContent>
          </Popover>
          {children}
        </div>
      </div>
      {/* What is set stays visible once the popover shuts. */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <RemovableChip
              key={chip.key}
              label={chip.label}
              onRemove={chip.clear}
            />
          ))}
        </div>
      )}
    </div>
  );
}
