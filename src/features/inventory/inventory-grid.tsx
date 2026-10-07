"use client";

import { Box, MapPin } from "lucide-react";
import type { InventoryItem } from "@/types";
import { cn } from "@/lib/cn";
import { currentValue, formatValue, itemCurrency } from "./item-value";
import type { ArchiveReason } from "./item-actions";
import { ItemActions } from "./item-actions";
import { WarrantyBadge } from "./warranty-badge";

interface InventoryGridProps {
  items: InventoryItem[];
  today: string;
  onEdit: (item: InventoryItem) => void;
  onArchive: (item: InventoryItem, reason?: ArchiveReason) => void;
  /** Money base currency: what an item with no currency of its own is in. */
  baseCurrency: string;
  onDelete: (item: InventoryItem) => void;
}

/**
 * A possession is recognised by sight before it is recognised by name, so the
 * photo leads and everything else is a caption. A fixed 4:3 frame keeps the
 * grid even whatever shape the photo is.
 */
export function InventoryGrid({
  items,
  today,
  baseCurrency,
  onEdit,
  onArchive,
  onDelete,
}: InventoryGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => {
        const quantity = item.quantity ?? 1;

        return (
          <article
            key={item.id}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-surface bg-card shadow-e1 transition-shadow duration-base ease-enter hover:shadow-e2 focus-within:shadow-e2",
              item.archived_at && "opacity-70",
            )}
          >
            <div className="m-2 mb-0 aspect-[4/3] overflow-hidden rounded-[5px] bg-background">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image_url}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <Box
                    className="size-8 text-muted-foreground/30"
                    aria-hidden
                  />
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-1.5 px-3 pb-3 pt-2.5">
              <div className="flex items-baseline gap-2">
                <h3 className="min-w-0 flex-1 truncate text-sm font-medium">
                  {item.name}
                </h3>
                {quantity > 1 && (
                  <span className="shrink-0 rounded-full bg-secondary px-1.5 text-micro tabular-nums text-muted-foreground">
                    ×{quantity}
                  </span>
                )}
              </div>

              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-micro text-muted-foreground">
                {item.location ? (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin aria-hidden className="size-3 shrink-0" />
                    <span className="truncate">{item.location}</span>
                  </span>
                ) : (
                  <span className="italic">No location</span>
                )}
                {item.category && <span>· {item.category}</span>}
              </p>

              <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
                <span className="text-sm font-medium tabular-nums">
                  {formatValue(
                    currentValue(item) * quantity,
                    itemCurrency(item, baseCurrency),
                  )}
                </span>

                {/*
                  Days remaining, not just a status word. "Expiring soon" is the
                  same label whether there are 29 days left or one, and the
                  difference is the whole point of showing it.
                */}
                <WarrantyBadge item={item} today={today} />
              </div>
            </div>

            <div className="absolute right-2 top-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <ItemActions
                onEdit={() => onEdit(item)}
                onArchive={(reason) => onArchive(item, reason)}
                onDelete={() => onDelete(item)}
                isArchived={!!item.archived_at}
                triggerClassName="bg-background/85 backdrop-blur-sm rounded-full size-7"
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
