import type {
  LibraryHighlight,
  LibraryKind,
  LibrarySource,
  LibraryStatus,
  PublicHighlight,
} from "@/types";

/**
 * The Library's derived state: labels, filtering, counts and the status
 * change. Pure, so the page stays a composition and the rules are testable
 * without rendering it.
 */

export const KIND_LABELS: Record<LibraryKind, string> = {
  book: "Book",
  article: "Article",
  video: "Video",
  podcast: "Podcast",
  other: "Other",
};

const VERBS: Record<LibraryKind, { base: string; ing: string; past: string }> =
  {
    book: { base: "read", ing: "Reading", past: "Read" },
    article: { base: "read", ing: "Reading", past: "Read" },
    video: { base: "watch", ing: "Watching", past: "Watched" },
    podcast: { base: "listen to", ing: "Listening", past: "Listened" },
    other: { base: "get to", ing: "In progress", past: "Finished" },
  };

/**
 * A status in the verb its kind takes. "Want to read" is right for a book and
 * wrong for a podcast, and the reading list holds both.
 */
export function statusLabel(status: LibraryStatus, kind: LibraryKind): string {
  const verbs = VERBS[kind];
  switch (status) {
    case "want":
      return `Want to ${verbs.base}`;
    case "in_progress":
      return verbs.ing;
    case "done":
      return verbs.past;
    case "abandoned":
      return "Set aside";
  }
}

/** Kind-agnostic names, for the filter that spans every kind at once. */
export const STATUS_FILTER_LABELS: Record<LibraryStatus, string> = {
  in_progress: "In progress",
  want: "Up next",
  done: "Finished",
  abandoned: "Set aside",
};

/** What is under way first, then what is next; the finished list last. */
export const STATUS_ORDER: LibraryStatus[] = [
  "in_progress",
  "want",
  "done",
  "abandoned",
];

export type StatusFilter = LibraryStatus | "all";
export type HighlightFilter = "all" | "public" | "favorites";

function matches(fields: (string | null | undefined)[], search: string) {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => field?.toLowerCase().includes(needle));
}

export function visibleSources(
  sources: LibrarySource[],
  status: StatusFilter,
  search: string,
): LibrarySource[] {
  return sources
    .filter(
      (source) =>
        (status === "all" || source.status === status) &&
        matches([source.title, source.creator, source.notes], search),
    )
    .sort(
      (a, b) =>
        STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
        (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
    );
}

export function countSourcesByStatus(
  sources: LibrarySource[],
): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = {
    all: sources.length,
    want: 0,
    in_progress: 0,
    done: 0,
    abandoned: 0,
  };
  for (const source of sources) counts[source.status] += 1;
  return counts;
}

/**
 * Search reaches the source as well as the line, because "that thing from
 * Dune" is how a highlight is remembered far more often than by its wording.
 */
export function visibleHighlights(
  highlights: LibraryHighlight[],
  sourcesById: Map<string, LibrarySource>,
  filter: HighlightFilter,
  search: string,
): LibraryHighlight[] {
  return highlights.filter((highlight) => {
    if (filter === "public" && !highlight.is_public) return false;
    if (filter === "favorites" && !highlight.is_favorite) return false;
    const source = highlight.source_id
      ? sourcesById.get(highlight.source_id)
      : undefined;
    return matches(
      [
        highlight.text,
        highlight.attribution,
        highlight.note,
        source?.title,
        source?.creator,
      ],
      search,
    );
  });
}

export function countHighlights(
  highlights: LibraryHighlight[],
): Record<HighlightFilter, number> {
  return {
    all: highlights.length,
    public: highlights.filter((h) => h.is_public).length,
    favorites: highlights.filter((h) => h.is_favorite).length,
  };
}

export function highlightsPerSource(
  highlights: LibraryHighlight[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const highlight of highlights) {
    if (!highlight.source_id) continue;
    counts.set(highlight.source_id, (counts.get(highlight.source_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * A highlight in the shape the public widget renders, so the admin preview is
 * the same component a visitor sees rather than an imitation of it.
 */
export function citationFor(
  highlight: Pick<LibraryHighlight, "text" | "attribution" | "location">,
  source?: LibrarySource | null,
): Pick<
  PublicHighlight,
  | "text"
  | "attribution"
  | "location"
  | "source_title"
  | "source_creator"
  | "source_url"
> {
  return {
    text: highlight.text,
    attribution: highlight.attribution || null,
    location: highlight.location || null,
    source_title: source?.title ?? null,
    source_creator: source?.creator ?? null,
    source_url: source?.url ?? null,
  };
}

/** One line of citation for the admin list: who, from what, where. */
export function citationLine(
  highlight: Pick<LibraryHighlight, "attribution" | "location">,
  source?: LibrarySource | null,
): string {
  return [
    highlight.attribution || source?.creator,
    source?.title,
    highlight.location,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Today as YYYY-MM-DD in local time — a DATE column is a calendar day. */
export function localIsoDate(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The write for moving a source to a new status, stamping the dates the move
 * implies — starting something records when, finishing it records when —
 * without overwriting a date already recorded.
 *
 * A finish date is not stamped when the start date is later than today: the
 * database requires finished ≥ started, and a wrong guess at a date is worse
 * than leaving it for the form.
 */
export function statusChange(
  source: Pick<LibrarySource, "id" | "started_on" | "finished_on">,
  next: LibraryStatus,
  today: string,
): Pick<LibrarySource, "id" | "status" | "started_on" | "finished_on"> {
  const patch: Pick<
    LibrarySource,
    "id" | "status" | "started_on" | "finished_on"
  > = { id: source.id, status: next };

  if (next === "in_progress" && !source.started_on) patch.started_on = today;

  if (
    next === "done" &&
    !source.finished_on &&
    (!source.started_on || source.started_on <= today)
  ) {
    patch.finished_on = today;
  }

  return patch;
}
