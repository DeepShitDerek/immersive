import type { InventoryItem } from "@/types";
import { formatMoney } from "@/lib/money";

/**
 * Money helpers for inventory rows.
 *
 * `purchase_price` and `current_value` are both nullable columns, and the
 * grid, the table, and the page totals each used to reach for them directly —
 * so a row missing a price crashed on `.toLocaleString()`, and a row worth
 * exactly 0 fell through `||` and displayed its original price instead.
 * Centralising the fallbacks keeps those two rules in one place.
 */

/** What the item cost, or 0 when it was never recorded. */
export function purchasePrice(item: InventoryItem): number {
  return item.purchase_price ?? 0;
}

/**
 * What the item is worth now: the appraised value when there is one, otherwise
 * the purchase price. `??` matters — an item appraised at 0 is worth 0, not
 * whatever it originally cost.
 */
export function currentValue(item: InventoryItem): number {
  return item.current_value ?? purchasePrice(item);
}

/** The item's currency, the base currency when none was recorded. */
export function itemCurrency(
  item: Pick<InventoryItem, "currency">,
  base: string,
): string {
  return item.currency || base;
}

/** Formatted in its currency; it used to be bare digits. */
export function formatValue(value: number, currency: string): string {
  return formatMoney({ amount: value, currency });
}
