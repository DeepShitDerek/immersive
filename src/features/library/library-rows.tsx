"use client";

import {
  BookOpen,
  Bookmark,
  CheckCircle2,
  Circle,
  CircleDot,
  CircleSlash,
  Clapperboard,
  ExternalLink,
  Globe,
  Headphones,
  MoreHorizontal,
  Newspaper,
  Pencil,
  Play,
  Star,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type {
  LibraryHighlight,
  LibraryKind,
  LibrarySource,
  LibraryStatus,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LIBRARY_STATUSES } from "@/lib/schemas";
import { safeLinkUrl } from "@/lib/safe-url";
import { cn } from "@/lib/cn";
import { embedFor } from "./embed";
import { KIND_LABELS, statusLabel } from "./library-model";

const KIND_ICONS: Record<LibraryKind, LucideIcon> = {
  book: BookOpen,
  article: Newspaper,
  video: Clapperboard,
  podcast: Headphones,
  other: Bookmark,
};

const STATUS_LOOK: Record<
  LibraryStatus,
  { icon: LucideIcon; className: string }
> = {
  in_progress: {
    icon: CircleDot,
    className: "border-info/30 bg-info/10 text-info",
  },
  want: { icon: Circle, className: "text-muted-foreground" },
  done: {
    icon: CheckCircle2,
    className: "border-success/30 bg-success/10 text-success",
  },
  abandoned: { icon: CircleSlash, className: "text-muted-foreground" },
};

/** Status in words, with an icon, in the kind's own verb ("Reading", "Watched"). */
function SourceStatusBadge({
  status,
  kind,
}: {
  status: LibraryStatus;
  kind: LibraryKind;
}) {
  const { icon: Icon, className } = STATUS_LOOK[status];
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 shrink-0 gap-1 px-2 text-micro font-medium",
        className,
      )}
    >
      <Icon aria-hidden className="size-3" />
      {statusLabel(status, kind)}
    </Badge>
  );
}

function sinceLine(source: LibrarySource): string | null {
  if (!source.started_on) return null;
  try {
    return `Since ${format(parseISO(source.started_on), "d MMM")}`;
  } catch {
    return null;
  }
}

/**
 * What you are in the middle of, first: the
 * "currently reading" state was a chip on the second tab.
 */
export function NowReading({
  sources,
  keptPer,
  onOpen,
}: {
  sources: LibrarySource[];
  keptPer: Map<string, number>;
  onOpen: (source: LibrarySource) => void;
}) {
  if (sources.length === 0) return null;
  return (
    <section aria-labelledby="now-reading" className="space-y-2">
      <h2 id="now-reading" className="text-sm font-semibold">
        Now reading
      </h2>
      <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {sources.map((source) => {
          const Icon = KIND_ICONS[source.kind];
          const kept = keptPer.get(source.id) ?? 0;
          const embed = embedFor(source.url);
          const meta = [
            source.creator,
            sinceLine(source),
            kept > 0 && `${kept} highlight${kept === 1 ? "" : "s"}`,
          ].filter(Boolean);
          return (
            <li
              key={source.id}
              className="flex flex-col gap-3 rounded-surface border border-info/30 bg-card p-4"
            >
              <div className="flex min-w-0 items-start gap-3">
                <Icon
                  aria-hidden
                  className="mt-0.5 size-5 shrink-0 text-info"
                />
                <div className="min-w-0">
                  <p className="line-clamp-2 font-medium [overflow-wrap:anywhere]">
                    {source.title}
                  </p>
                  {meta.length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {meta.join(" · ")}
                    </p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-auto self-start"
                onClick={() => onOpen(source)}
                aria-label={`Continue ${source.title}`}
              >
                {embed ? <Play className="mr-1.5 size-4" aria-hidden /> : null}
                Continue
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * One source: kind, title, who and how many lines kept, status in words, and
 * every action behind ⋯. It had a status select, Play, Open, Edit and
 * Delete on the row, five controls on a noisy right edge (G5).
 */
export function SourceRow({
  source,
  kept,
  onOpen,
  onEdit,
  onDelete,
  onStatus,
}: {
  source: LibrarySource;
  kept: number;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatus: (next: LibraryStatus) => void;
}) {
  const Icon = KIND_ICONS[source.kind];
  const embed = embedFor(source.url);
  const href = safeLinkUrl(source.url);
  const detail = [
    source.creator,
    KIND_LABELS[source.kind],
    kept > 0 && `${kept} highlight${kept === 1 ? "" : "s"}`,
  ].filter(Boolean);

  return (
    <li className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-secondary/40">
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 rounded-control text-left focus-ring"
      >
        <span className="block truncate font-medium">{source.title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {detail.join(" · ")}
        </span>
      </button>
      <SourceStatusBadge status={source.status} kind={source.kind} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={`More actions for ${source.title}`}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {embed ? (
            <DropdownMenuItem onSelect={onOpen}>
              <Play className="mr-2 size-4" aria-hidden />
              {embed.kind === "video" ? "Watch here" : "Listen here"}
            </DropdownMenuItem>
          ) : href ? (
            <DropdownMenuItem asChild>
              <a href={href} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 size-4" aria-hidden /> Open the
                original
              </a>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil className="mr-2 size-4" aria-hidden /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Status
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={source.status}
            onValueChange={(next) => onStatus(next as LibraryStatus)}
          >
            {LIBRARY_STATUSES.map((status) => (
              <DropdownMenuRadioItem key={status} value={status}>
                {statusLabel(status, source.kind)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={onDelete}
          >
            <Trash2 className="mr-2 size-4" aria-hidden /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/**
 * One kept line. Favourite and "on the site" are states, shown as small
 * marks with words for screen readers; changing them is in ⋯ with Edit and
 * Delete. Four icon buttons sat under every quote.
 */
export function HighlightItem({
  highlight,
  source,
  cite,
  onOpenSource,
  onToggle,
  onEdit,
  onDelete,
}: {
  highlight: LibraryHighlight;
  source: LibrarySource | undefined;
  cite: string | null;
  onOpenSource: () => void;
  onToggle: (field: "is_public" | "is_favorite") => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="px-5 py-4">
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 whitespace-pre-wrap font-heading text-lg leading-snug [overflow-wrap:anywhere]">
          {highlight.text}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2 -mt-1 size-8 shrink-0"
              aria-label="More actions for this highlight"
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="mr-2 size-4" aria-hidden /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onToggle("is_favorite")}>
              <Star className="mr-2 size-4" aria-hidden />
              {highlight.is_favorite
                ? "Remove from favourites"
                : "Add to favourites"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onToggle("is_public")}>
              <Globe className="mr-2 size-4" aria-hidden />
              {highlight.is_public ? "Take off the site" : "Show on the site"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={onDelete}
            >
              <Trash2 className="mr-2 size-4" aria-hidden /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {cite &&
          (source ? (
            <button
              type="button"
              onClick={onOpenSource}
              className="max-w-full rounded-control text-left [overflow-wrap:anywhere] hover:text-foreground focus-ring"
            >
              — {cite}
            </button>
          ) : (
            <span className="[overflow-wrap:anywhere]">— {cite}</span>
          ))}
        {(highlight.is_favorite || highlight.is_public) && (
          <span className="ml-auto flex items-center gap-2">
            {highlight.is_favorite && (
              <span className="inline-flex items-center gap-1 text-xs">
                <Star
                  aria-hidden
                  className="size-3.5 fill-current text-primary"
                />
                Favourite
              </span>
            )}
            {highlight.is_public && (
              <span className="inline-flex items-center gap-1 text-xs">
                <Globe aria-hidden className="size-3.5 text-primary" />
                On the site
              </span>
            )}
          </span>
        )}
      </div>
      {highlight.note && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {highlight.note}
        </p>
      )}
    </li>
  );
}
