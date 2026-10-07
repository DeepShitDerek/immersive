import { fetchJson } from "./sources";

/**
 * Trending news and the job market — both reachable directly from a browser.
 *
 * This replaced a Supabase edge function, and the reason is worth recording.
 * The function existed as a CORS shim for Google News and Yahoo Finance, and
 * it worked, but it made two features depend on a deploy step that had to be
 * run and maintained. Both are now served by sources that send
 * `access-control-allow-origin: *` themselves, so the shim and its deploy step
 * are gone.
 *
 * **Trending** is Mastodon's trending-links endpoint: the news articles being
 * shared most across the network right now, with share counts. It is closer to
 * what "trending" actually means than a publisher's own front page, because
 * the ranking comes from readers rather than an editor.
 *
 * **Jobs** is Arbeitnow, which returns around 175 live postings in one
 * request. Remotive was tried first and dropped: its `search` parameter is
 * silently ignored — a query for "react" and a query for "data engineer"
 * return the identical seventeen jobs, headed by "Patient Care Specialist" —
 * so every result and every skill count derived from it was noise wearing the
 * shape of an answer.
 */

/* ── Trending news ───────────────────────────────────────────────────────── */

const TRENDING = "https://mastodon.social/api/v1/trends/links";

export interface TrendingLink {
  title: string;
  url: string;
  publisher: string | null;
  description: string | null;
  /** Total shares across the days the API reports, or null when absent. */
  shares: number | null;
  image: string | null;
}

export async function fetchTrending(): Promise<TrendingLink[] | null> {
  const body = await fetchJson(TRENDING);
  if (body === null) return null;
  return parseTrending(body);
}

function parseTrending(body: unknown): TrendingLink[] {
  if (!Array.isArray(body)) return [];

  return (
    body
      .map((row): TrendingLink | null => {
        if (typeof row !== "object" || row === null) return null;
        const record = row as Record<string, unknown>;

        const title = text(record.title);
        const url = text(record.url);
        if (!title || !url) return null;

        // `history` is a per-day breakdown; the total is what makes one link
        // comparable to another.
        const history = Array.isArray(record.history) ? record.history : [];
        let shares = 0;
        let counted = false;
        for (const day of history) {
          if (typeof day !== "object" || day === null) continue;
          const uses = Number((day as Record<string, unknown>).uses);
          if (Number.isFinite(uses)) {
            shares += uses;
            counted = true;
          }
        }

        return {
          title,
          url,
          publisher: text(record.provider_name),
          description: text(record.description),
          shares: counted ? shares : null,
          image: text(record.image),
        };
      })
      .filter((link): link is TrendingLink => link !== null)
      // Most-shared first: the ranking is the whole point of a trending list.
      .sort((a, b) => (b.shares ?? 0) - (a.shares ?? 0))
  );
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/* ── Jobs ────────────────────────────────────────────────────────────────── */

import { mergePostings, parseRemoteOk, REMOTE_OK_API } from "./jobs";

const JOB_BOARD = "https://www.arbeitnow.com/api/job-board-api";

export interface Posting {
  id: string;
  title: string;
  company: string;
  url: string;
  location: string | null;
  remote: boolean;
  tags: string[];
  postedAt: string | null;
}

/**
 * Both boards, merged.
 *
 * Arbeitnow alone meant "career" was roles in Germany, which is not much use
 * from Ontario. Remote OK is worldwide and remote-first, so between them the
 * list covers North America as well as Europe.
 *
 * `Promise.allSettled`, not `all`: one board being down is a smaller list, not
 * an empty page. Null is returned only when *both* fail, so the panel can tell
 * "nothing to show" from "could not ask".
 */
export async function fetchPostings(): Promise<Posting[] | null> {
  const [arbeitnow, remoteOk] = await Promise.all([
    fetchJson(JOB_BOARD),
    fetchJson(REMOTE_OK_API),
  ]);

  if (arbeitnow === null && remoteOk === null) return null;

  return mergePostings(
    arbeitnow === null ? [] : parsePostings(arbeitnow),
    remoteOk === null ? [] : parseRemoteOk(remoteOk),
  );
}

function parsePostings(body: unknown): Posting[] {
  const rows = (body as { data?: unknown[] } | null)?.data;
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row): Posting | null => {
      if (typeof row !== "object" || row === null) return null;
      const record = row as Record<string, unknown>;

      const title = text(record.title);
      const url = text(record.url);
      if (!title || !url) return null;

      return {
        id: text(record.slug) ?? url,
        title,
        company: text(record.company_name) ?? "Unknown",
        url,
        location: text(record.location),
        remote: record.remote === true,
        tags: Array.isArray(record.tags)
          ? record.tags.filter((tag): tag is string => typeof tag === "string")
          : [],
        // Unix seconds on this board, unlike every other date in the app.
        postedAt:
          typeof record.created_at === "number"
            ? new Date(record.created_at * 1000).toISOString()
            : text(record.created_at),
      };
    })
    .filter((posting): posting is Posting => posting !== null);
}

/**
 * Filter postings by a term, in the browser.
 *
 * Client-side deliberately. The board has no search parameter, and the one
 * that was tried on another board silently ignored the query — which is worse
 * than not having one, because the results look like an answer. Matching here
 * is at least inspectable: it looks at the title, the tags and the company,
 * and an empty term means everything.
 */
export function filterPostings(postings: Posting[], term: string): Posting[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return postings;

  // Every word must appear somewhere, so "senior react" does not match every
  // posting that merely says "senior".
  const words = needle.split(/\s+/);

  return postings.filter((posting) => {
    const haystack = [posting.title, posting.company, ...posting.tags]
      .join(" ")
      .toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * Which skills appear most across a set of postings.
 *
 * The part with actual career value. One advert tells you what one company
 * wants; a hundred and seventy tell you what the market is asking for, and the
 * gap between that list and your own is the thing worth acting on.
 *
 * Counted over the *whole* board rather than over a filtered search, because a
 * search narrowed to six results produces skill counts of one — noise shaped
 * like a ranking. The sample size is returned so the figures can be read
 * honestly: "TypeScript, 12" means nothing without "of 175".
 */
export function skillDemand(
  postings: Posting[],
  limit = 12,
): { skills: { tag: string; count: number }[]; sampled: number } {
  const counts = new Map<string, number>();

  for (const posting of postings) {
    // Deduplicated per posting, so one advert repeating a tag does not
    // outvote several adverts that each mention it once.
    const seen: string[] = [];
    for (const raw of posting.tags) {
      const tag = raw.toLowerCase().trim();
      if (!tag || seen.indexOf(tag) !== -1) continue;
      seen.push(tag);
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const skills = Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    // Ties broken alphabetically, so identical data does not reshuffle between
    // renders.
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);

  return { skills, sampled: postings.length };
}

/**
 * `2026-08-14T09:00:00Z` reads as `5 days ago`.
 *
 * Counted in **calendar days**, not elapsed hours. Diffing timestamps says a
 * posting from yesterday at 23:00, read at 01:00, went up "today" — which is
 * not what either word means to a reader.
 */
export function postedLabel(iso: string, now = new Date()): string {
  const posted = new Date(iso);
  if (Number.isNaN(posted.getTime())) return "";

  const startOf = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  const days = Math.round(
    (startOf(now) - startOf(posted)) / (24 * 60 * 60_000),
  );

  if (days < 0) return "just posted";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;

  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}
