/**
 * "What is most worth reading right now?"
 *
 * The one Discover question with a real answer, and the one it was not
 * answering. Ranking articles needs an engagement signal, and most sources do
 * not publish one — Substack in particular has no public API for likes or
 * shares, so the "30k likes" shape of request cannot be served from it
 * honestly. Two sources do publish real numbers, and both are keyless and
 * CORS-open:
 *
 * - **Hacker News** — `score` (upvotes) and `descendants` (comments).
 * - **dev.to** — `positive_reactions_count` and `comments_count`, with a
 *   `top=N` parameter that means "most reacted in the last N days".
 *
 * Nothing here invents a number. An article with no signal is not given a
 * plausible one; it is not ranked at all.
 */

type ReadingSource = "hackernews" | "devto";

export interface ReadingItem {
  id: string;
  title: string;
  url: string;
  source: ReadingSource;
  /** Upvotes or reactions. */
  points: number;
  comments: number;
  publishedAt: string | null;
  /** Minutes, where the source says. dev.to does; Hacker News does not. */
  readingMinutes: number | null;
  /** Where the discussion is, when that is a different page from the article. */
  discussionUrl: string | null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

/** Algolia's Hacker News search response. */
function parseHackerNews(body: unknown): ReadingItem[] {
  const hits = (body as { hits?: unknown[] } | null)?.hits;
  if (!Array.isArray(hits)) return [];

  return hits
    .map((row): ReadingItem | null => {
      if (typeof row !== "object" || row === null) return null;
      const record = row as Record<string, unknown>;

      const title = text(record.title);
      const id = text(record.objectID);
      if (!title || !id) return null;

      // An Ask HN post has no url of its own; the discussion *is* the article.
      const discussion = `https://news.ycombinator.com/item?id=${id}`;
      const url = text(record.url) ?? discussion;

      return {
        id: `hn-${id}`,
        title,
        url,
        source: "hackernews",
        points: count(record.points),
        comments: count(record.num_comments),
        publishedAt: text(record.created_at),
        readingMinutes: null,
        discussionUrl: url === discussion ? null : discussion,
      };
    })
    .filter((item): item is ReadingItem => item !== null);
}

function parseDevTo(body: unknown): ReadingItem[] {
  if (!Array.isArray(body)) return [];

  return body
    .map((row): ReadingItem | null => {
      if (typeof row !== "object" || row === null) return null;
      const record = row as Record<string, unknown>;

      const title = text(record.title);
      const url = text(record.url);
      if (!title || !url) return null;

      return {
        id: `devto-${text(record.id) ?? url}`,
        title,
        url,
        source: "devto",
        points: count(record.positive_reactions_count),
        comments: count(record.comments_count),
        publishedAt: text(record.published_at),
        readingMinutes:
          typeof record.reading_time_minutes === "number"
            ? record.reading_time_minutes
            : null,
        discussionUrl: null,
      };
    })
    .filter((item): item is ReadingItem => item !== null);
}

/**
 * How much attention something got, adjusted for how long it has had.
 *
 * A straight sort by points always returns the same handful of all-time posts,
 * which is a hall of fame rather than an answer to "what should I read now".
 * Dividing by age — the shape Hacker News itself uses — lets something from
 * this morning outrank something from last week that has three times the
 * votes.
 *
 * Comments are weighted lower than points on purpose: a long comment thread is
 * as often an argument as it is a recommendation.
 *
 * The gravity exponent is 1.5, not tuned. There is no ground truth to tune it
 * against here, and a fitted constant would imply a precision this does not
 * have.
 */
function heat(item: ReadingItem, now = Date.now()): number {
  const signal = item.points + item.comments * 0.5;
  if (signal <= 0) return 0;

  const published = item.publishedAt ? Date.parse(item.publishedAt) : NaN;
  if (Number.isNaN(published)) return signal;

  const hours = Math.max((now - published) / 3_600_000, 0);
  return signal / Math.pow(hours + 2, 1.5);
}

/**
 * The reading list: merged, deduplicated, ranked.
 *
 * Items with no engagement at all are dropped rather than ranked last. A list
 * headed "most worth reading" that runs out into things nobody read is a list
 * whose bottom half is noise.
 */
function rankReading(
  lists: ReadingItem[][],
  options: { limit?: number; now?: number } = {},
): ReadingItem[] {
  const now = options.now ?? Date.now();
  const seen = new Set<string>();
  const merged: ReadingItem[] = [];

  for (const item of lists.flat()) {
    if (item.points + item.comments === 0) continue;
    // Keyed on the destination: the same article submitted to both sources is
    // one thing to read, and whichever copy has more attention wins.
    const key = item.url.toLowerCase().replace(/[?#].*$/, "");
    const existing = merged.findIndex(
      (candidate) => candidate.url.toLowerCase().replace(/[?#].*$/, "") === key,
    );
    if (existing !== -1) {
      if (heat(item, now) > heat(merged[existing], now))
        merged[existing] = item;
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged
    .sort((a, b) => heat(b, now) - heat(a, now))
    .slice(0, options.limit ?? 12);
}

/* ────────────────────────────────────────────────────────────────
 * Fetching
 * ──────────────────────────────────────────────────────────────── */

/**
 * Hacker News front-page stories from the last day, by points.
 *
 * Algolia's `search_by_date` would give recency without popularity, and plain
 * `search` gives popularity without recency; `numericFilters` on the created
 * timestamp is what asks for both. The window is a parameter because "today"
 * and "this week" are different questions and the caller knows which is being
 * asked.
 */
function hackerNewsUrl(days: number, minPoints = 20): string {
  const since = Math.floor(Date.now() / 1000) - days * 86_400;
  return (
    "https://hn.algolia.com/api/v1/search?tags=story" +
    `&numericFilters=created_at_i>${since},points>${minPoints}` +
    "&hitsPerPage=40"
  );
}

/** dev.to's own "most reacted in the last N days". */
function devToUrl(days: number): string {
  return `https://dev.to/api/articles?top=${days}&per_page=30`;
}

/**
 * The reading list.
 *
 * `Promise.all` over two independent sources, each of which resolves to null
 * rather than throwing — these sit on someone else's uptime and behind whatever
 * the visitor's ad-blocker decides. Null is returned only when *both* fail, so
 * the panel can tell "nothing to show" from "could not ask", which are
 * different sentences.
 */
export async function fetchReading(
  days: number,
  fetchJson: <T>(url: string) => Promise<T | null>,
  now = Date.now(),
): Promise<ReadingItem[] | null> {
  const [hn, devto] = await Promise.all([
    fetchJson<unknown>(hackerNewsUrl(days)),
    fetchJson<unknown>(devToUrl(days)),
  ]);

  if (hn === null && devto === null) return null;

  return rankReading(
    [
      hn === null ? [] : parseHackerNews(hn),
      devto === null ? [] : parseDevTo(devto),
    ],
    { now },
  );
}
