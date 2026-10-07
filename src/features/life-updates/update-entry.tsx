"use client";

import { Eye, EyeOff, Pencil, Pin, Trash2 } from "lucide-react";
import type { LifeUpdate } from "@/types";
import { Button } from "@/components/ui/button";
import { safeImageUrl } from "@/lib/safe-url";
import { cn } from "@/lib/cn";
import {
  categoryOption,
  fullDate,
  relativeDate,
  updateHeadline,
} from "@/lib/life-update";
import { CategoryIcon } from "@/features/updates/category-icon";

export interface UpdateEntryProps {
  update: LifeUpdate;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onTogglePublish: () => void;
}

/**
 * One update in the admin stream.
 *
 * A published update sits on a bordered surface; a draft has a dashed border
 * on a tinted fill and says "Draft" — not yet out, and visibly so, without
 * dimming the text the owner is about to edit.
 *
 * The actions are always on screen. They used to live in a menu that appeared
 * on hover, which on a phone meant they did not appear at all.
 */
export function UpdateEntry({
  update,
  onEdit,
  onDelete,
  onTogglePin,
  onTogglePublish,
}: UpdateEntryProps) {
  const option = categoryOption(update.category);
  const headline = updateHeadline(update);
  const image = safeImageUrl(update.image_url);
  const draft = !update.is_published;
  const shownDate = update.created_at ?? update.updated_at;

  return (
    <article
      aria-label={headline.text}
      className={cn(
        "rounded-surface p-3 transition-shadow duration-base ease-enter sm:p-4",
        draft ? "border border-dashed bg-secondary/30" : "border bg-card",
      )}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${headline.text}`}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-control text-left transition-colors hover:bg-secondary/40 focus-ring sm:gap-4"
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              loading="lazy"
              className="size-14 shrink-0 rounded-control bg-secondary object-cover sm:size-16"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-14 shrink-0 items-center justify-center rounded-control bg-background/60 text-muted-foreground sm:size-16"
            >
              <CategoryIcon category={option.value} className="size-6" />
            </span>
          )}

          <span className="block min-w-0 flex-1 py-0.5">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{option.label}</span>
              {shownDate && (
                <time dateTime={shownDate} title={fullDate(shownDate)}>
                  {relativeDate(shownDate)}
                </time>
              )}
              {draft && (
                <span className="rounded-full bg-background px-2 py-px font-medium text-foreground">
                  Draft
                </span>
              )}
              {update.is_pinned && (
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  <Pin className="size-3" aria-hidden />
                  Pinned
                </span>
              )}
            </span>
            <span
              className={cn(
                "mt-1 block truncate text-sm",
                headline.fromTitle
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {headline.text}
            </span>
            {update.content && headline.fromTitle && (
              <span className="mt-0.5 line-clamp-2 block break-words text-sm text-muted-foreground">
                {update.content}
              </span>
            )}
            {update.tags && update.tags.length > 0 && (
              <span className="mt-1.5 block truncate text-xs text-muted-foreground">
                {update.tags.map((tag) => `#${tag}`).join("  ")}
              </span>
            )}
          </span>
        </button>

        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
          <Button
            type="button"
            size="sm"
            variant={draft ? "default" : "ghost"}
            onClick={onTogglePublish}
            className="h-8"
          >
            {draft ? (
              <Eye className="mr-1.5 size-3.5" aria-hidden />
            ) : (
              <EyeOff className="mr-1.5 size-3.5" aria-hidden />
            )}
            {draft ? "Publish" : "Unpublish"}
          </Button>
          <div className="flex items-center">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={update.is_pinned ? "Unpin" : "Pin"}
              aria-pressed={!!update.is_pinned}
              title={update.is_pinned ? "Unpin" : "Pin"}
              onClick={onTogglePin}
              className={cn("size-8", update.is_pinned && "text-primary")}
            >
              <Pin className="size-3.5" aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Edit"
              title="Edit"
              onClick={onEdit}
              className="size-8"
            >
              <Pencil className="size-3.5" aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Delete"
              title="Delete"
              onClick={onDelete}
              className="size-8 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
