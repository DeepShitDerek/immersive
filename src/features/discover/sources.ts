/**
 * The outside world, read from the browser.
 *
 * Every service here needs **no API key**, and that is a hard constraint
 * rather than a preference. This app is a static export with no server, so a
 * key would have to travel as `NEXT_PUBLIC_*` — which Next.js compiles into
 * the JavaScript bundle, readable by anyone who opens the page. A key in a
 * static site is a published key. That rules out NewsAPI, OpenWeather and most
 * of the obvious choices, and it is why these four were picked:
 *
 * - **Open-Meteo** — forecasts, no key, `access-control-allow-origin: *`.
 * - **Hacker News** via Algolia — story search, no key, CORS reflected.
 * - **dev.to** — articles by tag, no key, `*`.
 * - **Wikipedia** — on this day, no key, `*`.
 *
 * The second constraint is that all of it is optional. These are third-party
 * services on someone else's uptime, reached over a connection that may be
 * behind an ad-blocker — the visit tracker already learned that lesson. So
 * every call here resolves rather than throws, and the UI shows what it has.
 * A failed forecast is a quiet gap, never a broken page.
 */

/** Long enough for a slow connection, short enough not to hang the panel. */
const TIMEOUT_MS = 8_000;

/**
 * Fetch and parse JSON, or return null.
 *
 * Never throws. A rejected promise here would take down a panel over a service
 * being briefly unavailable, which is not a failure worth a stack trace.
 */
export async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    // Offline, blocked, timed out, or malformed. All the same to the caller.
    return null;
  }
}

// ── Weather ─────────────────────────────────────────────────────────────────

export interface Forecast {
  temperature: number;
  /** Open-Meteo's WMO weather code. */
  code: number;
  high: number;
  low: number;
  /** Local time at the place, not the viewer — "is it night there" matters. */
  isDay: boolean;
}

export function weatherUrl(
  latitude: number,
  longitude: number,
  timezone?: string | null,
): string {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,weather_code,is_day",
    daily: "temperature_2m_max,temperature_2m_min",
    forecast_days: "1",
    // `auto` resolves the zone from the coordinates, which is right far more
    // often than the viewer's own zone would be.
    timezone: timezone || "auto",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    is_day?: number;
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
}

/**
 * Read a forecast, or null.
 *
 * Every field is checked rather than trusted: a response that arrives without
 * a temperature is not a zero-degree day.
 */
export function parseForecast(body: unknown): Forecast | null {
  if (typeof body !== "object" || body === null) return null;

  const data = body as OpenMeteoResponse;
  const temperature = data.current?.temperature_2m;
  if (typeof temperature !== "number" || !Number.isFinite(temperature)) {
    return null;
  }

  const high = data.daily?.temperature_2m_max?.[0];
  const low = data.daily?.temperature_2m_min?.[0];

  return {
    temperature,
    code:
      typeof data.current?.weather_code === "number"
        ? data.current.weather_code
        : 0,
    // Falling back to the current temperature rather than 0 keeps a partial
    // response readable instead of claiming a freezing high.
    high: typeof high === "number" ? high : temperature,
    low: typeof low === "number" ? low : temperature,
    isDay: data.current?.is_day !== 0,
  };
}

/**
 * WMO weather codes, grouped.
 *
 * The full table has 28 entries that split hairs a person does not care
 * about — "light drizzle" versus "moderate drizzle" is the same coat.
 */
export function describeWeather(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorm";
}

// ── Topics ──────────────────────────────────────────────────────────────────

export type TopicSource = "hackernews" | "devto";

export interface Story {
  id: string;
  title: string;
  url: string;
  /** Points, reactions — whatever the source counts. Absent when it counts none. */
  score?: number;
  host?: string;
}

export function topicUrl(
  term: string,
  source: TopicSource,
  window?: Window,
  now = new Date(),
): string {
  // Encoded, not interpolated: a term with an ampersand would otherwise
  // truncate the query and silently search for something else.
  const query = encodeURIComponent(term.trim());

  if (source !== "hackernews") {
    // dev.to has no date filter, so the window cannot be applied. Asking for
    // its most recent is the honest approximation — a filter that silently
    // does nothing would be worse than none.
    return "https://dev.to/api/articles?tag=" + query + "&per_page=6";
  }

  const filters = window
    ? "&numericFilters=" +
      encodeURIComponent("created_at_i>" + cutoffSeconds(window, now))
    : "";

  return (
    "https://hn.algolia.com/api/v1/search?query=" +
    query +
    "&tags=story&hitsPerPage=6" +
    filters
  );
}

/** The host, for a "where is this from" label. Never throws on a bad URL. */
function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

export function parseStories(body: unknown, source: TopicSource): Story[] {
  const rows =
    source === "hackernews"
      ? (body as { hits?: unknown[] } | null)?.hits
      : body;

  if (!Array.isArray(rows)) return [];

  return rows
    .map((row): Story | null => {
      if (typeof row !== "object" || row === null) return null;
      const record = row as Record<string, unknown>;

      const title = typeof record.title === "string" ? record.title.trim() : "";
      if (!title) return null;

      // Hacker News returns `url: null` for text-only posts; the discussion
      // page is then the only place to send someone.
      const url =
        typeof record.url === "string" && record.url
          ? record.url
          : source === "hackernews" && record.objectID
            ? `https://news.ycombinator.com/item?id=${String(record.objectID)}`
            : "";
      if (!url) return null;

      const score =
        source === "hackernews"
          ? record.points
          : record.positive_reactions_count;

      return {
        id: String(record.objectID ?? record.id ?? url),
        title,
        url,
        score: typeof score === "number" ? score : undefined,
        host: hostOf(url),
      };
    })
    .filter((story): story is Story => story !== null);
}

// ── What happened, in a window ──────────────────────────────────────────────

/**
 * The three windows the module asks about.
 *
 * Not arbitrary: they are the three questions people actually have. "What did
 * I miss overnight", "what happened while I was heads-down this week", and
 * "what changed this month". A free-form date range would be a worse answer to
 * all three.
 */
export type Window = "day" | "week" | "month";

export const WINDOWS: { id: Window; label: string; days: number }[] = [
  { id: "day", label: "24 hours", days: 1 },
  { id: "week", label: "This week", days: 7 },
  { id: "month", label: "This month", days: 30 },
];

function windowDays(window: Window): number {
  return WINDOWS.find((entry) => entry.id === window)?.days ?? 1;
}

/** Unix seconds at the start of the window. */
function cutoffSeconds(window: Window, now = new Date()): number {
  return Math.floor(now.getTime() / 1000) - windowDays(window) * 86_400;
}

/** `YYYY-MM-DD` at the start of the window, from local calendar fields. */
function cutoffDate(window: Window, now = new Date()): string {
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - windowDays(window),
  );
  const month = String(start.getMonth() + 1).padStart(2, "0");
  const day = String(start.getDate()).padStart(2, "0");
  return start.getFullYear() + "-" + month + "-" + day;
}

/**
 * The threshold that makes this a digest rather than a firehose.
 *
 * Hacker News takes thousands of submissions a day and most are noise. Asking
 * for a minimum score is what turns "everything posted" into "what people
 * actually stopped to read" — and the bar has to rise with the window, or a
 * month's view is thirty times as long instead of thirty times as selective.
 */
export function minimumScore(window: Window): number {
  return window === "day" ? 50 : window === "week" ? 200 : 500;
}

export function topStoriesUrl(window: Window, now = new Date()): string {
  const filters =
    "created_at_i>" +
    cutoffSeconds(window, now) +
    ",points>" +
    minimumScore(window);
  return (
    "https://hn.algolia.com/api/v1/search?tags=story&numericFilters=" +
    encodeURIComponent(filters) +
    "&hitsPerPage=8"
  );
}

/**
 * Software that appeared in the window, by how many people starred it.
 *
 * `created:` rather than `pushed:` on purpose — a repository that gained
 * fifteen thousand stars in a week is news; one that received a commit is not.
 */
export function newReposUrl(window: Window, now = new Date()): string {
  const query = encodeURIComponent("created:>" + cutoffDate(window, now));
  return (
    "https://api.github.com/search/repositories?q=" +
    query +
    "&sort=stars&order=desc&per_page=6"
  );
}

export interface Repo {
  id: string;
  name: string;
  description?: string;
  url: string;
  stars: number;
  language?: string;
}

export function parseRepos(body: unknown): Repo[] {
  const items = (body as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) return [];

  return items
    .map((row): Repo | null => {
      if (typeof row !== "object" || row === null) return null;
      const record = row as Record<string, unknown>;

      const name = record.full_name;
      const url = record.html_url;
      if (typeof name !== "string" || typeof url !== "string") return null;

      return {
        id: String(record.id ?? name),
        name,
        description:
          typeof record.description === "string" && record.description
            ? record.description
            : undefined,
        url,
        stars:
          typeof record.stargazers_count === "number"
            ? record.stargazers_count
            : 0,
        language:
          typeof record.language === "string" ? record.language : undefined,
      };
    })
    .filter((repo): repo is Repo => repo !== null);
}

/**
 * What the world looked up.
 *
 * The most honest "what happened" signal available without a key: Wikipedia
 * publishes its most-read articles per day, and a spike in readership is a
 * remarkably good proxy for something having occurred — a death or a result
 * shows up here before most feeds carry it.
 *
 * Day-scoped by nature, because the feed is published per date. So this panel
 * answers the 24-hour question only, and the UI says so rather than implying a
 * month's version exists.
 */
function mostReadUrl(now = new Date()): string {
  // Yesterday: today's figures are partial until the day closes, and a
  // half-counted day ranks the early hours above everything after them.
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return (
    "https://api.wikimedia.org/feed/v1/wikipedia/en/featured/" +
    date.getFullYear() +
    "/" +
    month +
    "/" +
    day
  );
}

export interface ReadArticle {
  title: string;
  views: number;
  url: string;
  extract?: string;
}

export function parseMostRead(body: unknown, limit = 6): ReadArticle[] {
  const articles = (body as { mostread?: { articles?: unknown[] } } | null)
    ?.mostread?.articles;
  if (!Array.isArray(articles)) return [];

  return articles
    .map((row): ReadArticle | null => {
      if (typeof row !== "object" || row === null) return null;
      const record = row as Record<string, unknown>;

      const title = record.normalizedtitle;
      const views = record.views;
      if (typeof title !== "string" || typeof views !== "number") return null;

      const urls = record.content_urls as
        | { desktop?: { page?: string } }
        | undefined;

      return {
        title,
        views,
        url:
          urls?.desktop?.page ??
          "https://en.wikipedia.org/wiki/" + encodeURIComponent(title),
        extract:
          typeof record.extract === "string" ? record.extract : undefined,
      };
    })
    .filter((article): article is ReadArticle => article !== null)
    .slice(0, limit);
}

/** `1581846` reads as `1.6M`. A seven-digit number is not a readable figure. */
export function compactNumber(value: number): string {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + "M";
  if (value >= 1_000) return Math.round(value / 1_000) + "k";
  return String(value);
}

// ── On this day ─────────────────────────────────────────────────────────────

/* ── Place search ────────────────────────────────────────────────────────── */

/** A place found by name: what a forecast needs, and enough to tell two apart. */
export interface PlaceMatch {
  id: number;
  name: string;
  /** "Maharashtra, India": the region and country, for telling Londons apart. */
  where: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
}

/**
 * Open-Meteo's place search, the same provider as the forecast: free, no
 * key. "Add a place" asked for latitude and longitude, which nobody knows
 * for their own city.
 */
export function placeSearchUrl(name: string, count = 5): string {
  const params = new URLSearchParams({
    name: name.trim(),
    count: String(count),
    language: "en",
    format: "json",
  });
  return `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`;
}

interface GeocodingResponse {
  results?: {
    id?: number;
    name?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    admin1?: string;
    country?: string;
  }[];
}

/** Results with usable coordinates; nothing found is an empty list. */
export function parsePlaces(body: unknown): PlaceMatch[] {
  const results = (body as GeocodingResponse | null)?.results ?? [];
  return results
    .filter(
      (
        r,
      ): r is Required<
        Pick<NonNullable<typeof r>, "id" | "name" | "latitude" | "longitude">
      > &
        typeof r =>
        typeof r?.id === "number" &&
        typeof r.name === "string" &&
        Number.isFinite(r.latitude) &&
        Number.isFinite(r.longitude),
    )
    .map((r) => ({
      id: r.id,
      name: r.name,
      where: [r.admin1, r.country].filter(Boolean).join(", "),
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone ?? null,
    }));
}

/* ── Most read, for a week or a month ────────────────────────────────────── */

const TOP_API =
  "https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access";

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * What to fetch for "most read" in a window. The featured feed above is per
 * day; for longer windows Wikimedia publishes top-article lists per day and
 * per calendar month (browser-reachable, no key):
 *  - `week`: the last seven complete days, one list each, to be summed;
 *  - `month`: the last complete calendar month, published once it ends.
 * The panel followed only "24 hours" before, so choosing a week left it
 * unchanged and the window control looked broken.
 */
export function mostReadSource(
  window: Window,
  now = new Date(),
): { urls: string[]; label: string } {
  if (window === "day")
    return { urls: [mostReadUrl(now)], label: "Wikipedia, yesterday" };
  if (window === "week") {
    const urls = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1 - i,
      );
      return `${TOP_API}/${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
    });
    return { urls, label: "Wikipedia, the last seven days" };
  }
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const name = last.toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
  });
  return {
    urls: [
      `${TOP_API}/${last.getFullYear()}/${pad2(last.getMonth() + 1)}/all-days`,
    ],
    label: `Wikipedia, ${name} (the last full month)`,
  };
}

/** Not an article: the front page, searches, and the project's own pages. */
function isArticle(title: string): boolean {
  if (title === "Main_Page" || title === "-") return false;
  return !/^(Special|Wikipedia|File|Portal|Help|Talk|Category|Template|User|Draft|Module|MediaWiki):/.test(
    title,
  );
}

/**
 * Wikimedia's top-article lists, summed across the bodies (one per day for a
 * week, one for a month), most viewed first. Nothing usable is an empty list.
 */
export function parseTopArticles(bodies: unknown[], limit = 6): ReadArticle[] {
  const views = new Map<string, number>();
  for (const body of bodies) {
    const articles = (
      body as {
        items?: { articles?: { article?: unknown; views?: unknown }[] }[];
      } | null
    )?.items?.[0]?.articles;
    if (!Array.isArray(articles)) continue;
    for (const row of articles) {
      if (typeof row?.article !== "string" || typeof row.views !== "number")
        continue;
      if (!isArticle(row.article)) continue;
      views.set(row.article, (views.get(row.article) ?? 0) + row.views);
    }
  }
  return [...views]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([article, count]) => ({
      title: article.replace(/_/g, " "),
      views: count,
      url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(article),
    }));
}
