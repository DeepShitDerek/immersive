import type { InventoryItem } from "@/types";
import { cn } from "@/lib/cn";
import { daysUntilExpiry, warrantyBucket } from "./inventory-filters";
import { getWarrantyStatus } from "./warranty";

/**
 * An item's warranty, the same in the grid and the table: icon, words and colour together. Expiring soon counts the days
 * left, because "expiring soon" reads the same at 29 days and at one.
 */
export function WarrantyBadge({
  item,
  today,
}: {
  item: InventoryItem;
  today: string;
}) {
  const status = getWarrantyStatus(item.warranty_expiry);
  const days = daysUntilExpiry(item, today);
  const label =
    warrantyBucket(item, today) === "expiring" && days !== null
      ? days === 0
        ? "Ends today"
        : `${days} day${days === 1 ? "" : "s"} left`
      : status.label;
  return (
    <span
      className={cn(
        "inline-flex min-h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-micro font-medium",
        status.bg,
        status.color,
      )}
    >
      <status.icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}
