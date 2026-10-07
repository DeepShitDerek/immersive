import type { VisitorAnalytics, VisitorSlice } from "@/types";

/**
 * Turning the aggregate into something readable.
 *
 * Kept separate from the components because every one of these is a decision
 * that can be wrong in a way a chart will happily render: a percentage over a
 * zero total, a country code with no name, a series with holes in it where
 * nobody visited.
 */

export const RANGE_OPTIONS = [
  { days: 7, label: "7 days", short: "7d" },
  { days: 30, label: "30 days", short: "30d" },
  { days: 90, label: "90 days", short: "90d" },
  { days: 365, label: "12 months", short: "12m" },
] as const;

/** Share of a total, guarding the case that makes it meaningless. */
export function share(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

export function formatShare(value: number, total: number): string {
  if (total <= 0) return "—";
  const percent = share(value, total);
  // Below 0.1% renders as "0.0%", which reads as nothing rather than as few.
  return percent < 0.1 ? "<0.1%" : `${percent.toFixed(1)}%`;
}

/**
 * A country name from its ISO-3166 alpha-2 code.
 *
 * `Intl.DisplayNames` ships with the runtime, so this costs nothing and covers
 * every code in the world — a hand-kept table would be 250 more rows to drift.
 * Falls back to the raw code, which is still more use than a blank.
 */
export function countryName(code: string, locale = "en"): string {
  if (!code || code.length !== 2) return code || "Unknown";
  try {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    return names.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/**
 * The regional-indicator flag for a country code.
 *
 * Two code points offset from 'A' into the regional indicator block. Returns
 * an empty string for anything that is not a plausible code, because a partial
 * pair renders as two stray letters in a box.
 */
export function countryFlag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}

/**
 * Fill the gaps in a daily series.
 *
 * The RPC groups by day, so days nobody visited are simply absent — and a line
 * chart joining 3 August to 9 August draws a straight line across the gap,
 * which reads as steady traffic rather than none. Every day in the range gets a
 * point, zero where there was no row.
 */
export function fillDailySeries(
  series: VisitorAnalytics["by_day"],
  days: number,
  today = new Date(),
): { day: string; views: number; visitors: number }[] {
  const known = new Map(series.map((entry) => [entry.day, entry]));
  const out: { day: string; views: number; visitors: number }[] = [];

  // UTC throughout, because the RPC buckets by `created_at AT TIME ZONE 'UTC'`.
  // Mixing local dates in here shifts every point by the viewer's offset.
  const end = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(end - offset * 86_400_000);
    // utc-intentional: UTC deliberately — see above. `toLocalISODate` is
    // wrong here:
    // the bucket keys come from the database in UTC, and formatting them
    // locally shifts every point by the viewer's offset.
    const key = date.toISOString().slice(0, 10);
    const entry = known.get(key);
    out.push({
      day: key,
      views: entry?.views ?? 0,
      visitors: entry?.visitors ?? 0,
    });
  }

  return out;
}

/**
 * Collapse a long tail into a single "Other" row.
 *
 * A breakdown of forty browsers with one view each is a list, not a finding.
 * "Other" is appended rather than sorted in, so it always reads last even when
 * it is the largest bar — it is a remainder, not a category.
 */
export function withOther(
  slices: VisitorSlice[],
  keep: number,
  label = "Other",
): VisitorSlice[] {
  if (slices.length <= keep) return slices;
  const head = slices.slice(0, keep);
  const rest = slices.slice(keep).reduce((sum, entry) => sum + entry.value, 0);
  return rest > 0 ? [...head, { name: label, value: rest }] : head;
}

/** Human label for a device bucket. */
export const DEVICE_LABELS: Record<string, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
};

/** Human label for an acquisition channel. */
export const CHANNEL_LABELS: Record<string, string> = {
  direct: "Direct",
  search: "Search",
  social: "Social",
  referral: "Referral",
  campaign: "Campaign",
};

/**
 * Is the visitor count trustworthy?
 *
 * `visitor_hash` is derived from `x-forwarded-for`. If that header never
 * reaches Postgres the column is null for every row, so `count(DISTINCT …)` is
 * zero while views are not. Reporting "0 visitors" next to "412 views" looks
 * like a bug in the site rather than a missing header, so the page says which
 * it is.
 */
export function visitorCountUnavailable(data: VisitorAnalytics): boolean {
  return data.total_views > 0 && data.total_visitors === 0;
}
