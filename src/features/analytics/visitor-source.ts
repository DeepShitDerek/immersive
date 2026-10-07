/**
 * Where a visit came from.
 *
 * Two things are kept separate on purpose: the *referrer* is what the browser
 * reported, and the *source* is the label a person wants to read. "Search" and
 * "LinkedIn" are answers; "l.instagram.com" and "com.linkedin.android" are not,
 * and the same arrival shows up under half a dozen hostnames depending on which
 * app forwarded it.
 */

export interface VisitSource {
  /** Host only — never the full referrer URL. */
  referrerHost: string | null;
  /** Readable grouping: "Direct", "Search", "LinkedIn", or the bare host. */
  source: string;
  /** Broad bucket for the breakdown chart. */
  channel: "direct" | "search" | "social" | "referral" | "campaign";
}

const SEARCH = [
  "google",
  "bing",
  "duckduckgo",
  "yahoo",
  "yandex",
  "baidu",
  "ecosia",
  "brave",
  "startpage",
  "qwant",
];

/** Hostname fragment → display name. Covers the app and shortener variants. */
const SOCIAL: [string, string][] = [
  ["linkedin", "LinkedIn"],
  ["lnkd.in", "LinkedIn"],
  ["twitter", "X"],
  ["x.com", "X"],
  ["t.co", "X"],
  ["facebook", "Facebook"],
  ["fb.me", "Facebook"],
  ["instagram", "Instagram"],
  ["reddit", "Reddit"],
  ["news.ycombinator", "Hacker News"],
  ["github", "GitHub"],
  ["youtube", "YouTube"],
  ["youtu.be", "YouTube"],
  ["mastodon", "Mastodon"],
  ["bsky", "Bluesky"],
  ["threads", "Threads"],
  ["discord", "Discord"],
  ["t.me", "Telegram"],
  ["telegram", "Telegram"],
  ["whatsapp", "WhatsApp"],
  ["medium", "Medium"],
  ["dev.to", "DEV"],
  ["producthunt", "Product Hunt"],
  ["stackoverflow", "Stack Overflow"],
];

/** Strip `www.` and lowercase, so one site is not three rows in the table. */
function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

export interface SourceInput {
  referrer: string;
  /** The current URL, for UTM parameters. */
  url: string;
  /** The site's own origin, so internal navigation is not counted as referral. */
  origin: string;
}

export function classifySource({
  referrer,
  url,
  origin,
}: SourceInput): VisitSource & {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
} {
  let utmSource: string | null = null;
  let utmMedium: string | null = null;
  let utmCampaign: string | null = null;

  try {
    const params = new URL(url).searchParams;
    utmSource = params.get("utm_source");
    utmMedium = params.get("utm_medium");
    utmCampaign = params.get("utm_campaign");
  } catch {
    // A URL we cannot parse simply has no campaign on it.
  }

  let referrerHost: string | null = null;
  try {
    if (referrer) {
      const host = normalizeHost(new URL(referrer).hostname);
      // A referrer from our own site is internal navigation, not an arrival.
      const self = normalizeHost(new URL(origin).hostname);
      if (host !== self) referrerHost = host;
    }
  } catch {
    referrerHost = null;
  }

  // A tagged link is a campaign whatever the referrer says — that is the point
  // of tagging it, and it is the only signal that survives an app opening the
  // link in its own in-app browser with the referrer stripped.
  if (utmSource) {
    return {
      referrerHost,
      source: utmSource,
      channel: "campaign",
      utmSource,
      utmMedium,
      utmCampaign,
    };
  }

  if (!referrerHost) {
    return {
      referrerHost: null,
      source: "Direct",
      channel: "direct",
      utmSource,
      utmMedium,
      utmCampaign,
    };
  }

  if (SEARCH.some((engine) => referrerHost!.includes(engine))) {
    return {
      referrerHost,
      source: "Search",
      channel: "search",
      utmSource,
      utmMedium,
      utmCampaign,
    };
  }

  const social = SOCIAL.find(([fragment]) => referrerHost!.includes(fragment));
  if (social) {
    return {
      referrerHost,
      source: social[1],
      channel: "social",
      utmSource,
      utmMedium,
      utmCampaign,
    };
  }

  return {
    referrerHost,
    source: referrerHost,
    channel: "referral",
    utmSource,
    utmMedium,
    utmCampaign,
  };
}

/**
 * Country from an IANA timezone.
 *
 * The free half of the location story, and the fallback when the IP lookup is
 * blocked — which it will be for anyone running an ad-blocker, so it is a
 * normal path rather than an edge case. `Asia/Kolkata` is India whether or not
 * a third party ever sees the visitor.
 *
 * Deliberately partial: the common zones, and null for anything else. A wrong
 * country is worse than no country, and a table of all ~600 zones would be
 * another list to keep in sync for arrivals a portfolio will never see.
 */
const ZONE_COUNTRIES: Record<string, string> = {
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Dubai": "AE",
  "Asia/Karachi": "PK",
  "Asia/Dhaka": "BD",
  "Asia/Colombo": "LK",
  "Asia/Kathmandu": "NP",
  "Asia/Singapore": "SG",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Asia/Shanghai": "CN",
  "Asia/Hong_Kong": "HK",
  "Asia/Jakarta": "ID",
  "Asia/Manila": "PH",
  "Asia/Bangkok": "TH",
  "Asia/Ho_Chi_Minh": "VN",
  "Asia/Jerusalem": "IL",
  "Asia/Istanbul": "TR",
  "Europe/Istanbul": "TR",
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Zurich": "CH",
  "Europe/Vienna": "AT",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "Europe/Helsinki": "FI",
  "Europe/Warsaw": "PL",
  "Europe/Prague": "CZ",
  "Europe/Lisbon": "PT",
  "Europe/Athens": "GR",
  "Europe/Bucharest": "RO",
  "Europe/Budapest": "HU",
  "Europe/Kyiv": "UA",
  "Europe/Kiev": "UA",
  "Europe/Moscow": "RU",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Phoenix": "US",
  "America/Los_Angeles": "US",
  "America/Anchorage": "US",
  "Pacific/Honolulu": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Edmonton": "CA",
  "America/Winnipeg": "CA",
  "America/Halifax": "CA",
  "America/Mexico_City": "MX",
  "America/Bogota": "CO",
  "America/Lima": "PE",
  "America/Santiago": "CL",
  "America/Sao_Paulo": "BR",
  "America/Argentina/Buenos_Aires": "AR",
  "Africa/Lagos": "NG",
  "Africa/Nairobi": "KE",
  "Africa/Cairo": "EG",
  "Africa/Johannesburg": "ZA",
  "Africa/Casablanca": "MA",
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU",
  "Australia/Perth": "AU",
  "Australia/Adelaide": "AU",
  "Pacific/Auckland": "NZ",
};

export function countryFromTimezone(timezone: string): string | null {
  return ZONE_COUNTRIES[timezone] ?? null;
}
