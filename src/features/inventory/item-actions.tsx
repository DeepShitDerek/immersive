"use client";

import {
  Archive,
  ArchiveRestore,
  Edit2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** `inventory_items.archived_reason`'s CHECK list. */
const ARCHIVE_REASONS = [
  "sold",
  "gifted",
  "lost",
  "discarded",
  "returned",
] as const;
export type ArchiveReason = (typeof ARCHIVE_REASONS)[number];
const REASON_LABELS: Record<ArchiveReason, string> = {
  sold: "Sold",
  gifted: "Gifted",
  lost: "Lost",
  discarded: "Discarded",
  returned: "Returned",
};
import { cn } from "@/lib/utils";

interface ItemActionsProps {
  onEdit: () => void;
  /** Archive (with why, when known) or restore. */
  onArchive: (reason?: ArchiveReason) => void;
  onDelete: () => void;
  /** True when the item is already archived, so the action offers the way back. */
  isArchived?: boolean;
  triggerClassName?: string;
}

export function ItemActions({
  onEdit,
  onArchive,
  onDelete,
  isArchived,
  triggerClassName,
}: ItemActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Item actions"
          className={cn("h-8 w-8", triggerClassName)}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Edit2 className="mr-2 size-4" /> Edit
        </DropdownMenuItem>
        {/* Archive first: it is the right answer for anything sold or
            discarded, and it keeps what the thing cost. */}
        {isArchived ? (
          <DropdownMenuItem onClick={() => onArchive()}>
            <ArchiveRestore className="mr-2 size-4" /> Restore
          </DropdownMenuItem>
        ) : (
          // Why it went is recorded: the column existed, and
          // nothing ever wrote it.
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Archive className="mr-2 size-4" /> Archive
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {ARCHIVE_REASONS.map((reason) => (
                <DropdownMenuItem
                  key={reason}
                  onClick={() => onArchive(reason)}
                >
                  {REASON_LABELS[reason]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => onArchive()}>
                No reason
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuItem className="text-destructive" onClick={onDelete}>
          <Trash2 className="mr-2 size-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
