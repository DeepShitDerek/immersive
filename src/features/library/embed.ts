/**
 * Watching or listening on the site, where the provider allows it.
 *
 * Only a handful of providers offer an embeddable player, and those are the
 * only ones handled. Articles are deliberately absent: most sites refuse to be
 * framed, and a "reader view" would mean fetching the page on a server — which
 * a static export does not have. They open on the original site.
 *
 * ## Why the player URL is built, never copied
 *
 * The `src` of the iframe is assembled from an ID parsed out of the link,
 * against an exact allowlist of hosts. The pasted URL itself never reaches the
 * iframe. That is the whole security argument: `youtube.com.evil.example`
 * contains "youtube.com", a URL with a `javascript:` scheme parses, and an ID
 * that is not an ID should produce no player rather than a player pointed
 * somewhere unexpected.
 */

type EmbedProvider = "youtube" | "vimeo" | "spotify" | "apple-podcasts";

export interface Embed {
  provider: EmbedProvider;
  /** The player URL — built from parts, never the pasted link. */
  src: string;
  /** Video gets a 16:9 frame; audio a short fixed-height one. */
  kind: "video" | "audio";
  label: string;
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const DIGITS = /^\d+$/;

/**
 * Seconds from a clock-style location: `12:34` or `1:02:03`, and the
 * `1h2m3s` / `2m30s` form YouTube puts in shared links.
 *
 * A bare number is **not** read as seconds. Locations are free text and "42"
 * is far more likely to be a page than a second, so guessing would start a
 * video at 0:42 because of a page number.
 */
export function parseTimestamp(raw?: string | null): number | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return null;

  const clock = value.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/);
  if (clock) {
    const [, hours = "0", minutes, seconds] = clock;
    if (Number(seconds) > 59 || (clock[1] && Number(minutes) > 59)) return null;
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  }

  const units = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (units && (units[1] || units[2] || units[3])) {
    return (
      Number(units[1] ?? 0) * 3600 +
      Number(units[2] ?? 0) * 60 +
      Number(units[3] ?? 0)
    );
  }

  return null;
}

/** YouTube's own `t` / `start`, which may be `90`, `90s` or `1m30s`. */
function youtubeStart(url: URL): number | null {
  const raw = url.searchParams.get("t") ?? url.searchParams.get("start");
  if (!raw) return null;
  if (DIGITS.test(raw)) return Number(raw);
  return parseTimestamp(raw);
}

function youtubeId(url: URL): string | null {
  if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0];

  const fromQuery = url.searchParams.get("v");
  if (fromQuery) return fromQuery;

  const [, first, second] = url.pathname.split("/");
  if (["shorts", "embed", "live", "v"].includes(first)) return second ?? null;
  return null;
}

function parse(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    // http is accepted as *input*, since plenty of old links use it; the
    // player built below is always https.
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

/**
 * The embeddable player for a link, or null when there is none.
 *
 * `startSeconds` wins over any time already in the link, so a highlight's own
 * timestamp is where the video opens.
 */
export function embedFor(
  rawUrl: string | null | undefined,
  startSeconds?: number | null,
): Embed | null {
  if (!rawUrl) return null;
  const url = parse(rawUrl);
  if (!url) return null;

  const host = url.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.has(host) || host === "youtu.be") {
    const id = youtubeId(url);
    if (!id || !YOUTUBE_ID.test(id)) return null;

    const start = startSeconds ?? youtubeStart(url);
    // youtube-nocookie: the privacy-enhanced player, which sets no tracking
    // cookie until the visitor actually presses play.
    return {
      provider: "youtube",
      src: `https://www.youtube-nocookie.com/embed/${id}${
        start ? `?start=${Math.floor(start)}` : ""
      }`,
      kind: "video",
      label: "YouTube",
    };
  }

  if (VIMEO_HOSTS.has(host)) {
    // `vimeo.com/123`, `vimeo.com/channels/staffpicks/123`,
    // `player.vimeo.com/video/123` — the ID is the last all-digit segment.
    const id = url.pathname
      .split("/")
      .filter((segment) => DIGITS.test(segment))
      .pop();
    if (!id) return null;

    return {
      provider: "vimeo",
      src: `https://player.vimeo.com/video/${id}${
        startSeconds ? `#t=${Math.floor(startSeconds)}s` : ""
      }`,
      kind: "video",
      label: "Vimeo",
    };
  }

  if (host === "open.spotify.com") {
    // An optional `intl-xx` locale prefix sits in front of the type.
    const segments = url.pathname.split("/").filter(Boolean);
    const offset = segments[0]?.startsWith("intl-") ? 1 : 0;
    const type = segments[offset];
    const id = segments[offset + 1];

    if (!["episode", "show", "track", "album", "playlist"].includes(type))
      return null;
    if (!id || !SPOTIFY_ID.test(id)) return null;

    return {
      provider: "spotify",
      src: `https://open.spotify.com/embed/${type}/${id}`,
      kind: "audio",
      label: "Spotify",
    };
  }

  if (host === "podcasts.apple.com") {
    const match = url.pathname.match(
      /^\/([a-z]{2})\/podcast\/([^/]+)\/id(\d+)\/?$/i,
    );
    if (!match) return null;

    const [, country, rawSlug, showId] = match;
    // The slug is cosmetic to Apple's routing, but it is still copied into a
    // URL — so only a plain slug passes through, and anything else becomes a
    // neutral one rather than carrying arbitrary characters into the player.
    const slug = /^[a-z0-9-]+$/i.test(rawSlug) ? rawSlug : "podcast";
    const episode = url.searchParams.get("i");

    return {
      provider: "apple-podcasts",
      src: `https://embed.podcasts.apple.com/${country.toLowerCase()}/podcast/${slug}/id${showId}${
        episode && DIGITS.test(episode) ? `?i=${episode}` : ""
      }`,
      kind: "audio",
      label: "Apple Podcasts",
    };
  }

  return null;
}
