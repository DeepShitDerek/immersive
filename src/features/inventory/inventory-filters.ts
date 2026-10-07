import type { InventoryItem } from "@/types";
import { currentValue, itemCurrency, purchasePrice } from "./item-value";

/**
 * Filtering, sorting and totals for the inventory.
 *
 * The module's headline used to be four money figures. Money is what an
 * inventory is *worth*, not what it asks you to do — the one thing here that is
 * ever actionable is a warranty about to lapse, because it expires whether or
 * not anyone looks. That is what these helpers make cheap to surface.
 */

export type InventorySortBy = "recent" | "value" | "name" | "warranty";
export type WarrantyFilter = "all" | "active" | "expiring" | "expired" | "none";

export interface InventoryFilters {
  search: string;
  category: string | "all";
  location: string | "all";
  warranty: WarrantyFilter;
  /** Archived items are out of the way by default, never deleted. */
  showArchived: boolean;
}

export const DEFAULT_INVENTORY_FILTERS: InventoryFilters = {
  search: "",
  category: "all",
  location: "all",
  warranty: "all",
  showArchived: false,
};

/** Local calendar day as `YYYY-MM-DD`, for comparing against DATE columns. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Days until a warranty lapses. Negative once it has. */
export function daysUntilExpiry(
  item: Pick<InventoryItem, "warranty_expiry">,
  today = todayIso(),
): number | null {
  if (!item.warranty_expiry) return null;
  const [ey, em, ed] = item.warranty_expiry.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  if (!ey || !ty) return null;
  // Compared as whole days in UTC. A DATE column has no time or zone, and
  // building a local Date from it lands an hour either side of midnight.
  return Math.round(
    (Date.UTC(ey, em - 1, ed) - Date.UTC(ty, tm - 1, td)) / 86400000,
  );
}

/** How soon counts as "expiring". Matches the warning band in `warranty.ts`. */
const EXPIRING_WINDOW_DAYS = 30;

export function warrantyBucket(
  item: Pick<InventoryItem, "warranty_expiry">,
  today = todayIso(),
): Exclude<WarrantyFilter, "all"> {
  const days = daysUntilExpiry(item, today);
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days <= EXPIRING_WINDOW_DAYS) return "expiring";
  return "active";
}

/**
 * What the owner should act on.
 *
 * Expiring only — an expired warranty is a fact, not a task, and listing both
 * together turns a short actionable list into a long historical one that gets
 * ignored. Soonest first.
 */
export function needsAttention(
  items: InventoryItem[],
  today = todayIso(),
): InventoryItem[] {
  return items
    .filter(
      (item) => !item.archived_at && warrantyBucket(item, today) === "expiring",
    )
    .sort(
      (a, b) =>
        (daysUntilExpiry(a, today) ?? 0) - (daysUntilExpiry(b, today) ?? 0),
    );
}

export function filterItems(
  items: InventoryItem[],
  filters: InventoryFilters,
  today = todayIso(),
): InventoryItem[] {
  const term = filters.search.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.showArchived !== !!item.archived_at) return false;
    if (filters.category !== "all" && item.category !== filters.category)
      return false;
    if (filters.location !== "all" && item.location !== filters.location)
      return false;
    if (
      filters.warranty !== "all" &&
      warrantyBucket(item, today) !== filters.warranty
    )
      return false;

    if (!term) return true;
    return [
      item.name,
      item.serial_number,
      item.notes,
      item.location,
      item.category,
      ...(item.tags ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(term);
  });
}

export function sortItems(
  items: InventoryItem[],
  sortBy: InventorySortBy,
  today = todayIso(),
): InventoryItem[] {
  const sorted = [...items];

  switch (sortBy) {
    case "value":
      return sorted.sort((a, b) => lineValue(b) - lineValue(a));
    case "name":
      return sorted.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
    case "warranty":
      // Soonest to lapse first; anything without a warranty sorts last rather
      // than pretending to expire today.
      return sorted.sort((a, b) => {
        const da = daysUntilExpiry(a, today);
        const db = daysUntilExpiry(b, today);
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
    case "recent":
    default:
      return sorted.sort((a, b) =>
        (b.purchase_date ?? "").localeCompare(a.purchase_date ?? ""),
      );
  }
}

/**
 * Value of a row, counting how many there are.
 *
 * Quantity exists because six of the same cable was six rows each holding a
 * sixth of the truth; the totals have to honour it or the number is wrong in
 * the other direction.
 */
function lineValue(item: InventoryItem): number {
  return currentValue(item) * Math.max(1, item.quantity ?? 1);
}

function linePaid(item: InventoryItem): number {
  return purchasePrice(item) * Math.max(1, item.quantity ?? 1);
}

interface CurrencyTotals {
  currency: string;
  paid: number;
  worth: number;
  /** Never negative: an item that gained value is not negative depreciation. */
  depreciation: number;
}

export interface InventoryTotals {
  /** Distinct rows. */
  items: number;
  /** Physical things, counting quantity. */
  units: number;
  /**
   * Money per currency, base currency first, then by worth. Rupees
   * and dollars used to be added together as though they were one currency.
   * They are kept apart rather than converted: an inventory's worth is a
   * rough figure, and a conversion at today's rate would be a precise-looking
   * wrong one for things bought years ago.
   */
  byCurrency: CurrencyTotals[];
}

export function totals(
  items: InventoryItem[],
  baseCurrency: string,
): InventoryTotals {
  const groups = new Map<string, CurrencyTotals>();
  for (const item of items) {
    const currency = itemCurrency(item, baseCurrency);
    const group = groups.get(currency) ?? {
      currency,
      paid: 0,
      worth: 0,
      depreciation: 0,
    };
    group.paid += linePaid(item);
    group.worth += lineValue(item);
    groups.set(currency, group);
  }
  const byCurrency = [...groups.values()]
    .map((g) => ({ ...g, depreciation: Math.max(0, g.paid - g.worth) }))
    .sort((a, b) =>
      a.currency === baseCurrency
        ? -1
        : b.currency === baseCurrency
          ? 1
          : b.worth - a.worth,
    );
  return {
    items: items.length,
    units: items.reduce(
      (sum, item) => sum + Math.max(1, item.quantity ?? 1),
      0,
    ),
    byCurrency,
  };
}

/** Distinct non-empty values of a field, for the filter lists. */
export function distinctValues(
  items: InventoryItem[],
  field: "category" | "location",
): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    const value = item[field]?.trim();
    if (value) seen.add(value);
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}
