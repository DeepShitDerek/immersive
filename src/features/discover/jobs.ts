import type { Posting } from "./live";

/**
 * Career discovery that is not one German job board.
 *
 * The module read a single source, Arbeitnow, which is a German board — so
 * "career" meant "roles in Germany", which is not much use from Ontario. This
 * adds Remote OK alongside it and gives the results the two axes that actually
 * decide whether a posting is worth reading: **where** and **on what terms**.
 *
 * ## Attribution is a requirement, not a courtesy
 *
 * Remote OK's API terms ask for a followed link back and a named credit, and
 * say access is suspended without it. `JOB_SOURCES` carries that so the UI
 * cannot render the results without also rendering the credit.
 *
 * ## The shape of the response is a trap
 *
 * Remote OK's array does not begin with a job. Element zero is a legal notice
 * — `{ legal: "API Terms of Service: …" }` — and a parser that maps straight
 * over the array produces a phantom posting with no title. The fixture in
 * `__fixtures__/remoteok.json` keeps that element on purpose, because a
 * hand-written fixture would not have it and the test would pass against a
 * parser that breaks on the real thing.
 */

export interface JobSource {
  id: string;
  label: string;
  /** Rendered next to the results. Required by Remote OK's terms. */
  credit: { text: string; href: string };
}

export const JOB_SOURCES: Record<"remoteok" | "arbeitnow", JobSource> = {
  remoteok: {
    id: "remoteok",
    label: "Remote OK",
    credit: { text: "Remote OK", href: "https://remoteok.com" },
  },
  arbeitnow: {
    id: "arbeitnow",
    label: "Arbeitnow",
    credit: { text: "Arbeitnow", href: "https://www.arbeitnow.com" },
  },
};

export const REMOTE_OK_API = "https://remoteok.com/api";

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseRemoteOk(body: unknown): Posting[] {
  if (!Array.isArray(body)) return [];

  return body
    .map((row): Posting | null => {
      if (typeof row !== "object" || row === null) return null;
      const record = row as Record<string, unknown>;

      // Element zero of the real response is the licence notice, not a job.
      if ("legal" in record) return null;

      const title = text(record.position);
      const url = text(record.url) ?? text(record.apply_url);
      if (!title || !url) return null;

      return {
        id: text(record.slug) ?? text(record.id) ?? url,
        title,
        company: text(record.company) ?? "Unknown",
        url,
        // Trailing separators are normal here: the live data has "York, " and
        // "Goa, " with the country half missing.
        location: text(record.location)?.replace(/[,\s]+$/, "") ?? null,
        // Every posting on this board is remote; that is the whole board.
        remote: true,
        tags: Array.isArray(record.tags)
          ? record.tags.filter((tag): tag is string => typeof tag === "string")
          : [],
        postedAt:
          typeof record.epoch === "number"
            ? new Date(record.epoch * 1000).toISOString()
            : text(record.date),
      };
    })
    .filter((posting): posting is Posting => posting !== null);
}

/* ────────────────────────────────────────────────────────────────
 * The two axes that decide whether a posting is worth reading
 * ──────────────────────────────────────────────────────────────── */

export type EmploymentType =
  | "full-time"
  | "part-time"
  | "contract"
  | "freelance"
  | "internship";

const EMPLOYMENT_PATTERNS: Record<EmploymentType, RegExp> = {
  // Word-boundary alternatives written out rather than built from a template:
  // a `\b` interpolated into a plain template literal is a backspace, which
  // has cost this project four working tests.
  "full-time": /\b(full[-\s]?time|permanent|festanstellung|vollzeit)\b/i,
  "part-time": /\b(part[-\s]?time|teilzeit)\b/i,
  contract: /\b(contract|contractor|fixed[-\s]?term|b2b)\b/i,
  freelance: /\b(freelance|freelancer)\b/i,
  internship: /\b(intern|internship|praktikum|werkstudent)\b/i,
};

/**
 * What terms a posting is offered on.
 *
 * Inferred from the title and tags, because neither board has a structured
 * field for it. A posting can match more than one — "contract or full-time" is
 * a real advert — and one that matches none returns an empty array rather than
 * being guessed into "full-time", which is the assumption that would hide every
 * freelance role from someone filtering for it.
 */
function employmentTypes(posting: Posting): EmploymentType[] {
  const haystack = [posting.title, ...posting.tags].join(" ");
  return (Object.keys(EMPLOYMENT_PATTERNS) as EmploymentType[]).filter((type) =>
    EMPLOYMENT_PATTERNS[type].test(haystack),
  );
}

export type Region = "north-america" | "europe" | "remote" | "elsewhere";

const NORTH_AMERICA =
  /\b(canada|usa|u\.s\.|united states|america|ontario|toronto|vancouver|montreal|new york|nyc|california|san francisco|seattle|austin|boston|chicago|denver|texas|florida|washington|remote[-\s]?us|remote[-\s]?na)\b/i;

const EUROPE =
  /\b(germany|deutschland|berlin|munich|münchen|hamburg|france|paris|spain|madrid|barcelona|netherlands|amsterdam|poland|warsaw|portugal|lisbon|ireland|dublin|uk|united kingdom|london|europe|emea)\b/i;

/**
 * Roughly where a posting is.
 *
 * Deliberately rough. Location strings on these boards are free text and often
 * half-written — the live Remote OK response has "York, " and "Goa, " with the
 * country missing — so this sorts postings into buckets you can filter by, and
 * does not pretend to geocode. Anything it cannot place is `elsewhere` rather
 * than being quietly dropped: a posting you cannot categorise is still a
 * posting, and hiding it would make the filter lie about what the board holds.
 */
function regionOf(posting: Posting): Region {
  const where = posting.location ?? "";

  if (NORTH_AMERICA.test(where)) return "north-america";
  if (EUROPE.test(where)) return "europe";
  if (!where && posting.remote) return "remote";
  if (/\bremote|anywhere|worldwide\b/i.test(where)) return "remote";

  return "elsewhere";
}

export interface JobFilters {
  types?: EmploymentType[];
  regions?: Region[];
}

/**
 * Apply the filters, treating an empty selection as "no opinion".
 *
 * An empty array meaning "everything" rather than "nothing" is what stops the
 * page going blank the moment you clear a filter — which reads as a broken
 * fetch rather than as an empty selection.
 */
export function filterJobs(
  postings: Posting[],
  filters: JobFilters = {},
): Posting[] {
  const types = filters.types ?? [];
  const regions = filters.regions ?? [];

  return postings.filter((posting) => {
    if (types.length > 0) {
      const found = employmentTypes(posting);
      if (!types.some((type) => found.includes(type))) return false;
    }
    if (regions.length > 0 && !regions.includes(regionOf(posting))) {
      return false;
    }
    return true;
  });
}

/** Newest first, with undated postings last rather than at the top. */
function byNewest(postings: Posting[]): Posting[] {
  return [...postings].sort((a, b) => {
    if (!a.postedAt) return 1;
    if (!b.postedAt) return -1;
    return b.postedAt.localeCompare(a.postedAt);
  });
}

/** Two boards, one list, no duplicate adverts. */
export function mergePostings(...lists: Posting[][]): Posting[] {
  const seen = new Set<string>();
  const merged: Posting[] = [];

  for (const posting of lists.flat()) {
    // Keyed on the URL rather than the id: the two boards number their rows
    // independently, so the same advert cross-posted would otherwise appear
    // twice.
    const key = posting.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(posting);
  }

  return byNewest(merged);
}
