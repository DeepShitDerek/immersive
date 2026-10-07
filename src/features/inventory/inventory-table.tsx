"use client";

import type { InventoryItem } from "@/types";
import { cn } from "@/lib/cn";
import { currentValue, formatValue, itemCurrency } from "./item-value";
import type { ArchiveReason } from "./item-actions";
import { ItemActions } from "./item-actions";
import { WarrantyBadge } from "./warranty-badge";

interface InventoryTableProps {
  items: InventoryItem[];
  today: string;
  onEdit: (item: InventoryItem) => void;
  onArchive: (item: InventoryItem, reason?: ArchiveReason) => void;
  /** Money base currency: what an item with no currency of its own is in. */
  baseCurrency: string;
  onDelete: (item: InventoryItem) => void;
}

/**
 * The comparison view: same items, arranged so columns line up.
 *
 * It scrolls horizontally inside its own container rather than dropping
 * columns at a breakpoint. The table used to be swapped for the grid below
 * `md`, which meant serial numbers and warranty dates simply did not exist on
 * a phone — the two things you most often look up while standing next to the
 * object.
 */
export function InventoryTable({
  items,
  today,
  baseCurrency,
  onEdit,
  onArchive,
  onDelete,
}: InventoryTableProps) {
  return (
    <div className="overflow-x-auto rounded-surface bg-card shadow-e1">
      <table className="w-full min-w-[52rem] border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="px-3 py-2 font-medium">
              Item
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Location
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Serial
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Qty
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Value
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Warranty
            </th>
            <th scope="col" className="w-10 px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const quantity = item.quantity ?? 1;

            return (
              <tr
                key={item.id}
                className={cn(
                  "border-b last:border-0 hover:bg-secondary/40",
                  item.archived_at && "opacity-70",
                )}
              >
                <td className="max-w-[18rem] px-3 py-2">
                  <span className="block truncate font-medium">
                    {item.name}
                  </span>
                  {item.category && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.category}
                    </span>
                  )}
                </td>
                <td className="max-w-[10rem] truncate px-3 py-2 text-muted-foreground">
                  {item.location || "—"}
                </td>
                {/* Mono earns its place here: a serial number is a string you
                    read character by character, and a proportional face makes
                    1, l and I the same shape. */}
                <td className="max-w-[10rem] truncate px-3 py-2 font-mono text-xs text-muted-foreground">
                  {item.serial_number || "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {quantity}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">
                  {formatValue(
                    currentValue(item) * quantity,
                    itemCurrency(item, baseCurrency),
                  )}
                </td>
                <td className="px-3 py-2">
                  <WarrantyBadge item={item} today={today} />
                </td>
                <td className="px-3 py-2 text-right">
                  <ItemActions
                    onEdit={() => onEdit(item)}
                    onArchive={(reason) => onArchive(item, reason)}
                    onDelete={() => onDelete(item)}
                    isArchived={!!item.archived_at}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
