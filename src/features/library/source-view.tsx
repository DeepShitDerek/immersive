"use client";

import { useState } from "react";
import { ExternalLink, Pencil, Play, Plus, Star } from "lucide-react";
import type { LibraryHighlight, LibrarySource } from "@/types";
import { Button } from "@/components/ui/button";
import { safeLinkUrl } from "@/lib/safe-url";
import { cn } from "@/lib/cn";
import { embedFor, parseTimestamp, type Embed } from "./embed";
import { KIND_LABELS, statusLabel } from "./library-model";

/**
 * A provider's player.
 *
 * The `src` comes from `embedFor`, which builds it from a parsed ID against an
 * allowlist — never from the pasted link. The sandbox still applies: the
 * players need scripts and their own origin, and nothing else is granted
 * beyond fullscreen and opening the provider in a new tab.
 */
function SourcePlayer({ embed, title }: { embed: Embed; title: string }) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-surface bg-muted shadow-e1",
        embed.kind === "video" ? "aspect-video" : "h-[152px]",
        embed.provider === "apple-podcasts" && "h-[175px]",
      )}
    >
      <iframe
        src={embed.src}
        title={title}
        loading="lazy"
        className="size-full border-0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}

function hostOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "the original site";
  }
}

/**
 * One source: its player when the provider offers one, the way out when it
 * does not, and the lines kept from it. A highlight with a timestamp can start
 * the player at that moment — the reason a highlight's location is free text
 * rather than a page number.
 */
export function SourceView({
  source,
  highlights,
  onAddHighlight,
  onEdit,
}: {
  source: LibrarySource;
  highlights: LibraryHighlight[];
  onAddHighlight: () => void;
  onEdit: () => void;
}) {
  const [start, setStart] = useState<number | null>(null);
  const embed = embedFor(source.url, start);
  const href = safeLinkUrl(source.url);

  const meta = [
    KIND_LABELS[source.kind],
    statusLabel(source.status, source.kind),
    source.started_on && `started ${source.started_on}`,
    source.finished_on && `finished ${source.finished_on}`,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      {embed && (
        // Keyed by src so choosing a timestamp reloads the player there.
        <SourcePlayer
          key={embed.src}
          embed={embed}
          title={`${source.title} — ${embed.label} player`}
        />
      )}

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{meta.join(" · ")}</p>
        {source.rating ? (
          <p
            className="flex gap-0.5 text-primary"
            aria-label={`Rated ${source.rating} of 5`}
          >
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                className={cn(
                  "size-4",
                  i < (source.rating ?? 0) ? "fill-current" : "opacity-30",
                )}
                aria-hidden
              />
            ))}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {href && (
          <Button asChild variant="outline" size="sm">
            <a href={href} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 size-4" aria-hidden />
              Open on {embed ? embed.label : hostOf(href)}
            </a>
          </Button>
        )}
        <Button size="sm" onClick={onAddHighlight}>
          <Plus className="mr-2 size-4" aria-hidden />
          Add a highlight
        </Button>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Pencil className="mr-2 size-4" aria-hidden />
          Edit
        </Button>
      </div>

      {source.notes && (
        <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
          {source.notes}
        </p>
      )}

      <section aria-label="Highlights from this source" className="space-y-3">
        <h3 className="text-sm font-medium">
          Highlights{" "}
          <span className="text-muted-foreground">{highlights.length}</span>
        </h3>
        {highlights.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing kept from this one yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {highlights.map((highlight) => {
              const at = parseTimestamp(highlight.location);
              return (
                <li
                  key={highlight.id}
                  className="rounded-surface bg-card p-4 shadow-e1"
                >
                  <p className="font-heading leading-snug [overflow-wrap:anywhere]">
                    {highlight.text}
                  </p>
                  {highlight.location && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      {embed && at !== null ? (
                        <button
                          type="button"
                          onClick={() => setStart(at)}
                          className="inline-flex items-center gap-1 rounded-control px-1.5 py-0.5 text-primary underline-offset-4 hover:underline focus-ring"
                        >
                          <Play className="size-3" aria-hidden />
                          Play from {highlight.location}
                        </button>
                      ) : (
                        <span>{highlight.location}</span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
