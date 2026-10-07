"use client";

import { Pin } from "lucide-react";
import type { LifeUpdate } from "@/types";
import { Markdown } from "@/components/ui/markdown";
import { safeImageUrl } from "@/lib/safe-url";
import { cn } from "@/lib/cn";
import {
  categoryOption,
  fullDate,
  relativeDate,
  shortDate,
} from "@/lib/life-update";
import { useHydrated } from "@/hooks/use-hydrated";
import { CategoryIcon } from "./category-icon";

/**
 * One update as a visitor reads it.
 *
 * The scrapbook's tilt, washi tape and handwriting face are gone. They made
 * every update look like the same keepsake — a milestone and a passing thought
 * got identical treatment — and the script face was unreadable at the sizes a
 * date and a tag need. Here a card is a plain surface: what kind of update it
 * is, when, what it says, and a photo when there is one, full-bleed at the top
 * so a photo update reads as a photo.
 *
 * `feature` is the pinned treatment: larger type, image beside the text on a
 * wide screen.
 */
export function UpdateCard({
  update,
  variant = "entry",
  showDate = true,
  onTag,
  activeTag,
}: {
  update: LifeUpdate;
  variant?: "entry" | "feature";
  /** Off in the journal, where the date already sits in the margin. */
  showDate?: boolean;
  onTag?: (tag: string) => void;
  activeTag?: string | null;
}) {
  const option = categoryOption(update.category);
  // "3d ago" depends on the clock: a stable UTC date until hydrated.
  const hydrated = useHydrated();
  const timeZone = hydrated ? undefined : "UTC";
  // Owner-entered, rendered publicly: through the image allowlist.
  const image = safeImageUrl(update.image_url);
  const feature = variant === "feature";

  return (
    <article
      className={cn(
        "overflow-hidden rounded-surface bg-card",
        feature ? "shadow-e2" : "shadow-e1",
        feature && image && "md:grid md:grid-cols-2",
      )}
    >
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={update.title ?? ""}
          loading="lazy"
          className={cn(
            "w-full bg-secondary object-cover",
            feature ? "max-h-96 md:h-full md:max-h-none" : "max-h-[28rem]",
          )}
        />
      )}

      <div className={cn("min-w-0", feature ? "p-6 sm:p-8" : "p-5")}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 font-medium text-secondary-foreground">
            <CategoryIcon category={option.value} />
            {option.label}
          </span>
          {showDate && update.created_at && (
            <time
              dateTime={update.created_at}
              title={fullDate(update.created_at, timeZone)}
            >
              {hydrated
                ? relativeDate(update.created_at)
                : shortDate(update.created_at, timeZone)}
            </time>
          )}
          {update.is_pinned && (
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Pin className="size-3 text-primary" aria-hidden />
              Pinned
            </span>
          )}
        </div>

        {update.title && (
          <h3
            className={cn(
              "mt-3 text-balance [overflow-wrap:anywhere]",
              feature
                ? "t-heading"
                : "text-lg font-semibold leading-snug text-foreground",
            )}
          >
            {update.title}
          </h3>
        )}

        {update.content && (
          <Markdown
            className={cn(
              "break-words text-muted-foreground",
              update.title ? "mt-2" : "mt-3 text-foreground",
              feature ? "text-base" : "text-sm",
            )}
          >
            {update.content}
          </Markdown>
        )}

        {update.tags && update.tags.length > 0 && (
          <ul
            className="mt-4 flex list-none flex-wrap gap-1.5 p-0"
            aria-label="Tags"
          >
            {update.tags.map((tag) => (
              <li key={tag}>
                {onTag ? (
                  <button
                    type="button"
                    onClick={() => onTag(tag)}
                    aria-pressed={activeTag === tag}
                    aria-label={`Show updates tagged ${tag}`}
                    className={cn(
                      "rounded-control px-1.5 py-0.5 text-xs font-medium transition-colors",
                      "focus-ring",
                      activeTag === tag
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    #{tag}
                  </button>
                ) : (
                  <span className="px-1.5 text-xs font-medium text-muted-foreground">
                    #{tag}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
