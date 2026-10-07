"use client";

import {
  BookMarked,
  BookOpen,
  Bookmark,
  Clapperboard,
  Headphones,
  Newspaper,
  Quote,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useGetRandomHighlightQuery } from "@/store/api/publicApi";
import { Skeleton } from "@/components/ui/skeleton";
import { EASE } from "@/components/layout/motion";
import { safeLinkUrl } from "@/lib/safe-url";
import { cn } from "@/lib/cn";
import type { LibraryKind, PublicHighlight } from "@/types";

const KIND_ICONS: Record<LibraryKind, LucideIcon> = {
  book: BookOpen,
  article: Newspaper,
  video: Clapperboard,
  podcast: Headphones,
  other: Bookmark,
};

/**
 * One line from the owner's Library, different on each visit.
 *
 * **Aligned like everything around it.** Every public page runs down one left
 * edge — the page header, each section title, every card. The first version
 * of this widget centred itself, and a centred block under a left-aligned
 * heading pulls the eye onto a second axis. It now sits on the same edge and
 * shares its grammar with the featured testimonial — faded quote mark in the
 * corner, the line in the heading face at a reading measure, a round mark
 * beside the citation — so the site's two quotations read as one family.
 *
 * The request for another line lives in the card's own closing row, on the
 * same grid as everything else, and the next line crossfades in place.
 *
 * It reads a database function that returns only lines marked public, and
 * resolves to nothing on any failure — an empty Library, a missing migration
 * or a network error all produce an absent widget, never an error on someone
 * else's page.
 */
export function HighlightWidget() {
  const reduceMotion = useReducedMotion();
  const { data, isLoading, isFetching, refetch } = useGetRandomHighlightQuery(
    undefined,
    // A fresh line on every mount — returning to the page is a new visit.
    { refetchOnMountOrArgChange: true },
  );

  if (isLoading) {
    return (
      <div className="rounded-surface bg-card p-7 shadow-e1 sm:p-10" aria-busy>
        <Skeleton className="h-7 w-full max-w-2xl rounded-control" />
        <Skeleton className="mt-3 h-7 w-3/4 max-w-xl rounded-control" />
        <div className="mt-8 flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32 rounded-control" />
            <Skeleton className="h-3 w-48 rounded-control" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="relative overflow-hidden rounded-surface bg-card shadow-e1">
      <Quote
        aria-hidden
        className="pointer-events-none absolute right-6 top-6 size-16 text-primary/10 sm:size-24"
      />

      <div className="p-7 sm:p-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={data.id}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 10, filter: "blur(4px)" }
            }
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -10, filter: "blur(4px)" }
            }
            transition={{ duration: 0.3, ease: EASE }}
          >
            <HighlightQuote highlight={data} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-border/60 px-7 py-4 sm:px-10">
        <p className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <BookMarked className="size-3.5" aria-hidden />
          From my library
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Show another line"
          className="group inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors duration-base hover:bg-secondary hover:text-foreground focus-ring disabled:opacity-60"
        >
          <RefreshCw
            className={cn(
              "size-3.5 transition-transform duration-500 ease-enter group-hover:rotate-180 motion-reduce:transition-none",
              isFetching && "animate-spin motion-reduce:animate-none",
            )}
            aria-hidden
          />
          Another line
        </button>
      </div>
    </div>
  );
}

/**
 * The line and its citation — left-aligned, like the page it sits on. Split
 * out so the admin can preview exactly what a visitor will see before a
 * highlight is made public.
 */
export function HighlightQuote({
  highlight,
  className,
}: {
  highlight: Pick<
    PublicHighlight,
    | "text"
    | "attribution"
    | "location"
    | "source_title"
    | "source_creator"
    | "source_url"
  > & { source_kind?: LibraryKind | null };
  className?: string;
}) {
  // Attribution wins: it is who said the line — a podcast guest, a character
  // — where the creator is only who made the source it came from.
  const who = highlight.attribution ?? highlight.source_creator;
  const where = highlight.source_title;
  // The source link is owner-entered, but it is rendered on a public page, so
  // it goes through the same filter as every other outbound link.
  const href = safeLinkUrl(highlight.source_url);
  const kind = highlight.source_kind ?? "other";
  const Icon = KIND_ICONS[kind] ?? Bookmark;

  return (
    <figure className={className}>
      <blockquote className="relative max-w-3xl pr-10 font-heading text-xl leading-snug text-balance [overflow-wrap:anywhere] sm:pr-16 sm:text-2xl">
        {/* overflow-wrap: a pasted line can be one long unbroken token. */}
        {highlight.text}
      </blockquote>

      {(who || where) && (
        <figcaption className="mt-8 flex items-center gap-3">
          <span
            aria-hidden
            data-kind={kind}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            {who && <p className="text-sm font-semibold">{who}</p>}
            {where && (
              <p className="truncate text-xs text-muted-foreground">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-4 transition-colors hover:text-primary hover:underline focus-ring"
                  >
                    <cite className="not-italic">{where}</cite>
                  </a>
                ) : (
                  <cite className="not-italic">{where}</cite>
                )}
                {highlight.location && <> · {highlight.location}</>}
              </p>
            )}
          </div>
        </figcaption>
      )}
    </figure>
  );
}
